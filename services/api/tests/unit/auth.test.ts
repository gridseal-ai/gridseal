import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "@gridseal/core";
import type { StorageAdapter } from "@gridseal/core";
import { createApp } from "../../src/app.js";
import type { Hono } from "hono";

describe("API key authentication", () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
  });

  describe("when API keys are configured", () => {
    let app: Hono;
    const validKey = "test-api-key-123";

    beforeEach(() => {
      app = createApp({ storage, apiKeys: [validKey] });
    });

    it("returns 401 when no Authorization header is provided", async () => {
      const res = await app.request("/chains");
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("Missing API key");
    });

    it("returns 403 when an invalid API key is provided", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: "Bearer wrong-key" },
      });
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain("Invalid API key");
    });

    it("allows access with a valid Bearer token", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: `Bearer ${validKey}` },
      });
      expect(res.status).toBe(200);
    });

    it("allows access with a plain API key (no Bearer prefix)", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: validKey },
      });
      expect(res.status).toBe(200);
    });

    it("rejects empty Authorization header", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: "" },
      });
      expect(res.status).toBe(401);
    });

    it("rejects Bearer prefix with no key", async () => {
      const res = await app.request("/chains", {
        headers: { Authorization: "Bearer " },
      });
      expect(res.status).toBe(401);
    });

    it("supports multiple valid API keys", async () => {
      const key2 = "second-key-456";
      const multiApp = createApp({ storage, apiKeys: [validKey, key2] });

      const res1 = await multiApp.request("/chains", {
        headers: { Authorization: `Bearer ${validKey}` },
      });
      expect(res1.status).toBe(200);

      const res2 = await multiApp.request("/chains", {
        headers: { Authorization: `Bearer ${key2}` },
      });
      expect(res2.status).toBe(200);
    });
  });

  describe("when no API keys are configured", () => {
    it("allows all requests through without auth", async () => {
      const app = createApp({ storage });
      const res = await app.request("/chains");
      expect(res.status).toBe(200);
    });

    it("allows requests with empty apiKeys array", async () => {
      const app = createApp({ storage, apiKeys: [] });
      const res = await app.request("/chains");
      expect(res.status).toBe(200);
    });
  });
});
