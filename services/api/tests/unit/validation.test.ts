import { describe, it, expect } from "vitest";
import { createInMemoryAdapter } from "@gridseal/core";
import { createApp } from "../../src/app.js";

function makeApp() {
  return createApp({ storage: createInMemoryAdapter() });
}

describe("Request validation", () => {
  it("rejects entry with invalid entryType", async () => {
    const app = makeApp();
    const res = await app.request("/chains/test/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "invalid_type",
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { details: Array<{ path: string }> };
    expect(body.details.some((d) => d.path === "entryType")).toBe(true);
  });

  it("rejects entry with invalid timestamp format", async () => {
    const app = makeApp();
    const res = await app.request("/chains/test/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: crypto.randomUUID(),
        timestamp: "not-a-date",
        entryType: "ai_decision",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects entry with invalid inputHash (not 64 hex chars)", async () => {
    const app = makeApp();
    const res = await app.request("/chains/test/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        inputHash: "tooshort",
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects entry with confidenceScore out of range", async () => {
    const app = makeApp();
    const res = await app.request("/chains/test/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        confidenceScore: 1.5,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects entry with negative token count", async () => {
    const app = makeApp();
    const res = await app.request("/chains/test/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entryId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        entryType: "ai_decision",
        inputTokenCount: -1,
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects certificate with invalid confidence level", async () => {
    const app = makeApp();
    const res = await app.request("/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        certificateId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        modelId: "test",
        modelProvider: "test",
        claims: [],
        supportingEvidence: [],
        unsupportedClaims: [],
        assumptions: [],
        limitations: [],
        confidenceAssessment: {
          level: "super_high",
          score: 0.99,
          rationale: "test",
        },
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects provenance with invalid model type", async () => {
    const app = makeApp();
    const res = await app.request("/provenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provenanceId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        bomVersion: "1.7",
        modelName: "test",
        modelVersion: "1.0",
        modelType: "invalid_type",
        modelProvider: "test",
        modelDescription: null,
        modelAuthor: null,
        modelLicense: null,
        trainingDatasets: [],
        performanceMetrics: [],
        ethicalConsiderations: [],
        externalReferences: [],
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects invalid pagination parameters", async () => {
    const app = makeApp();
    const entryBody = {
      entryId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      entryType: "ai_decision",
    };
    await app.request("/chains/test/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entryBody),
    });
    const res = await app.request("/chains/test/entries?limit=-5");
    expect(res.status).toBe(400);
  });
});
