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

describe("Chain routes", () => {
  let app: Hono;
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
    app = createApp({ storage });
  });

  describe("GET /chains", () => {
    it("returns empty list when no chains exist", async () => {
      const res = await app.request("/chains");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { chains: Array<unknown> };
      expect(body.chains).toEqual([]);
    });

    it("lists chains after entries are added", async () => {
      await app.request("/chains/chain-1/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeEntryBody()),
      });
      const res = await app.request("/chains");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        chains: Array<{ chainId: string; entryCount: number }>;
      };
      expect(body.chains).toHaveLength(1);
      expect(body.chains[0]?.chainId).toBe("chain-1");
      expect(body.chains[0]?.entryCount).toBe(1);
    });
  });

  describe("GET /chains/:chainId", () => {
    it("returns 404 for nonexistent chain", async () => {
      const res = await app.request("/chains/nonexistent");
      expect(res.status).toBe(404);
    });

    it("returns chain metadata when chain exists", async () => {
      await app.request("/chains/test-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeEntryBody()),
      });
      const res = await app.request("/chains/test-chain");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        chainId: string;
        entryCount: number;
      };
      expect(body.chainId).toBe("test-chain");
      expect(body.entryCount).toBe(1);
    });
  });

  describe("POST /chains/:chainId/entries", () => {
    it("creates an entry and returns 201", async () => {
      const entryBody = makeEntryBody();
      const res = await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryBody),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        entry: { entryId: string; chainId: string; sequenceNumber: number };
      };
      expect(body.entry.entryId).toBe(entryBody.entryId);
      expect(body.entry.chainId).toBe("my-chain");
      expect(body.entry.sequenceNumber).toBe(0);
    });

    it("chains entries with correct sequence numbers and previousHash", async () => {
      const entry1 = makeEntryBody();
      const res1 = await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry1),
      });
      const body1 = (await res1.json()) as {
        entry: { entryHash: string; previousHash: string | null };
      };
      expect(body1.entry.previousHash).toBeNull();

      const entry2 = makeEntryBody();
      const res2 = await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry2),
      });
      expect(res2.status).toBe(201);
      const body2 = (await res2.json()) as {
        entry: {
          sequenceNumber: number;
          previousHash: string;
          entryHash: string;
        };
      };
      expect(body2.entry.sequenceNumber).toBe(1);
      expect(body2.entry.previousHash).toBe(body1.entry.entryHash);
    });

    it("rejects duplicate entry IDs with 409", async () => {
      const entryBody = makeEntryBody();
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryBody),
      });
      const res = await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryBody),
      });
      expect(res.status).toBe(409);
    });

    it("rejects invalid body with 400", async () => {
      const res = await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryId: "not-a-uuid" }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: string; details: unknown };
      expect(body.error).toBe("Validation failed");
    });

    it("rejects non-JSON body with 400", async () => {
      const res = await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "not json",
      });
      expect(res.status).toBe(400);
    });

    it("creates entry with all tier 2 and tier 3 fields", async () => {
      const entryBody = makeEntryBody({
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
        policyIds: ["policy-1"],
        tags: { env: "test" },
        annotation: "Test entry",
        complianceMetadata: { regulation: "test" },
      });
      const res = await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryBody),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as {
        entry: {
          modelId: string;
          modelProvider: string;
          sessionId: string;
          tags: Record<string, string>;
        };
      };
      expect(body.entry.modelId).toBe("gpt-4o");
      expect(body.entry.modelProvider).toBe("openai");
      expect(body.entry.sessionId).toBe("session-1");
      expect(body.entry.tags).toEqual({ env: "test" });
    });
  });

  describe("GET /chains/:chainId/entries", () => {
    it("returns 404 for nonexistent chain", async () => {
      const res = await app.request("/chains/nonexistent/entries");
      expect(res.status).toBe(404);
    });

    it("returns paginated entries", async () => {
      for (let i = 0; i < 5; i++) {
        await app.request("/chains/my-chain/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeEntryBody()),
        });
      }
      const res = await app.request("/chains/my-chain/entries?offset=1&limit=2");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        entries: Array<{ sequenceNumber: number }>;
        total: number;
        offset: number;
        limit: number;
      };
      expect(body.entries).toHaveLength(2);
      expect(body.entries[0]?.sequenceNumber).toBe(1);
      expect(body.entries[1]?.sequenceNumber).toBe(2);
      expect(body.total).toBe(5);
      expect(body.offset).toBe(1);
      expect(body.limit).toBe(2);
    });
  });

  describe("GET /chains/:chainId/entries/:entryId", () => {
    it("returns a specific entry", async () => {
      const entryBody = makeEntryBody();
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryBody),
      });
      const res = await app.request(
        `/chains/my-chain/entries/${entryBody.entryId}`
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        entry: { entryId: string };
      };
      expect(body.entry.entryId).toBe(entryBody.entryId);
    });

    it("returns 404 for nonexistent entry", async () => {
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeEntryBody()),
      });
      const res = await app.request(
        `/chains/my-chain/entries/${crypto.randomUUID()}`
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when entry exists in a different chain", async () => {
      const entryBody = makeEntryBody();
      await app.request("/chains/chain-a/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryBody),
      });
      const res = await app.request(
        `/chains/chain-b/entries/${entryBody.entryId}`
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /chains/:chainId/validate", () => {
    it("validates a valid chain", async () => {
      for (let i = 0; i < 3; i++) {
        await app.request("/chains/my-chain/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makeEntryBody()),
        });
      }
      const res = await app.request("/chains/my-chain/validate", {
        method: "POST",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        valid: boolean;
        entryCount: number;
      };
      expect(body.valid).toBe(true);
      expect(body.entryCount).toBe(3);
    });

    it("returns 404 for nonexistent chain", async () => {
      const res = await app.request("/chains/nonexistent/validate", {
        method: "POST",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /chains/:chainId/entries/:entryId/validate", () => {
    it("validates a single entry", async () => {
      const entryBody = makeEntryBody();
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entryBody),
      });
      const res = await app.request(
        `/chains/my-chain/entries/${entryBody.entryId}/validate`,
        { method: "POST" }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { valid: boolean };
      expect(body.valid).toBe(true);
    });

    it("returns 404 for nonexistent entry", async () => {
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makeEntryBody()),
      });
      const res = await app.request(
        `/chains/my-chain/entries/${crypto.randomUUID()}/validate`,
        { method: "POST" }
      );
      expect(res.status).toBe(404);
    });
  });

  describe("GET /chains/:chainId/entries/:entryId/children", () => {
    it("returns children of an entry", async () => {
      const parent = makeEntryBody();
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parent),
      });
      const child = makeEntryBody({ parentEntryId: parent.entryId });
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(child),
      });
      const res = await app.request(
        `/chains/my-chain/entries/${parent.entryId}/children`
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        children: Array<{ entryId: string }>;
      };
      expect(body.children).toHaveLength(1);
      expect(body.children[0]?.entryId).toBe(child.entryId);
    });
  });

  describe("GET /chains/:chainId/entries/:entryId/subtree", () => {
    it("returns subtree rooted at entry", async () => {
      const root = makeEntryBody();
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(root),
      });
      const child = makeEntryBody({ parentEntryId: root.entryId });
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(child),
      });
      const res = await app.request(
        `/chains/my-chain/entries/${root.entryId}/subtree`
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        entries: Array<{ entryId: string }>;
      };
      expect(body.entries).toHaveLength(2);
    });

    it("returns 404 for nonexistent chain", async () => {
      const res = await app.request(
        `/chains/nonexistent/entries/${crypto.randomUUID()}/subtree`
      );
      expect(res.status).toBe(404);
    });
  });

  describe("POST /chains/:chainId/subtree/:entryId/validate", () => {
    it("validates subtree successfully", async () => {
      const root = makeEntryBody();
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(root),
      });
      const child = makeEntryBody({ parentEntryId: root.entryId });
      await app.request("/chains/my-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(child),
      });
      const res = await app.request(
        `/chains/my-chain/subtree/${root.entryId}/validate`,
        { method: "POST" }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { valid: boolean };
      expect(body.valid).toBe(true);
    });

    it("returns 404 for nonexistent chain", async () => {
      const res = await app.request(
        `/chains/nonexistent/subtree/${crypto.randomUUID()}/validate`,
        { method: "POST" }
      );
      expect(res.status).toBe(404);
    });
  });
});
