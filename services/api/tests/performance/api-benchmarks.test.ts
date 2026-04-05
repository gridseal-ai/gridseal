/**
 * Layer 7 — API throughput and latency benchmarks.
 *
 * Every test exercises the real Hono app with a real SQLite database.
 * No mocks, no stubs. Assertions enforce performance targets.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { performance } from "node:perf_hooks";
import crypto from "node:crypto";
import fs from "node:fs";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const JWT_SECRET = "perf-bench-secret";
const TENANT = "perf-tenant";
const CHAIN_ID = "perf-chain";
const DB_PATH = `/tmp/gridseal-perf-bench-${Date.now()}.sqlite`;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function authHeaders(): Record<string, string> {
  const token = createTenantToken(TENANT, JWT_SECRET);
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function makeEntry(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    entryId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    entryType: "ai_decision",
    modelId: "gpt-4o",
    modelProvider: "openai",
    inputHash: crypto.createHash("sha256").update(crypto.randomBytes(16)).digest("hex"),
    outputHash: crypto.createHash("sha256").update(crypto.randomBytes(16)).digest("hex"),
    decisionType: "generation",
    sessionId: "perf-session",
    actorId: "perf-actor",
    ...overrides,
  };
}

function percentile(sorted: ReadonlyArray<number>, p: number): number {
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)] as number;
}

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

let app: Hono;
let dbHandle: TenantSqliteHandle;

beforeAll(() => {
  dbHandle = createTenantSqliteAdapter(DB_PATH);
  app = createTenantApp({
    storageFactory: dbHandle.forTenant,
    jwtSecret: JWT_SECRET,
  });
}, 30_000);

afterAll(() => {
  dbHandle.close();
  try {
    fs.unlinkSync(DB_PATH);
    try { fs.unlinkSync(`${DB_PATH}-wal`); } catch { /* may not exist */ }
    try { fs.unlinkSync(`${DB_PATH}-shm`); } catch { /* may not exist */ }
  } catch { /* best effort cleanup */ }
});

/* ------------------------------------------------------------------ */
/*  1. Sequential POST throughput                                      */
/* ------------------------------------------------------------------ */

describe("API sequential throughput", () => {
  const chainId = `${CHAIN_ID}-seq`;

  it("appends 500 entries sequentially with p99 latency under 200ms", async () => {
    const count = 500;
    const latencies: Array<number> = [];
    const headers = authHeaders();

    for (let i = 0; i < count; i++) {
      const start = performance.now();
      const res = await app.request(`/chains/${chainId}/entries`, {
        method: "POST",
        headers,
        body: JSON.stringify(makeEntry()),
      });
      const elapsed = performance.now() - start;
      latencies.push(elapsed);

      expect(res.status).toBe(201);
    }

    latencies.sort((a, b) => a - b);
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);

    expect(p99).toBeLessThan(200);

    // Verify chain integrity
    const verifyRes = await app.request(`/chains/${chainId}/validate`, {
      method: "POST",
      headers,
    });
    expect(verifyRes.status).toBe(200);
    const verifyBody = (await verifyRes.json()) as Record<string, unknown>;
    expect(verifyBody["valid"]).toBe(true);
    expect(verifyBody["entryCount"]).toBe(count);
  });
});

/* ------------------------------------------------------------------ */
/*  2. Concurrent POST throughput                                      */
/* ------------------------------------------------------------------ */

describe("API concurrent throughput", () => {
  it("handles 100 concurrent POST requests to separate chains without 500 errors", async () => {
    const batchSize = 100;
    const headers = authHeaders();

    // Each concurrent request writes to its own chain to avoid prev_hash conflicts
    const start = performance.now();
    const promises = Array.from({ length: batchSize }, (_, i) =>
      app.request(`/chains/${CHAIN_ID}-conc-${i}/entries`, {
        method: "POST",
        headers,
        body: JSON.stringify(makeEntry()),
      })
    );

    const responses = await Promise.all(promises);
    const elapsed = performance.now() - start;

    // Count successes vs failures
    const statuses = responses.map((r) => r.status);
    const successes = statuses.filter((s) => s === 201).length;

    // No 500 errors allowed
    const serverErrors = statuses.filter((s) => s >= 500).length;
    expect(serverErrors).toBe(0);

    // All should succeed since each chain is independent
    expect(successes).toBe(batchSize);

    // Spot-check: validate a few chains
    for (let i = 0; i < 5; i++) {
      const verifyRes = await app.request(`/chains/${CHAIN_ID}-conc-${i}/validate`, {
        method: "POST",
        headers,
      });
      expect(verifyRes.status).toBe(200);
      const body = (await verifyRes.json()) as Record<string, unknown>;
      expect(body["valid"]).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  3. GET entries pagination throughput                                */
/* ------------------------------------------------------------------ */

describe("API read throughput", () => {
  const chainId = `${CHAIN_ID}-read`;

  it("retrieves entries via paginated GET in under 100ms per page", async () => {
    const count = 200;
    const headers = authHeaders();

    // Seed entries
    for (let i = 0; i < count; i++) {
      const res = await app.request(`/chains/${chainId}/entries`, {
        method: "POST",
        headers,
        body: JSON.stringify(makeEntry()),
      });
      expect(res.status).toBe(201);
    }

    // Read paginated
    const pageSize = 50;
    const pages = Math.ceil(count / pageSize);
    const latencies: Array<number> = [];

    for (let p = 0; p < pages; p++) {
      const start = performance.now();
      const res = await app.request(
        `/chains/${chainId}/entries?offset=${p * pageSize}&limit=${pageSize}`,
        { method: "GET", headers },
      );
      const elapsed = performance.now() - start;
      latencies.push(elapsed);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { entries: Array<unknown> };
      if (p < pages - 1) {
        expect(body.entries.length).toBe(pageSize);
      }
    }

    latencies.sort((a, b) => a - b);
    const p99 = percentile(latencies, 99);
    expect(p99).toBeLessThan(100);
  });
});

/* ------------------------------------------------------------------ */
/*  4. Chain validation API throughput                                  */
/* ------------------------------------------------------------------ */

describe("API validation throughput", () => {
  it("validates a 500-entry chain via API in under 500ms", async () => {
    const chainId = `${CHAIN_ID}-valapi`;
    const count = 500;
    const headers = authHeaders();

    for (let i = 0; i < count; i++) {
      const res = await app.request(`/chains/${chainId}/entries`, {
        method: "POST",
        headers,
        body: JSON.stringify(makeEntry()),
      });
      expect(res.status).toBe(201);
    }

    const start = performance.now();
    const res = await app.request(`/chains/${chainId}/validate`, {
      method: "POST",
      headers,
    });
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body["valid"]).toBe(true);
    expect(body["entryCount"]).toBe(count);
    expect(elapsed).toBeLessThan(500);
  });
});

/* ------------------------------------------------------------------ */
/*  5. Report generation API throughput                                */
/* ------------------------------------------------------------------ */

describe("API report generation throughput", () => {
  it("generates a compliance report for a 500-entry chain via API in under 5 seconds", async () => {
    const chainId = `${CHAIN_ID}-rptapi`;
    const count = 500;
    const headers = authHeaders();

    for (let i = 0; i < count; i++) {
      const res = await app.request(`/chains/${chainId}/entries`, {
        method: "POST",
        headers,
        body: JSON.stringify(makeEntry()),
      });
      expect(res.status).toBe(201);
    }

    const start = performance.now();
    const res = await app.request(`/reports/colorado-sb205?chainId=${chainId}`, {
      method: "GET",
      headers,
    });
    const elapsed = performance.now() - start;

    expect(res.status).toBe(200);
    const body = (await res.json()) as { report: Record<string, unknown> };
    expect(body.report).toBeDefined();
    expect(elapsed).toBeLessThan(5000);
  });
});
