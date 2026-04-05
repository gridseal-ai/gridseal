import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "@gridseal/core";
import type { StorageAdapter } from "@gridseal/core";
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

async function addEntry(app: Hono, chainId: string, overrides: Record<string, unknown> = {}) {
  const res = await app.request(`/chains/${chainId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(makeEntryBody(overrides)),
  });
  return res;
}

describe("Report routes", () => {
  let app: Hono;
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
    app = createApp({ storage });
  });

  describe("GET /reports", () => {
    it("lists available regulation IDs", async () => {
      const res = await app.request("/reports");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { regulations: ReadonlyArray<string> };
      expect(body.regulations).toContain("colorado-sb205");
      expect(body.regulations).toContain("nist-ai-rmf");
      expect(body.regulations).toContain("eu-ai-act");
      expect(body.regulations).toContain("hipaa-164-312-b");
    });
  });

  describe("GET /reports/:regulation", () => {
    it("returns 404 for unknown regulation", async () => {
      const res = await app.request("/reports/unknown-regulation?chainId=test");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string; available: ReadonlyArray<string> };
      expect(body.error).toContain("Unknown regulation");
      expect(body.available.length).toBeGreaterThan(0);
    });

    it("returns 400 when chainId is missing", async () => {
      const res = await app.request("/reports/colorado-sb205");
      expect(res.status).toBe(400);
    });

    it("returns 404 for nonexistent chain", async () => {
      const res = await app.request("/reports/colorado-sb205?chainId=nonexistent");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("Chain not found");
    });

    it("generates a compliance report for a valid chain", async () => {
      await addEntry(app, "my-chain", {
        modelId: "gpt-4o",
        modelProvider: "openai",
        inputHash: "a".repeat(64),
        outputHash: "b".repeat(64),
        decisionType: "generation",
        confidenceScore: 0.9,
      });
      await addEntry(app, "my-chain", {
        modelId: "gpt-4o",
        modelProvider: "openai",
        inputHash: "c".repeat(64),
        outputHash: "d".repeat(64),
      });

      const res = await app.request("/reports/colorado-sb205?chainId=my-chain");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        report: {
          reportId: string;
          chainId: string;
          chainIntegrity: { valid: boolean; totalEntries: number };
          regulationSummaries: ReadonlyArray<{ regulationId: string }>;
          statistics: { totalEntries: number };
        };
      };
      expect(body.report.chainId).toBe("my-chain");
      expect(body.report.chainIntegrity.valid).toBe(true);
      expect(body.report.chainIntegrity.totalEntries).toBe(2);
      expect(body.report.regulationSummaries).toHaveLength(1);
      expect(body.report.regulationSummaries[0]?.regulationId).toBe("colorado-sb205");
      expect(body.report.statistics.totalEntries).toBe(2);
    });

    it("generates reports for different regulations", async () => {
      await addEntry(app, "my-chain");

      const res1 = await app.request("/reports/nist-ai-rmf?chainId=my-chain");
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as {
        report: { regulationSummaries: ReadonlyArray<{ regulationId: string }> };
      };
      expect(body1.report.regulationSummaries[0]?.regulationId).toBe("nist-ai-rmf");

      const res2 = await app.request("/reports/eu-ai-act?chainId=my-chain");
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as {
        report: { regulationSummaries: ReadonlyArray<{ regulationId: string }> };
      };
      expect(body2.report.regulationSummaries[0]?.regulationId).toBe("eu-ai-act");
    });
  });
});
