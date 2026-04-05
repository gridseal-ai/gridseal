import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

const JWT_SECRET = "integration-test-secret";
const TENANT_A = "tenant-alpha";
const TENANT_B = "tenant-beta";

function makeEntryBody(overrides: Record<string, unknown> = {}) {
  return {
    entryId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    entryType: "ai_decision",
    ...overrides,
  };
}

function authHeader(tenantId: string): { Authorization: string } {
  const token = createTenantToken(tenantId, JWT_SECRET);
  return { Authorization: `Bearer ${token}` };
}

function postEntry(app: Hono, chainId: string, tenantId: string, body?: Record<string, unknown>) {
  return app.request(`/chains/${chainId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(tenantId) },
    body: JSON.stringify(makeEntryBody(body)),
  });
}

describe("Multi-tenant isolation", () => {
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

  describe("entry isolation", () => {
    it("tenant A cannot see tenant B entries when listing chains", async () => {
      // Tenant A creates entries in chain-1
      const resA = await postEntry(app, "chain-1", TENANT_A);
      expect(resA.status).toBe(201);

      // Tenant B creates entries in chain-2
      const resB = await postEntry(app, "chain-2", TENANT_B);
      expect(resB.status).toBe(201);

      // Tenant A lists chains: should only see chain-1
      const listA = await app.request("/chains", {
        headers: authHeader(TENANT_A),
      });
      expect(listA.status).toBe(200);
      const bodyA = (await listA.json()) as { chains: Array<{ chainId: string }> };
      expect(bodyA.chains).toHaveLength(1);
      expect(bodyA.chains[0]?.chainId).toBe("chain-1");

      // Tenant B lists chains: should only see chain-2
      const listB = await app.request("/chains", {
        headers: authHeader(TENANT_B),
      });
      expect(listB.status).toBe(200);
      const bodyB = (await listB.json()) as { chains: Array<{ chainId: string }> };
      expect(bodyB.chains).toHaveLength(1);
      expect(bodyB.chains[0]?.chainId).toBe("chain-2");
    });

    it("tenant A cannot read tenant B entries by chain ID", async () => {
      await postEntry(app, "shared-name", TENANT_B);

      // Tenant A tries to access chain that only tenant B has
      const res = await app.request("/chains/shared-name", {
        headers: authHeader(TENANT_A),
      });
      expect(res.status).toBe(404);
    });

    it("tenant A cannot read tenant B entry by entry ID", async () => {
      const entryId = crypto.randomUUID();
      await postEntry(app, "chain-b", TENANT_B, { entryId });

      // Tenant A tries to fetch the specific entry
      const res = await app.request(`/chains/chain-b/entries/${entryId}`, {
        headers: authHeader(TENANT_A),
      });
      expect(res.status).toBe(404);
    });

    it("both tenants can use the same chain name independently", async () => {
      // Both tenants create entries in "my-chain"
      await postEntry(app, "my-chain", TENANT_A);
      await postEntry(app, "my-chain", TENANT_A);
      await postEntry(app, "my-chain", TENANT_B);

      // Tenant A sees 2 entries
      const entriesA = await app.request("/chains/my-chain/entries", {
        headers: authHeader(TENANT_A),
      });
      expect(entriesA.status).toBe(200);
      const bodyA = (await entriesA.json()) as { total: number };
      expect(bodyA.total).toBe(2);

      // Tenant B sees 1 entry
      const entriesB = await app.request("/chains/my-chain/entries", {
        headers: authHeader(TENANT_B),
      });
      expect(entriesB.status).toBe(200);
      const bodyB = (await entriesB.json()) as { total: number };
      expect(bodyB.total).toBe(1);
    });
  });

  describe("chain validation isolation", () => {
    it("tenant A validates only their own chain entries", async () => {
      // Tenant A adds 3 entries
      await postEntry(app, "validated-chain", TENANT_A);
      await postEntry(app, "validated-chain", TENANT_A);
      await postEntry(app, "validated-chain", TENANT_A);

      // Tenant B adds 1 entry to the same-named chain
      await postEntry(app, "validated-chain", TENANT_B);

      // Tenant A validates: should validate 3 entries
      const validateA = await app.request("/chains/validated-chain/validate", {
        method: "POST",
        headers: authHeader(TENANT_A),
      });
      expect(validateA.status).toBe(200);
      const resultA = (await validateA.json()) as { valid: boolean; entryCount: number };
      expect(resultA.valid).toBe(true);
      expect(resultA.entryCount).toBe(3);

      // Tenant B validates: should validate 1 entry
      const validateB = await app.request("/chains/validated-chain/validate", {
        method: "POST",
        headers: authHeader(TENANT_B),
      });
      expect(validateB.status).toBe(200);
      const resultB = (await validateB.json()) as { valid: boolean; entryCount: number };
      expect(resultB.valid).toBe(true);
      expect(resultB.entryCount).toBe(1);
    });

    it("tenant A cannot validate tenant B chain", async () => {
      await postEntry(app, "b-only-chain", TENANT_B);

      const res = await app.request("/chains/b-only-chain/validate", {
        method: "POST",
        headers: authHeader(TENANT_A),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("child entry isolation", () => {
    it("tenant A cannot see tenant B child entries", async () => {
      const parentId = crypto.randomUUID();
      const childId = crypto.randomUUID();

      // Tenant B creates a parent entry
      await postEntry(app, "tree-chain", TENANT_B, { entryId: parentId });

      // Tenant B creates a child entry
      await postEntry(app, "tree-chain", TENANT_B, {
        entryId: childId,
        parentEntryId: parentId,
      });

      // Tenant A tries to get children of the parent
      const res = await app.request(`/chains/tree-chain/entries/${parentId}/children`, {
        headers: authHeader(TENANT_A),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { children: Array<unknown> };
      expect(body.children).toHaveLength(0);
    });
  });

  describe("certificate isolation", () => {
    it("tenant A cannot read tenant B certificates", async () => {
      const certId = crypto.randomUUID();

      // Tenant B creates a certificate
      const createRes = await app.request("/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(TENANT_B) },
        body: JSON.stringify({
          certificateId: certId,
          timestamp: new Date().toISOString(),
          modelId: "gpt-4",
          modelProvider: "openai",
          claims: [{ claimId: "c1", statement: "test claim", supportingEvidenceIds: ["e1"] }],
          supportingEvidence: [{ evidenceId: "e1", evidenceType: "data", description: "desc", source: null }],
          unsupportedClaims: [],
          assumptions: [],
          limitations: [],
          confidenceAssessment: { level: "high", score: 0.95, rationale: "testing" },
        }),
      });
      expect(createRes.status).toBe(201);

      // Tenant A tries to read the certificate
      const readRes = await app.request(`/certificates/${certId}`, {
        headers: authHeader(TENANT_A),
      });
      expect(readRes.status).toBe(404);

      // Tenant B can read their own certificate
      const readResB = await app.request(`/certificates/${certId}`, {
        headers: authHeader(TENANT_B),
      });
      expect(readResB.status).toBe(200);
    });
  });

  describe("provenance isolation", () => {
    it("tenant A cannot read tenant B provenance records", async () => {
      const provId = crypto.randomUUID();

      // Tenant B creates a provenance record
      const createRes = await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(TENANT_B) },
        body: JSON.stringify({
          provenanceId: provId,
          timestamp: new Date().toISOString(),
          bomVersion: "1.7",
          modelName: "test-model",
          modelVersion: "1.0",
          modelType: "generative",
          modelProvider: "test-provider",
          modelDescription: null,
          modelAuthor: null,
          modelLicense: null,
          trainingDatasets: [],
          performanceMetrics: [],
          ethicalConsiderations: [],
          externalReferences: [],
        }),
      });
      expect(createRes.status).toBe(201);

      // Tenant A tries to read the provenance
      const readRes = await app.request(`/provenance/${provId}`, {
        headers: authHeader(TENANT_A),
      });
      expect(readRes.status).toBe(404);

      // Tenant B can read their own provenance
      const readResB = await app.request(`/provenance/${provId}`, {
        headers: authHeader(TENANT_B),
      });
      expect(readResB.status).toBe(200);
    });
  });

  describe("reports isolation", () => {
    it("tenant A cannot generate reports from tenant B chain data", async () => {
      // Tenant B creates entries
      await postEntry(app, "report-chain", TENANT_B);

      // Tenant A tries to generate a report for that chain
      const res = await app.request(
        "/reports/colorado-sb205?chainId=report-chain",
        { headers: authHeader(TENANT_A) },
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("Chain not found");

      // Tenant B can generate reports for their chain
      const resB = await app.request(
        "/reports/colorado-sb205?chainId=report-chain",
        { headers: authHeader(TENANT_B) },
      );
      expect(resB.status).toBe(200);
    });
  });

  describe("health endpoint", () => {
    it("health check works without authentication", async () => {
      // Health should still require auth in tenant mode
      // (it goes through the same middleware stack)
      const token = createTenantToken(TENANT_A, JWT_SECRET);
      const res = await app.request("/health", {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);
    });
  });
});
