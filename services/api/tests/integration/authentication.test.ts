import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTenantApp, createApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createSqliteAdapter } from "../../src/db/sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";
import type { SqliteAdapterHandle } from "../../src/db/sqlite-adapter.js";

const JWT_SECRET = "auth-test-secret";
const TENANT = "auth-tenant";
const WRONG_SECRET = "wrong-secret-entirely";

function authHeader(tenantId: string, secret?: string): { Authorization: string } {
  const token = createTenantToken(tenantId, secret ?? JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

describe("Authentication integration (multi-tenant JWT mode)", () => {
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

  describe("missing authentication", () => {
    const endpoints = [
      { method: "GET", path: "/chains" },
      { method: "GET", path: "/chains/test-chain" },
      { method: "GET", path: "/chains/test-chain/entries" },
      { method: "POST", path: "/chains/test-chain/entries" },
      { method: "POST", path: "/chains/test-chain/validate" },
      { method: "GET", path: `/chains/test-chain/entries/${crypto.randomUUID()}` },
      { method: "POST", path: "/certificates" },
      { method: "GET", path: `/certificates/${crypto.randomUUID()}` },
      { method: "POST", path: `/certificates/${crypto.randomUUID()}/verify` },
      { method: "POST", path: "/provenance" },
      { method: "GET", path: `/provenance/${crypto.randomUUID()}` },
      { method: "POST", path: `/provenance/${crypto.randomUUID()}/verify` },
      { method: "GET", path: "/reports" },
      { method: "GET", path: "/reports/colorado-sb205?chainId=test" },
    ];

    for (const { method, path } of endpoints) {
      it(`returns 401 for ${method} ${path} without authorization header`, async () => {
        const res = await app.request(path, { method });
        expect(res.status).toBe(401);
        const body = (await res.json()) as { error: string };
        expect(body.error).toContain("Missing API key");
      });
    }
  });

  describe("invalid tokens", () => {
    it("rejects empty Bearer token", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: "Bearer" },
      });
      expect(res.status).toBe(401);
    });

    it("rejects Bearer with only whitespace", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: "Bearer   " },
      });
      expect(res.status).toBe(401);
    });

    it("rejects malformed JWT (not 3 parts)", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: "Bearer not.a.valid.jwt.token" },
      });
      expect(res.status).toBe(403);
    });

    it("rejects JWT with only 2 parts", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: "Bearer header.payload" },
      });
      expect(res.status).toBe(403);
    });

    it("rejects random string as token", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: "Bearer completelyrandomstring" },
      });
      expect(res.status).toBe(403);
    });

    it("rejects token signed with wrong secret", async () => {
      const res = await app.request("/chains", {
        headers: authHeader(TENANT, WRONG_SECRET),
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("Authentication failed");
    });

    it("rejects expired token", async () => {
      const expiredToken = createTenantToken(TENANT, JWT_SECRET, -10);
      const res = await app.request("/chains", {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("expired");
    });

    it("accepts token with future expiration", async () => {
      const futureToken = createTenantToken(TENANT, JWT_SECRET, 3600);
      const res = await app.request("/chains", {
        headers: { Authorization: `Bearer ${futureToken}` },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("tenant access control", () => {
    it("tenant A cannot access tenant B data by guessing entry IDs", async () => {
      const entryId = crypto.randomUUID();

      // Tenant B creates an entry
      const createRes = await app.request("/chains/private-chain/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("tenant-b"),
        },
        body: JSON.stringify({
          entryId,
          timestamp: new Date().toISOString(),
          entryType: "ai_decision",
        }),
      });
      expect(createRes.status).toBe(201);

      // Tenant A tries direct entry access
      const getRes = await app.request(
        `/chains/private-chain/entries/${entryId}`,
        { headers: authHeader("tenant-a") },
      );
      expect(getRes.status).toBe(404);

      // Tenant A tries chain listing
      const listRes = await app.request("/chains/private-chain/entries", {
        headers: authHeader("tenant-a"),
      });
      expect(listRes.status).toBe(404);

      // Tenant A tries validation
      const validateRes = await app.request("/chains/private-chain/validate", {
        method: "POST",
        headers: authHeader("tenant-a"),
      });
      expect(validateRes.status).toBe(404);
    });

    it("tenant A cannot access tenant B certificates by guessing certificate IDs", async () => {
      const certId = crypto.randomUUID();

      // Tenant B creates a certificate
      await app.request("/certificates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("tenant-b"),
        },
        body: JSON.stringify({
          certificateId: certId,
          timestamp: new Date().toISOString(),
          modelId: "gpt-4o",
          modelProvider: "openai",
          claims: [{ claimId: "c1", statement: "test", supportingEvidenceIds: [] }],
          supportingEvidence: [],
          unsupportedClaims: [],
          assumptions: [],
          limitations: [],
          confidenceAssessment: { level: "high", score: 0.9, rationale: "test" },
        }),
      });

      // Tenant A tries to read it
      const getRes = await app.request(`/certificates/${certId}`, {
        headers: authHeader("tenant-a"),
      });
      expect(getRes.status).toBe(404);

      // Tenant A tries to verify it
      const verifyRes = await app.request(`/certificates/${certId}/verify`, {
        method: "POST",
        headers: authHeader("tenant-a"),
      });
      expect(verifyRes.status).toBe(404);
    });

    it("tenant A cannot generate reports from tenant B chains", async () => {
      // Tenant B creates entries
      await app.request("/chains/b-report-chain/entries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("tenant-b"),
        },
        body: JSON.stringify({
          entryId: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          entryType: "ai_decision",
        }),
      });

      // Tenant A tries to generate report for that chain
      const reportRes = await app.request(
        "/reports/colorado-sb205?chainId=b-report-chain",
        { headers: authHeader("tenant-a") },
      );
      expect(reportRes.status).toBe(404);
    });
  });

  describe("response timing consistency", () => {
    it("responds in similar time for valid and invalid tokens to prevent timing attacks", async () => {
      const iterations = 20;
      const validTimes: Array<number> = [];
      const invalidTimes: Array<number> = [];

      for (let i = 0; i < iterations; i++) {
        // Valid token (but no data to return)
        const validStart = performance.now();
        await app.request("/chains", {
          headers: authHeader(TENANT),
        });
        validTimes.push(performance.now() - validStart);

        // Invalid token (signed with wrong secret)
        const invalidStart = performance.now();
        await app.request("/chains", {
          headers: authHeader(TENANT, WRONG_SECRET),
        });
        invalidTimes.push(performance.now() - invalidStart);
      }

      const validMedian = validTimes.sort((a, b) => a - b)[Math.floor(iterations / 2)] ?? 0;
      const invalidMedian = invalidTimes.sort((a, b) => a - b)[Math.floor(iterations / 2)] ?? 0;

      // The median times should be within 10ms of each other
      // (timingSafeEqual in the JWT implementation prevents timing leaks)
      expect(Math.abs(validMedian - invalidMedian)).toBeLessThan(10);
    });
  });
});

describe("Authentication integration (API key mode)", () => {
  let handle: SqliteAdapterHandle;
  let app: Hono;
  const VALID_KEY = "test-api-key-12345";

  beforeEach(() => {
    handle = createSqliteAdapter();
    app = createApp({
      storage: handle.adapter,
      apiKeys: [VALID_KEY],
    });
  });

  afterEach(() => {
    handle.close();
  });

  it("accepts valid API key", async () => {
    const res = await app.request("/chains", {
      headers: { Authorization: `Bearer ${VALID_KEY}` },
    });
    expect(res.status).toBe(200);
  });

  it("rejects invalid API key with 403", async () => {
    const res = await app.request("/chains", {
      headers: { Authorization: "Bearer wrong-key" },
    });
    expect(res.status).toBe(403);
  });

  it("rejects missing API key with 401", async () => {
    const res = await app.request("/chains");
    expect(res.status).toBe(401);
  });

  it("accepts API key without Bearer prefix", async () => {
    const res = await app.request("/chains", {
      headers: { Authorization: VALID_KEY },
    });
    expect(res.status).toBe(200);
  });
});

describe("Authentication integration (no-auth mode)", () => {
  let handle: SqliteAdapterHandle;
  let app: Hono;

  beforeEach(() => {
    handle = createSqliteAdapter();
    app = createApp({ storage: handle.adapter });
  });

  afterEach(() => {
    handle.close();
  });

  it("allows unauthenticated access when no API keys configured", async () => {
    const res = await app.request("/chains");
    expect(res.status).toBe(200);
  });

  it("allows entry creation without authentication", async () => {
    const res = await app.request("/chains/open-chain/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
      }),
    });
    expect(res.status).toBe(201);
  });
});
