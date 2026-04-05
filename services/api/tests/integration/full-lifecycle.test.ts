import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTenantApp } from "../../src/app.js";
import { createTenantSqliteAdapter } from "../../src/db/tenant-sqlite-adapter.js";
import { createTenantToken } from "../../src/jwt.js";
import type { Hono } from "hono";
import type { TenantSqliteHandle } from "../../src/db/tenant-sqlite-adapter.js";

const JWT_SECRET = "lifecycle-test-secret";
const TENANT = "lifecycle-tenant";

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

function postEntry(
  app: Hono,
  chainId: string,
  tenantId: string,
  body?: Record<string, unknown>,
) {
  return app.request(`/chains/${chainId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(tenantId) },
    body: JSON.stringify(makeEntryBody(body)),
  });
}

describe("Full lifecycle integration", () => {
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

  it("completes the full lifecycle: append 100 entries, query with filters, verify chain, generate report", async () => {
    const chainId = "lifecycle-chain";
    const models = ["gpt-4o", "claude-3-opus", "gemini-pro"];
    const actors = ["user-1", "user-2", "agent-1"];
    const sessions = ["session-alpha", "session-beta"];
    const entryIds: Array<string> = [];

    // Append 100 entries with varied metadata
    for (let i = 0; i < 100; i++) {
      const entryId = crypto.randomUUID();
      entryIds.push(entryId);
      const res = await postEntry(app, chainId, TENANT, {
        entryId,
        modelId: models[i % models.length],
        modelProvider: i % 2 === 0 ? "openai" : "anthropic",
        inputHash: "a".repeat(64),
        outputHash: "b".repeat(64),
        inputTokenCount: 100 + i,
        outputTokenCount: 200 + i,
        decisionType: "generation",
        confidenceScore: 0.5 + (i % 50) * 0.01,
        sessionId: sessions[i % sessions.length],
        actorId: actors[i % actors.length],
        tags: { index: String(i) },
      });
      expect(res.status).toBe(201);
    }

    // Verify chain integrity
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
    expect(validateBody.entryCount).toBe(100);

    // Query: filter by modelId
    const modelRes = await app.request(
      `/chains/${chainId}/entries?modelId=gpt-4o`,
      { headers: authHeader(TENANT) },
    );
    expect(modelRes.status).toBe(200);
    const modelBody = (await modelRes.json()) as {
      entries: Array<{ modelId: string }>;
      total: number;
    };
    // gpt-4o at index 0,3,6,...,99 => ceil(100/3) = 34
    expect(modelBody.total).toBe(34);
    for (const entry of modelBody.entries) {
      expect(entry.modelId).toBe("gpt-4o");
    }

    // Query: filter by actorId
    const actorRes = await app.request(
      `/chains/${chainId}/entries?actorId=user-1`,
      { headers: authHeader(TENANT) },
    );
    expect(actorRes.status).toBe(200);
    const actorBody = (await actorRes.json()) as { total: number };
    // user-1 at index 0,3,6,...,99 => 34
    expect(actorBody.total).toBe(34);

    // Query: filter by sessionId
    const sessionRes = await app.request(
      `/chains/${chainId}/entries?sessionId=session-alpha`,
      { headers: authHeader(TENANT) },
    );
    expect(sessionRes.status).toBe(200);
    const sessionBody = (await sessionRes.json()) as { total: number };
    // session-alpha at even indices => 50
    expect(sessionBody.total).toBe(50);

    // Query: pagination
    const page1 = await app.request(
      `/chains/${chainId}/entries?offset=0&limit=25`,
      { headers: authHeader(TENANT) },
    );
    const page1Body = (await page1.json()) as {
      entries: Array<{ sequenceNumber: number }>;
      total: number;
      offset: number;
      limit: number;
    };
    expect(page1Body.entries).toHaveLength(25);
    expect(page1Body.total).toBe(100);
    expect(page1Body.offset).toBe(0);
    expect(page1Body.limit).toBe(25);
    expect(page1Body.entries[0]?.sequenceNumber).toBe(0);

    const page4 = await app.request(
      `/chains/${chainId}/entries?offset=75&limit=25`,
      { headers: authHeader(TENANT) },
    );
    const page4Body = (await page4.json()) as {
      entries: Array<{ sequenceNumber: number }>;
      total: number;
    };
    expect(page4Body.entries).toHaveLength(25);
    expect(page4Body.entries[0]?.sequenceNumber).toBe(75);

    // Beyond end returns empty page
    const pageBeyond = await app.request(
      `/chains/${chainId}/entries?offset=100&limit=25`,
      { headers: authHeader(TENANT) },
    );
    const pageBeyondBody = (await pageBeyond.json()) as {
      entries: Array<unknown>;
      total: number;
    };
    expect(pageBeyondBody.entries).toHaveLength(0);
    expect(pageBeyondBody.total).toBe(100);

    // Retrieve specific entry by ID
    const targetId = entryIds[42];
    const entryRes = await app.request(
      `/chains/${chainId}/entries/${targetId}`,
      { headers: authHeader(TENANT) },
    );
    expect(entryRes.status).toBe(200);
    const entryBody = (await entryRes.json()) as {
      entry: { entryId: string; sequenceNumber: number; chainId: string };
    };
    expect(entryBody.entry.entryId).toBe(targetId);
    expect(entryBody.entry.sequenceNumber).toBe(42);
    expect(entryBody.entry.chainId).toBe(chainId);

    // Validate individual entry
    const singleValidateRes = await app.request(
      `/chains/${chainId}/entries/${targetId}/validate`,
      { method: "POST", headers: authHeader(TENANT) },
    );
    expect(singleValidateRes.status).toBe(200);
    const singleValidateBody = (await singleValidateRes.json()) as {
      valid: boolean;
      entryId: string;
    };
    expect(singleValidateBody.valid).toBe(true);
    expect(singleValidateBody.entryId).toBe(targetId);

    // Generate compliance report
    const reportRes = await app.request(
      `/reports/colorado-sb205?chainId=${chainId}`,
      { headers: authHeader(TENANT) },
    );
    expect(reportRes.status).toBe(200);
    const reportBody = (await reportRes.json()) as {
      report: {
        chainIntegrity: { valid: boolean };
        statistics: { totalEntries: number };
        regulationSummaries: Array<{ regulationId: string }>;
      };
    };
    expect(reportBody.report.chainIntegrity.valid).toBe(true);
    expect(reportBody.report.statistics.totalEntries).toBe(100);
    expect(reportBody.report.regulationSummaries).toHaveLength(1);
    expect(reportBody.report.regulationSummaries[0]?.regulationId).toBe(
      "colorado-sb205",
    );

    // List regulations
    const regRes = await app.request("/reports", {
      headers: authHeader(TENANT),
    });
    expect(regRes.status).toBe(200);
    const regBody = (await regRes.json()) as {
      regulations: Array<string>;
    };
    expect(regBody.regulations).toContain("colorado-sb205");
    expect(regBody.regulations.length).toBeGreaterThanOrEqual(4);

    // List chains
    const chainsRes = await app.request("/chains", {
      headers: authHeader(TENANT),
    });
    expect(chainsRes.status).toBe(200);
    const chainsBody = (await chainsRes.json()) as {
      chains: Array<{ chainId: string; entryCount: number }>;
    };
    expect(chainsBody.chains).toHaveLength(1);
    expect(chainsBody.chains[0]?.chainId).toBe(chainId);
    expect(chainsBody.chains[0]?.entryCount).toBe(100);
  });

  it("creates and verifies certificates and provenance records linked to entries", async () => {
    const chainId = "cert-prov-chain";
    const certId = crypto.randomUUID();
    const provId = crypto.randomUUID();

    // Create a provenance record
    const provRes = await app.request("/provenance", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(TENANT) },
      body: JSON.stringify({
        provenanceId: provId,
        timestamp: new Date().toISOString(),
        bomVersion: "1.7",
        modelName: "GPT-4o",
        modelVersion: "2025-03-01",
        modelType: "generative",
        modelProvider: "openai",
        modelDescription: "Large language model",
        modelAuthor: null,
        modelLicense: "proprietary",
        trainingDatasets: [
          {
            datasetId: "ds1",
            name: "WebText",
            version: "2.0",
            source: null,
            description: "Web text corpus",
          },
        ],
        performanceMetrics: [
          {
            metricId: "m1",
            name: "accuracy",
            value: 0.92,
            slice: null,
            confidenceInterval: { lower: 0.89, upper: 0.95 },
          },
        ],
        ethicalConsiderations: [
          {
            category: "bias",
            description: "Evaluated for demographic bias",
            mitigationStrategy: "RLHF debiasing",
          },
        ],
        externalReferences: [
          {
            referenceType: "paper",
            url: "https://example.com/paper",
            description: "Model paper",
          },
        ],
      }),
    });
    expect(provRes.status).toBe(201);

    // Verify provenance hash
    const provVerifyRes = await app.request(`/provenance/${provId}/verify`, {
      method: "POST",
      headers: authHeader(TENANT),
    });
    expect(provVerifyRes.status).toBe(200);
    const provVerifyBody = (await provVerifyRes.json()) as { valid: boolean };
    expect(provVerifyBody.valid).toBe(true);

    // Create a reasoning certificate
    const certRes = await app.request("/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(TENANT) },
      body: JSON.stringify({
        certificateId: certId,
        timestamp: new Date().toISOString(),
        modelId: "gpt-4o",
        modelProvider: "openai",
        claims: [
          {
            claimId: "c1",
            statement: "The patient shows elevated risk",
            supportingEvidenceIds: ["e1", "e2"],
          },
          {
            claimId: "c2",
            statement: "Treatment A is recommended",
            supportingEvidenceIds: ["e1"],
          },
        ],
        supportingEvidence: [
          {
            evidenceId: "e1",
            evidenceType: "data",
            description: "Lab results from 2025-01-15",
            source: "EMR system",
          },
          {
            evidenceId: "e2",
            evidenceType: "literature",
            description: "Clinical study ref 42",
            source: null,
          },
        ],
        unsupportedClaims: [
          {
            statement: "Full recovery expected within 3 months",
            reason: "Insufficient longitudinal data",
          },
        ],
        assumptions: [
          { statement: "Patient history is complete", criticality: "high" },
          { statement: "No drug interactions", criticality: "medium" },
        ],
        limitations: [
          { description: "Limited to adult population", impact: "Moderate" },
        ],
        confidenceAssessment: {
          level: "high",
          score: 0.88,
          rationale: "Strong evidence base with minor gaps",
        },
      }),
    });
    expect(certRes.status).toBe(201);

    // Verify certificate hash
    const certVerifyRes = await app.request(
      `/certificates/${certId}/verify`,
      { method: "POST", headers: authHeader(TENANT) },
    );
    expect(certVerifyRes.status).toBe(200);
    const certVerifyBody = (await certVerifyRes.json()) as { valid: boolean };
    expect(certVerifyBody.valid).toBe(true);

    // Create entries that reference the certificate and provenance
    for (let i = 0; i < 5; i++) {
      const res = await postEntry(app, chainId, TENANT, {
        modelId: "gpt-4o",
        modelProvider: "openai",
        reasoningCertificateId: certId,
        provenanceId: provId,
        inputHash: "a".repeat(64),
        outputHash: "b".repeat(64),
        decisionType: "generation",
        confidenceScore: 0.88,
      });
      expect(res.status).toBe(201);
    }

    // Validate chain with linked records
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
    expect(validateBody.entryCount).toBe(5);

    // Retrieve and verify certificate data round-trips
    const getCertRes = await app.request(`/certificates/${certId}`, {
      headers: authHeader(TENANT),
    });
    expect(getCertRes.status).toBe(200);
    const getCertBody = (await getCertRes.json()) as {
      certificate: {
        certificateId: string;
        claims: Array<{ claimId: string }>;
        unsupportedClaims: Array<{ statement: string }>;
        assumptions: Array<{ statement: string }>;
      };
    };
    expect(getCertBody.certificate.certificateId).toBe(certId);
    expect(getCertBody.certificate.claims).toHaveLength(2);
    expect(getCertBody.certificate.unsupportedClaims).toHaveLength(1);
    expect(getCertBody.certificate.assumptions).toHaveLength(2);

    // Retrieve and verify provenance data round-trips
    const getProvRes = await app.request(`/provenance/${provId}`, {
      headers: authHeader(TENANT),
    });
    expect(getProvRes.status).toBe(200);
    const getProvBody = (await getProvRes.json()) as {
      provenance: {
        provenanceId: string;
        trainingDatasets: Array<{ datasetId: string }>;
        performanceMetrics: Array<{ metricId: string }>;
        ethicalConsiderations: Array<{ category: string }>;
      };
    };
    expect(getProvBody.provenance.provenanceId).toBe(provId);
    expect(getProvBody.provenance.trainingDatasets).toHaveLength(1);
    expect(getProvBody.provenance.performanceMetrics).toHaveLength(1);
    expect(getProvBody.provenance.ethicalConsiderations).toHaveLength(1);
  });

  it("builds and queries parent-child tree structures across a chain", async () => {
    const chainId = "tree-chain";

    // Create root entry
    const rootId = crypto.randomUUID();
    const rootRes = await postEntry(app, chainId, TENANT, { entryId: rootId });
    expect(rootRes.status).toBe(201);

    // Create 3 children of root
    const childIds: Array<string> = [];
    for (let i = 0; i < 3; i++) {
      const childId = crypto.randomUUID();
      childIds.push(childId);
      const res = await postEntry(app, chainId, TENANT, {
        entryId: childId,
        parentEntryId: rootId,
      });
      expect(res.status).toBe(201);
    }

    // Create 2 grandchildren of first child
    const grandchildIds: Array<string> = [];
    for (let i = 0; i < 2; i++) {
      const gcId = crypto.randomUUID();
      grandchildIds.push(gcId);
      const res = await postEntry(app, chainId, TENANT, {
        entryId: gcId,
        parentEntryId: childIds[0],
      });
      expect(res.status).toBe(201);
    }

    // Get children of root
    const childrenRes = await app.request(
      `/chains/${chainId}/entries/${rootId}/children`,
      { headers: authHeader(TENANT) },
    );
    expect(childrenRes.status).toBe(200);
    const childrenBody = (await childrenRes.json()) as {
      children: Array<{ entryId: string }>;
    };
    expect(childrenBody.children).toHaveLength(3);
    const returnedChildIds = childrenBody.children.map((c) => c.entryId);
    for (const cid of childIds) {
      expect(returnedChildIds).toContain(cid);
    }

    // Get subtree from root
    const subtreeRes = await app.request(
      `/chains/${chainId}/entries/${rootId}/subtree`,
      { headers: authHeader(TENANT) },
    );
    expect(subtreeRes.status).toBe(200);
    const subtreeBody = (await subtreeRes.json()) as {
      rootEntryId: string;
      entries: Array<{ entryId: string }>;
    };
    expect(subtreeBody.rootEntryId).toBe(rootId);
    // Subtree includes root + 3 children + 2 grandchildren = 6
    expect(subtreeBody.entries).toHaveLength(6);

    // Get subtree from first child: first child + 2 grandchildren = 3
    const childSubtreeRes = await app.request(
      `/chains/${chainId}/entries/${childIds[0]}/subtree`,
      { headers: authHeader(TENANT) },
    );
    expect(childSubtreeRes.status).toBe(200);
    const childSubtreeBody = (await childSubtreeRes.json()) as {
      entries: Array<{ entryId: string }>;
    };
    expect(childSubtreeBody.entries).toHaveLength(3);

    // Validate subtree
    const validateSubtreeRes = await app.request(
      `/chains/${chainId}/subtree/${rootId}/validate`,
      { method: "POST", headers: authHeader(TENANT) },
    );
    expect(validateSubtreeRes.status).toBe(200);
    const validateSubtreeBody = (await validateSubtreeRes.json()) as {
      valid: boolean;
    };
    expect(validateSubtreeBody.valid).toBe(true);

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
    expect(validateBody.entryCount).toBe(6);
  });

  it("filters entries by date range correctly", async () => {
    const chainId = "date-filter-chain";

    // Create entries with specific timestamps spread over multiple days
    const baseDate = new Date("2025-03-01T00:00:00.000Z");
    for (let i = 0; i < 30; i++) {
      const timestamp = new Date(
        baseDate.getTime() + i * 24 * 60 * 60 * 1000,
      ).toISOString();
      const res = await postEntry(app, chainId, TENANT, {
        timestamp,
        modelId: "gpt-4o",
      });
      expect(res.status).toBe(201);
    }

    // Filter: first 10 days (2025-03-01 to 2025-03-10)
    const dateRes = await app.request(
      `/chains/${chainId}/entries?startDate=2025-03-01T00:00:00.000Z&endDate=2025-03-10T23:59:59.999Z`,
      { headers: authHeader(TENANT) },
    );
    expect(dateRes.status).toBe(200);
    const dateBody = (await dateRes.json()) as { total: number };
    expect(dateBody.total).toBe(10);

    // Filter: last 5 days (2025-03-26 to 2025-03-30)
    const endRes = await app.request(
      `/chains/${chainId}/entries?startDate=2025-03-26T00:00:00.000Z&endDate=2025-03-30T23:59:59.999Z`,
      { headers: authHeader(TENANT) },
    );
    expect(endRes.status).toBe(200);
    const endBody = (await endRes.json()) as { total: number };
    expect(endBody.total).toBe(5);

    // Combined filter: date range + modelId
    const combinedRes = await app.request(
      `/chains/${chainId}/entries?startDate=2025-03-01T00:00:00.000Z&endDate=2025-03-05T23:59:59.999Z&modelId=gpt-4o`,
      { headers: authHeader(TENANT) },
    );
    expect(combinedRes.status).toBe(200);
    const combinedBody = (await combinedRes.json()) as { total: number };
    expect(combinedBody.total).toBe(5);
  });

  it("generates compliance reports for all available regulations", async () => {
    const chainId = "all-regs-chain";

    // Seed with entries
    for (let i = 0; i < 10; i++) {
      await postEntry(app, chainId, TENANT, {
        modelId: "gpt-4o",
        modelProvider: "openai",
        inputHash: "a".repeat(64),
        outputHash: "b".repeat(64),
        decisionType: "generation",
      });
    }

    // List all regulation IDs
    const regRes = await app.request("/reports", {
      headers: authHeader(TENANT),
    });
    const regBody = (await regRes.json()) as { regulations: Array<string> };

    // Generate report for each
    for (const regId of regBody.regulations) {
      const reportRes = await app.request(
        `/reports/${regId}?chainId=${chainId}`,
        { headers: authHeader(TENANT) },
      );
      expect(reportRes.status).toBe(200);
      const reportBody = (await reportRes.json()) as {
        report: {
          chainIntegrity: { valid: boolean };
          statistics: { totalEntries: number };
        };
      };
      expect(reportBody.report.chainIntegrity.valid).toBe(true);
      expect(reportBody.report.statistics.totalEntries).toBe(10);
    }

    // Unknown regulation returns 404
    const unknownRes = await app.request(
      `/reports/fake-regulation?chainId=${chainId}`,
      { headers: authHeader(TENANT) },
    );
    expect(unknownRes.status).toBe(404);
  });

  it("returns 404 for non-existent chains and entries", async () => {
    const headers = authHeader(TENANT);

    // Non-existent chain
    const chainRes = await app.request("/chains/nonexistent", { headers });
    expect(chainRes.status).toBe(404);

    // Non-existent entry
    const entryRes = await app.request(
      `/chains/nonexistent/entries/${crypto.randomUUID()}`,
      { headers },
    );
    expect(entryRes.status).toBe(404);

    // Validate non-existent chain
    const validateRes = await app.request("/chains/nonexistent/validate", {
      method: "POST",
      headers,
    });
    expect(validateRes.status).toBe(404);

    // Non-existent certificate
    const certRes = await app.request(
      `/certificates/${crypto.randomUUID()}`,
      { headers },
    );
    expect(certRes.status).toBe(404);

    // Non-existent provenance
    const provRes = await app.request(
      `/provenance/${crypto.randomUUID()}`,
      { headers },
    );
    expect(provRes.status).toBe(404);
  });
});
