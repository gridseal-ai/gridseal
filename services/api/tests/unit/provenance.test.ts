import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "@gridseal/core";
import type { StorageAdapter } from "@gridseal/core";
import { createApp } from "../../src/app.js";
import type { Hono } from "hono";

function makeProvenanceBody(overrides: Record<string, unknown> = {}) {
  return {
    provenanceId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    bomVersion: "1.7",
    modelName: "GPT-4o",
    modelVersion: "2024-05-13",
    modelType: "generative" as const,
    modelProvider: "OpenAI",
    modelDescription: "Large language model for general-purpose text generation",
    modelAuthor: "OpenAI",
    modelLicense: "proprietary",
    trainingDatasets: [
      {
        datasetId: "ds-1",
        name: "WebText",
        version: "2.0",
        source: null,
        description: "Web-scraped text corpus",
      },
    ],
    performanceMetrics: [
      {
        metricId: "metric-1",
        name: "accuracy",
        value: 0.94,
        slice: null,
        confidenceInterval: { lower: 0.92, upper: 0.96 },
      },
    ],
    ethicalConsiderations: [
      {
        category: "fairness",
        description: "Model may exhibit bias present in training data",
        mitigationStrategy: "RLHF alignment and output filtering",
      },
    ],
    externalReferences: [
      {
        referenceType: "documentation",
        url: "https://platform.openai.com/docs",
        description: "API documentation",
      },
    ],
    ...overrides,
  };
}

describe("Provenance routes", () => {
  let app: Hono;
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
    app = createApp({ storage });
  });

  describe("POST /provenance", () => {
    it("creates a provenance record and returns 201 with computed hash", async () => {
      const body = makeProvenanceBody();
      const res = await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(201);
      const data = (await res.json()) as {
        provenance: {
          provenanceId: string;
          provenanceHash: string;
        };
      };
      expect(data.provenance.provenanceId).toBe(body.provenanceId);
      expect(data.provenance.provenanceHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("rejects duplicate provenance IDs with 409", async () => {
      const body = makeProvenanceBody();
      await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(409);
    });

    it("rejects invalid body with 400", async () => {
      const res = await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provenanceId: "bad" }),
      });
      expect(res.status).toBe(400);
    });

    it("creates provenance with minimal optional fields as null", async () => {
      const body = makeProvenanceBody({
        modelDescription: null,
        modelAuthor: null,
        modelLicense: null,
        trainingDatasets: [],
        performanceMetrics: [],
        ethicalConsiderations: [],
        externalReferences: [],
      });
      const res = await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(201);
    });
  });

  describe("GET /provenance/:provenanceId", () => {
    it("retrieves a stored provenance record", async () => {
      const body = makeProvenanceBody();
      await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await app.request(`/provenance/${body.provenanceId}`);
      expect(res.status).toBe(200);
      const data = (await res.json()) as {
        provenance: { provenanceId: string; modelName: string };
      };
      expect(data.provenance.provenanceId).toBe(body.provenanceId);
      expect(data.provenance.modelName).toBe("GPT-4o");
    });

    it("returns 404 for nonexistent provenance record", async () => {
      const res = await app.request(`/provenance/${crypto.randomUUID()}`);
      expect(res.status).toBe(404);
    });
  });

  describe("POST /provenance/:provenanceId/verify", () => {
    it("verifies a valid provenance record", async () => {
      const body = makeProvenanceBody();
      await app.request("/provenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const res = await app.request(
        `/provenance/${body.provenanceId}/verify`,
        { method: "POST" }
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as { valid: boolean };
      expect(data.valid).toBe(true);
    });

    it("returns 404 for nonexistent provenance", async () => {
      const res = await app.request(
        `/provenance/${crypto.randomUUID()}/verify`,
        { method: "POST" }
      );
      expect(res.status).toBe(404);
    });
  });
});
