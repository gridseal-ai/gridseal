import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

const JWT_SECRET = "concurrent-test-secret";
const TENANT = "concurrent-tenant";

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

describe("Concurrent write integration", () => {
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

  it("handles 10 clients each appending 50 entries to separate chains (500 total) with chain integrity per client", async () => {
    const clientCount = 10;
    const entriesPerClient = 50;

    // Each client appends to its own chain to avoid hash-chain conflicts.
    // This tests concurrent DB writes across different chains.
    const clientPromises = Array.from({ length: clientCount }, async (_, clientIdx) => {
      const chainId = `concurrent-chain-${clientIdx}`;
      const results: Array<number> = [];
      for (let i = 0; i < entriesPerClient; i++) {
        const res = await app.request(`/chains/${chainId}/entries`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(TENANT),
          },
          body: JSON.stringify(
            makeEntryBody({
              modelId: `model-client-${clientIdx}`,
              annotation: `client-${clientIdx}-entry-${i}`,
            }),
          ),
        });
        results.push(res.status);
      }
      return { chainId, results };
    });

    const allResults = await Promise.all(clientPromises);

    for (const { chainId, results } of allResults) {
      // All entries should succeed (each chain is independent)
      for (const status of results) {
        expect(status).toBe(201);
      }

      // Verify chain integrity per client
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
      expect(validateBody.entryCount).toBe(entriesPerClient);
    }

    // Verify all chains are listed
    const chainsRes = await app.request("/chains", {
      headers: authHeader(TENANT),
    });
    expect(chainsRes.status).toBe(200);
    const chainsBody = (await chainsRes.json()) as {
      chains: Array<{ chainId: string; entryCount: number }>;
    };
    expect(chainsBody.chains).toHaveLength(clientCount);

    // Verify no duplicate entry IDs across all chains
    const allEntryIds: Array<string> = [];
    for (const { chainId } of allResults) {
      const listRes = await app.request(
        `/chains/${chainId}/entries?limit=1000`,
        { headers: authHeader(TENANT) },
      );
      const listBody = (await listRes.json()) as {
        entries: Array<{ entryId: string }>;
      };
      for (const entry of listBody.entries) {
        allEntryIds.push(entry.entryId);
      }
    }
    const uniqueIds = new Set(allEntryIds);
    expect(uniqueIds.size).toBe(clientCount * entriesPerClient);
  });

  it("maintains tenant isolation under concurrent writes from multiple tenants", async () => {
    const chainId = "shared-concurrent";
    const tenants = ["tenant-x", "tenant-y", "tenant-z"];
    const entriesPerTenant = 50;

    const tenantPromises = tenants.map(async (tenantId) => {
      const successes: Array<string> = [];
      for (let i = 0; i < entriesPerTenant; i++) {
        const entryId = crypto.randomUUID();
        const res = await app.request(`/chains/${chainId}/entries`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeader(tenantId),
          },
          body: JSON.stringify(makeEntryBody({ entryId })),
        });
        if (res.status === 201) {
          successes.push(entryId);
        }
      }
      return { tenantId, successes };
    });

    const results = await Promise.all(tenantPromises);

    // Each tenant should see only their own entries
    for (const { tenantId, successes } of results) {
      const listRes = await app.request(
        `/chains/${chainId}/entries?limit=1000`,
        { headers: authHeader(tenantId) },
      );
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as {
        entries: Array<{ entryId: string }>;
        total: number;
      };
      expect(listBody.total).toBe(successes.length);

      const returnedIds = new Set(listBody.entries.map((e) => e.entryId));
      for (const id of successes) {
        expect(returnedIds.has(id)).toBe(true);
      }

      // Validate each tenant's chain independently
      const validateRes = await app.request(`/chains/${chainId}/validate`, {
        method: "POST",
        headers: authHeader(tenantId),
      });
      expect(validateRes.status).toBe(200);
      const validateBody = (await validateRes.json()) as {
        valid: boolean;
        entryCount: number;
      };
      expect(validateBody.valid).toBe(true);
      expect(validateBody.entryCount).toBe(successes.length);
    }
  });

  it("handles rapid sequential appends to a single chain without losing entries", async () => {
    const chainId = "rapid-chain";
    const count = 500;

    // Sequential appends (not parallel) to avoid hash-chain race conditions
    for (let i = 0; i < count; i++) {
      const res = await app.request(`/chains/${chainId}/entries`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(TENANT),
        },
        body: JSON.stringify(
          makeEntryBody({ annotation: `rapid-${i}` }),
        ),
      });
      expect(res.status).toBe(201);
    }

    // Validate chain
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
    expect(validateBody.entryCount).toBe(count);

    // Verify all entries are present
    const listRes = await app.request(
      `/chains/${chainId}/entries?limit=1000`,
      { headers: authHeader(TENANT) },
    );
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { total: number };
    expect(listBody.total).toBe(count);
  });
});
