import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSqliteAdapter } from "../../src/db/sqlite-adapter.js";
import type { SqliteAdapterHandle } from "../../src/db/sqlite-adapter.js";
import { createApp } from "../../src/app.js";
import type { Hono } from "hono";

function makeEntryBody(overrides: Record<string, unknown> = {}) {
  return {
    entryId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    entryType: "ai_decision",
    ...overrides,
  };
}

describe("SQLite storage adapter integration", () => {
  let handle: SqliteAdapterHandle;
  let app: Hono;

  beforeEach(() => {
    handle = createSqliteAdapter();
    app = createApp({ storage: handle.adapter });
  });

  afterEach(() => {
    handle.close();
  });

  describe("entry CRUD via API", () => {
    it("appends and retrieves an entry", async () => {
      const body = makeEntryBody();
      const createRes = await app.request("/chains/test-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(createRes.status).toBe(201);

      const getRes = await app.request(`/chains/test-chain/entries/${body.entryId}`);
      expect(getRes.status).toBe(200);
      const data = (await getRes.json()) as { entry: { entryId: string; chainId: string } };
      expect(data.entry.entryId).toBe(body.entryId);
      expect(data.entry.chainId).toBe("test-chain");
    });

    it("stores and retrieves entries with all fields", async () => {
      const body = makeEntryBody({
        modelId: "gpt-4o",
        modelProvider: "openai",
        inputHash: "a".repeat(64),
        outputHash: "b".repeat(64),
        inputTokenCount: 100,
        outputTokenCount: 200,
        decisionType: "generation",
        confidenceScore: 0.95,
        sessionId: "session-1",
        actorId: "user-1",
        policyIds: ["p1", "p2"],
        tags: { env: "test", tier: "premium" },
        annotation: "Test annotation",
        complianceMetadata: { rule: "colorado-sb205" },
      });

      await app.request("/chains/full-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const res = await app.request(`/chains/full-chain/entries/${body.entryId}`);
      const data = (await res.json()) as { entry: Record<string, unknown> };
      expect(data.entry["modelId"]).toBe("gpt-4o");
      expect(data.entry["modelProvider"]).toBe("openai");
      expect(data.entry["inputTokenCount"]).toBe(100);
      expect(data.entry["outputTokenCount"]).toBe(200);
      expect(data.entry["confidenceScore"]).toBe(0.95);
      expect(data.entry["sessionId"]).toBe("session-1");
      expect(data.entry["actorId"]).toBe("user-1");
      expect(data.entry["policyIds"]).toEqual(["p1", "p2"]);
      expect(data.entry["tags"]).toEqual({ env: "test", tier: "premium" });
      expect(data.entry["annotation"]).toBe("Test annotation");
      expect(data.entry["complianceMetadata"]).toEqual({ rule: "colorado-sb205" });
    });

    it("rejects duplicate entries", async () => {
      const body = makeEntryBody();
      await app.request("/chains/test-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await app.request("/chains/test-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(409);
    });

    it("lists chains correctly", async () => {
      await app.request("/chains/chain-a/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeEntryBody()),
      });
      await app.request("/chains/chain-b/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeEntryBody()),
      });

      const res = await app.request("/chains");
      const data = (await res.json()) as {
        chains: Array<{ chainId: string; entryCount: number }>;
      };
      expect(data.chains).toHaveLength(2);
      const ids = data.chains.map((c) => c.chainId).sort();
      expect(ids).toEqual(["chain-a", "chain-b"]);
    });
  });

  describe("chain validation", () => {
    it("validates a chain stored in SQLite", async () => {
      for (let i = 0; i < 5; i++) {
        await app.request("/chains/valid-chain/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeEntryBody()),
        });
      }

      const res = await app.request("/chains/valid-chain/validate", {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const data = (await res.json()) as { valid: boolean; entryCount: number };
      expect(data.valid).toBe(true);
      expect(data.entryCount).toBe(5);
    });
  });

  describe("pagination and filtering", () => {
    it("paginates entries from SQLite", async () => {
      for (let i = 0; i < 10; i++) {
        await app.request("/chains/paginated/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeEntryBody()),
        });
      }

      const res = await app.request("/chains/paginated/entries?offset=3&limit=4");
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        entries: Array<{ sequenceNumber: number }>;
        total: number;
      };
      expect(data.entries).toHaveLength(4);
      expect(data.entries[0]?.sequenceNumber).toBe(3);
      expect(data.total).toBe(10);
    });

    it("filters by modelId from SQLite", async () => {
      await app.request("/chains/filter-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeEntryBody({ modelId: "gpt-4o" })),
      });
      await app.request("/chains/filter-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeEntryBody({ modelId: "claude-3" })),
      });

      const res = await app.request("/chains/filter-chain/entries?modelId=gpt-4o");
      const data = (await res.json()) as { total: number };
      expect(data.total).toBe(1);
    });
  });

  describe("certificate round-trip", () => {
    it("stores and retrieves a certificate via the API", async () => {
      const certBody = {
        certificateId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        modelId: "gpt-4o",
        modelProvider: "openai",
        claims: [{ claimId: "c1", statement: "Result is accurate", supportingEvidenceIds: ["e1"] }],
        supportingEvidence: [{ evidenceId: "e1", evidenceType: "data", description: "Test data", source: null }],
        unsupportedClaims: [],
        assumptions: [{ statement: "Data is clean", criticality: "medium" }],
        limitations: [{ description: "Limited dataset", impact: "Low" }],
        confidenceAssessment: { level: "high", score: 0.85, rationale: "Strong evidence" },
      };

      const createRes = await app.request("/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(certBody),
      });
      expect(createRes.status).toBe(201);

      const getRes = await app.request(`/certificates/${certBody.certificateId}`);
      expect(getRes.status).toBe(200);
      const data = (await getRes.json()) as { certificate: { certificateId: string } };
      expect(data.certificate.certificateId).toBe(certBody.certificateId);
    });
  });

  describe("provenance round-trip", () => {
    it("stores and retrieves a provenance record via the API", async () => {
      const provBody = {
        provenanceId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        bomVersion: "1.7",
        modelName: "GPT-4o",
        modelVersion: "2025-03-01",
        modelType: "generative",
        modelProvider: "openai",
        modelDescription: "Large language model",
        modelAuthor: null,
        modelLicense: null,
        trainingDatasets: [],
        performanceMetrics: [],
        ethicalConsiderations: [],
        externalReferences: [],
      };

      const createRes = await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provBody),
      });
      expect(createRes.status).toBe(201);

      const getRes = await app.request(`/provenance/${provBody.provenanceId}`);
      expect(getRes.status).toBe(200);
      const data = (await getRes.json()) as { provenance: { provenanceId: string } };
      expect(data.provenance.provenanceId).toBe(provBody.provenanceId);
    });
  });

  describe("compliance reports with SQLite", () => {
    it("generates a compliance report from SQLite-stored entries", async () => {
      for (let i = 0; i < 3; i++) {
        await app.request("/chains/report-chain/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            makeEntryBody({
              modelId: "gpt-4o",
              modelProvider: "openai",
              inputHash: "a".repeat(64),
              outputHash: "b".repeat(64),
              decisionType: "generation",
            }),
          ),
        });
      }

      const res = await app.request("/reports/colorado-sb205?chainId=report-chain");
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        report: {
          chainIntegrity: { valid: boolean };
          statistics: { totalEntries: number };
        };
      };
      expect(data.report.chainIntegrity.valid).toBe(true);
      expect(data.report.statistics.totalEntries).toBe(3);
    });
  });

  describe("parent-child relationships", () => {
    it("stores and retrieves parent-child entries", async () => {
      const parent = makeEntryBody();
      await app.request("/chains/tree-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parent),
      });

      const child = makeEntryBody({ parentEntryId: parent.entryId });
      await app.request("/chains/tree-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(child),
      });

      const res = await app.request(`/chains/tree-chain/entries/${parent.entryId}/children`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        children: Array<{ entryId: string }>;
      };
      expect(data.children).toHaveLength(1);
      expect(data.children[0]?.entryId).toBe(child.entryId);
    });
  });
});
