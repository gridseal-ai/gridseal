import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

const JWT_SECRET = "volume-test-secret";
const TENANT = "volume-tenant";

function authHeader(tenantId: string): { Authorization: string } {
  const token = createTenantToken(tenantId, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

function makeEntryBody(overrides: Record<string, unknown> = {}) {
  return {
    entryId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    entryType: "ai_decision" as const,
    ...overrides,
  };
}

describe("Large volume integration", () => {
  let dbHandle: TenantSqliteHandle;
  let app: Hono;

  beforeEach(() => {
    dbHandle = createTenantSqliteAdapter();
    app = createTenantApp({
      storageFactory: dbHandle.forTenant,
      jwtSecret: JWT_SECRET,
    });
  });

  afterEach(() => {
    dbHandle.close();
  });

  it("appends 10000 entries, validates chain, and paginates correctly", async () => {
    const chainId = "volume-chain";
    const totalEntries = 10_000;

    // Batch append 10K entries
    for (let i = 0; i < totalEntries; i++) {
      const res = await app.request(`/chains/${chainId}/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(TENANT),
        },
        body: JSON.stringify(
          makeEntryBody({
            modelId: `model-${i % 5}`,
            actorId: `actor-${i % 10}`,
            inputHash: "a".repeat(64),
            outputHash: "b".repeat(64),
            decisionType: "generation",
          }),
        ),
      });
      expect(res.status).toBe(201);
    }

    // Validate chain — must succeed
    const start = performance.now();
    const validateRes = await app.request(`/chains/${chainId}/validate`, {
      method: "POST",
      headers: authHeader(TENANT),
    });
    const elapsed = performance.now() - start;
    expect(validateRes.status).toBe(200);
    const validateBody = (await validateRes.json()) as {
      valid: boolean;
      entryCount: number;
    };
    expect(validateBody.valid).toBe(true);
    expect(validateBody.entryCount).toBe(totalEntries);

    // Pagination: traverse all pages and count entries
    let offset = 0;
    const pageSize = 100;
    let totalCounted = 0;
    let lastSeqNumber = -1;
    while (true) {
      const pageRes = await app.request(
        `/chains/${chainId}/entries?offset=${offset}&limit=${pageSize}`,
        { headers: authHeader(TENANT) },
      );
      expect(pageRes.status).toBe(200);
      const pageBody = (await pageRes.json()) as {
        entries: Array<{ sequenceNumber: number }>;
        total: number;
      };
      expect(pageBody.total).toBe(totalEntries);

      if (pageBody.entries.length === 0) break;

      // Verify ordering within page
      for (const entry of pageBody.entries) {
        expect(entry.sequenceNumber).toBeGreaterThan(lastSeqNumber);
        lastSeqNumber = entry.sequenceNumber;
      }

      totalCounted += pageBody.entries.length;
      offset += pageSize;
    }
    expect(totalCounted).toBe(totalEntries);

    // Compliance report generation
    const reportStart = performance.now();
    const reportRes = await app.request(
      `/reports/colorado-sb205?chainId=${chainId}`,
      { headers: authHeader(TENANT) },
    );
    const reportElapsed = performance.now() - reportStart;
    expect(reportRes.status).toBe(200);
    const reportBody = (await reportRes.json()) as {
      report: {
        chainIntegrity: { valid: boolean };
        statistics: { totalEntries: number };
      };
    };
    expect(reportBody.report.chainIntegrity.valid).toBe(true);
    expect(reportBody.report.statistics.totalEntries).toBe(totalEntries);
    // Report should generate within 10 seconds
    expect(reportElapsed).toBeLessThan(10_000);
  }, 600_000); // 10 minute timeout for 10K entries (coverage instrumentation is slow)

  it("handles a chain with all entry types and diverse field combinations", async () => {
    const chainId = "diverse-chain";
    const entryTypes = [
      "ai_decision",
      "human_override",
      "system_event",
      "data_access",
      "model_deployment",
    ] as const;

    for (let i = 0; i < 200; i++) {
      const entryType = entryTypes[i % entryTypes.length];
      const base: Record<string, unknown> = {
        entryType,
        modelId: i % 3 === 0 ? `model-${i % 5}` : null,
        modelProvider: i % 3 === 0 ? "openai" : null,
        sessionId: `session-${i % 20}`,
        actorId: `actor-${i % 8}`,
      };

      // Add optional fields for some entries
      if (i % 4 === 0) {
        base["inputHash"] = "c".repeat(64);
        base["outputHash"] = "d".repeat(64);
        base["inputTokenCount"] = 500 + i;
        base["outputTokenCount"] = 1000 + i;
      }
      if (i % 5 === 0) {
        base["confidenceScore"] = (i % 100) / 100;
        base["decisionType"] = "generation";
      }
      if (i % 7 === 0) {
        base["policyIds"] = ["policy-a", "policy-b"];
        base["tags"] = { env: "test", batch: String(i) };
        base["annotation"] = `Annotation for entry ${i}`;
        base["complianceMetadata"] = { framework: "colorado-sb205" };
      }

      const res = await app.request(`/chains/${chainId}/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(TENANT),
        },
        body: JSON.stringify(makeEntryBody(base)),
      });
      expect(res.status).toBe(201);
    }

    // Validate full chain
    const validateRes = await app.request(`/chains/${chainId}/validate`, {
      method: "POST",
      headers: authHeader(TENANT),
    });
    expect(validateRes.status).toBe(200);
    const validateBody = (await validateRes.json()) as {
      valid: boolean;
      entryCount: number;
    };
    expect(validateBody.valid).toBe(true);
    expect(validateBody.entryCount).toBe(200);

    // Filter by session returns correct subset
    const sessionRes = await app.request(
      `/chains/${chainId}/entries?sessionId=session-0&limit=1000`,
      { headers: authHeader(TENANT) },
    );
    expect(sessionRes.status).toBe(200);
    const sessionBody = (await sessionRes.json()) as {
      entries: Array<{ sessionId: string }>;
      total: number;
    };
    // session-0 at indices 0,20,40,...,180 => 10
    expect(sessionBody.total).toBe(10);
    for (const entry of sessionBody.entries) {
      expect(entry.sessionId).toBe("session-0");
    }
  }, 60_000);

  it("manages multiple chains per tenant correctly", async () => {
    const chainCount = 20;
    const entriesPerChain = 10;

    for (let c = 0; c < chainCount; c++) {
      for (let e = 0; e < entriesPerChain; e++) {
        const res = await app.request(`/chains/chain-${c}/entries`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(TENANT),
          },
          body: JSON.stringify(makeEntryBody()),
        });
        expect(res.status).toBe(201);
      }
    }

    // List all chains
    const chainsRes = await app.request("/chains", {
      headers: authHeader(TENANT),
    });
    expect(chainsRes.status).toBe(200);
    const chainsBody = (await chainsRes.json()) as {
      chains: Array<{ chainId: string; entryCount: number }>;
    };
    expect(chainsBody.chains).toHaveLength(chainCount);

    for (const chain of chainsBody.chains) {
      expect(chain.entryCount).toBe(entriesPerChain);

      // Validate each chain
      const validateRes = await app.request(`/chains/${chain.chainId}/validate`, {
        method: "POST",
        headers: authHeader(TENANT),
      });
      expect(validateRes.status).toBe(200);
      const validateBody = (await validateRes.json()) as {
        valid: boolean;
        entryCount: number;
      };
      expect(validateBody.valid).toBe(true);
      expect(validateBody.entryCount).toBe(entriesPerChain);
    }
  }, 60_000);
});
