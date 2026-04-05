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

describe("Entry list filters", () => {
  let app: Hono;
  let storage: StorageAdapter;

  beforeEach(async () => {
    storage = createInMemoryAdapter();
    app = createApp({ storage });

    const entries = [
      makeEntryBody({
        timestamp: "2025-01-15T10:00:00Z",
        modelId: "gpt-4o",
        actorId: "user-alpha",
        sessionId: "session-1",
      }),
      makeEntryBody({
        timestamp: "2025-02-10T10:00:00Z",
        modelId: "claude-3-opus",
        actorId: "user-beta",
        sessionId: "session-1",
      }),
      makeEntryBody({
        timestamp: "2025-03-20T10:00:00Z",
        modelId: "gpt-4o",
        actorId: "user-alpha",
        sessionId: "session-2",
      }),
      makeEntryBody({
        timestamp: "2025-04-05T10:00:00Z",
        modelId: "claude-3-opus",
        actorId: "user-gamma",
        sessionId: "session-3",
      }),
    ];

    for (const entry of entries) {
      await app.request("/chains/test-chain/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      });
    }
  });

  it("returns all entries without filters", async () => {
    const res = await app.request("/chains/test-chain/entries");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: Array<unknown>; total: number };
    expect(body.total).toBe(4);
    expect(body.entries).toHaveLength(4);
  });

  it("filters by modelId", async () => {
    const res = await app.request("/chains/test-chain/entries?modelId=gpt-4o");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ modelId: string }>;
      total: number;
    };
    expect(body.total).toBe(2);
    for (const entry of body.entries) {
      expect(entry.modelId).toBe("gpt-4o");
    }
  });

  it("filters by actorId", async () => {
    const res = await app.request("/chains/test-chain/entries?actorId=user-alpha");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<{ actorId: string }>;
      total: number;
    };
    expect(body.total).toBe(2);
    for (const entry of body.entries) {
      expect(entry.actorId).toBe("user-alpha");
    }
  });

  it("filters by sessionId", async () => {
    const res = await app.request("/chains/test-chain/entries?sessionId=session-1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(2);
  });

  it("filters by date range with startDate", async () => {
    const res = await app.request("/chains/test-chain/entries?startDate=2025-03-01T00:00:00Z");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(2);
  });

  it("filters by date range with endDate", async () => {
    const res = await app.request("/chains/test-chain/entries?endDate=2025-02-28T23:59:59Z");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(2);
  });

  it("filters by both startDate and endDate", async () => {
    const res = await app.request(
      "/chains/test-chain/entries?startDate=2025-02-01T00:00:00Z&endDate=2025-03-31T23:59:59Z"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(2);
  });

  it("combines multiple filters", async () => {
    const res = await app.request(
      "/chains/test-chain/entries?modelId=gpt-4o&actorId=user-alpha"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { total: number };
    expect(body.total).toBe(2);
  });

  it("returns empty results when no entries match filters", async () => {
    const res = await app.request(
      "/chains/test-chain/entries?modelId=nonexistent-model"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { entries: Array<unknown>; total: number };
    expect(body.total).toBe(0);
    expect(body.entries).toHaveLength(0);
  });

  it("applies pagination after filtering", async () => {
    const res = await app.request(
      "/chains/test-chain/entries?modelId=gpt-4o&offset=0&limit=1"
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      entries: Array<unknown>;
      total: number;
      offset: number;
      limit: number;
    };
    expect(body.entries).toHaveLength(1);
    expect(body.total).toBe(2);
    expect(body.limit).toBe(1);
  });
});
