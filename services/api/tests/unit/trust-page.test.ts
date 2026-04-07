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

async function addEntry(
  app: Hono,
  chainId: string,
  overrides: Record<string, unknown> = {},
) {
  const res = await app.request(`/chains/${chainId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(makeEntryBody(overrides)),
  });
  return res;
}

describe("Trust Page routes", () => {
  let app: Hono;
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
    app = createApp({ storage });
  });

  describe("GET /chains/:chainId/trust", () => {
    it("returns 404 for nonexistent chain", async () => {
      const res = await app.request("/chains/missing/trust");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("missing");
    });

    it("returns HTML trust page for a valid chain", async () => {
      await addEntry(app, "trust-test", {
        modelId: "gpt-4",
        modelProvider: "openai",
        tags: { review_status: "approved" },
      });
      await addEntry(app, "trust-test", {
        modelId: "gpt-4",
        modelProvider: "openai",
        tags: { review_status: "rejected" },
      });

      const res = await app.request("/chains/trust-test/trust");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");

      const html = await res.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("trust-test");
      expect(html).toContain("Chain Verified");
      expect(html).toContain("gpt-4");
      expect(html).toContain("Human Review");
    });

    it("includes color palette in CSS", async () => {
      await addEntry(app, "style-test");
      const res = await app.request("/chains/style-test/trust");
      const html = await res.text();
      expect(html).toContain("#0A1628");
      expect(html).toContain("#1B6B9A");
      expect(html).toContain("#4DA8DA");
    });
  });

  describe("GET /chains/:chainId/trust/data", () => {
    it("returns 404 for nonexistent chain", async () => {
      const res = await app.request("/chains/missing/trust/data");
      expect(res.status).toBe(404);
    });

    it("returns JSON trust page data for a valid chain", async () => {
      await addEntry(app, "data-test", {
        modelId: "claude-sonnet-4-20250514",
        modelProvider: "anthropic",
        actorId: "user-1",
        sessionId: "sess-1",
        tags: { review_status: "approved" },
      });

      const res = await app.request("/chains/data-test/trust/data");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Record<string, unknown> };
      expect(body.data).toBeDefined();

      const data = body.data;
      expect(data["chainId"]).toBe("data-test");
      expect((data["verification"] as Record<string, unknown>)["valid"]).toBe(
        true,
      );
      expect((data["verification"] as Record<string, unknown>)["entryCount"]).toBe(1);
      expect(
        (data["modelUsage"] as ReadonlyArray<Record<string, unknown>>),
      ).toHaveLength(1);
      expect(data["uniqueActors"]).toEqual(["user-1"]);
      expect(data["uniqueSessions"]).toEqual(["sess-1"]);

      const review = data["humanReview"] as Record<string, unknown>;
      expect(review["approved"]).toBe(1);
      expect(review["reviewRate"]).toBe(1);

      expect(data["lastVerificationTimestamp"]).toBeDefined();
      expect(data["complianceAvailability"]).toBeDefined();
    });

    it("aggregates multiple entries correctly", async () => {
      for (let i = 0; i < 5; i++) {
        await addEntry(app, "multi-test", {
          modelId: i < 3 ? "gpt-4" : "claude-sonnet-4-20250514",
          modelProvider: i < 3 ? "openai" : "anthropic",
          actorId: `actor-${String(i % 2)}`,
          sessionId: `sess-${String(i % 3)}`,
          tags:
            i % 2 === 0 ? { review_status: "approved" } : {},
        });
      }

      const res = await app.request("/chains/multi-test/trust/data");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: Record<string, unknown> };
      const data = body.data;

      expect(
        (data["verification"] as Record<string, unknown>)["entryCount"],
      ).toBe(5);
      expect(
        (data["modelUsage"] as ReadonlyArray<unknown>).length,
      ).toBe(2);
      expect(
        (data["uniqueActors"] as ReadonlyArray<unknown>).length,
      ).toBe(2);
      expect(
        (data["uniqueSessions"] as ReadonlyArray<unknown>).length,
      ).toBe(3);

      const review = data["humanReview"] as Record<string, number>;
      expect(review["approved"]).toBe(3);
      expect(review["reviewRate"]).toBeCloseTo(0.6);
    });
  });
});
