import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter } from "@gridseal/core";
import type { StorageAdapter } from "@gridseal/core";
import { createApp, createTenantApp } from "../../src/app.js";
import { createTenantToken } from "../../src/jwt.js";
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
  headers: Record<string, string> = {},
) {
  const res = await app.request(`/chains/${chainId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(makeEntryBody(overrides)),
  });
  return res;
}

describe("Badge routes (single-tenant)", () => {
  let app: Hono;
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
    app = createApp({
      storage,
      badgeBaseUrl: "https://app.gridseal.ai",
    });
  });

  describe("GET /badge/:tenantSlug.svg", () => {
    it("returns SVG content type", async () => {
      const res = await app.request("/badge/acme.svg");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toBe("image/svg+xml");
    });

    it("returns no-cache headers for real-time updates", async () => {
      const res = await app.request("/badge/acme.svg");
      expect(res.headers.get("cache-control")).toContain("no-cache");
    });

    it("returns no_data badge when no chains exist", async () => {
      const res = await app.request("/badge/acme.svg");
      const svg = await res.text();
      expect(svg).toContain("no data");
      expect(svg).toContain("#6b7280");
    });

    it("returns verified badge for a valid chain", async () => {
      await addEntry(app, "test-chain", { modelId: "gpt-4" });
      const res = await app.request("/badge/acme.svg?chain=test-chain");
      const svg = await res.text();
      expect(svg).toContain("verified");
      expect(svg).toContain("#1B6B9A");
    });

    it("returns valid SVG structure", async () => {
      const res = await app.request("/badge/acme.svg");
      const svg = await res.text();
      expect(svg).toContain("<svg");
      expect(svg).toContain("</svg>");
      expect(svg).toContain("GridSeal");
    });

    it("includes trust page link in SVG", async () => {
      await addEntry(app, "linked-chain");
      const res = await app.request("/badge/acme.svg?chain=linked-chain");
      const svg = await res.text();
      expect(svg).toContain("xlink:href");
      expect(svg).toContain("https://app.gridseal.ai/chains/linked-chain/trust");
    });

    it("rejects invalid tenant slugs", async () => {
      const res = await app.request("/badge/ac%20me.svg");
      expect(res.status).toBe(400);
    });

    it("accepts slugs with hyphens and underscores", async () => {
      const res = await app.request("/badge/acme-corp_123.svg");
      expect(res.status).toBe(200);
    });

    it("does not require authentication", async () => {
      // No Authorization header at all - should still work
      const res = await app.request("/badge/public-badge.svg");
      expect(res.status).toBe(200);
    });

    it("returns verified badge when checking all chains", async () => {
      await addEntry(app, "chain-a");
      await addEntry(app, "chain-b");
      const res = await app.request("/badge/acme.svg");
      const svg = await res.text();
      expect(svg).toContain("verified");
    });
  });
});

describe("Badge routes (multi-tenant)", () => {
  const JWT_SECRET = "test-badge-secret-key-256-bits!!";

  it("serves badge without JWT authentication", async () => {
    const storageMap = new Map<string, StorageAdapter>();
    const factory = (tenantId: string) => {
      if (!storageMap.has(tenantId)) {
        storageMap.set(tenantId, createInMemoryAdapter());
      }
      return storageMap.get(tenantId)!;
    };

    const app = createTenantApp({
      storageFactory: factory,
      jwtSecret: JWT_SECRET,
      badgeBaseUrl: "https://app.gridseal.ai",
    });

    // Badge should work without any auth header
    const res = await app.request("/badge/tenant-abc.svg");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/svg+xml");
  });

  it("returns tenant-specific badge data", async () => {
    const storageA = createInMemoryAdapter();
    const storageB = createInMemoryAdapter();
    const storageMap = new Map<string, StorageAdapter>([
      ["tenant-a", storageA],
      ["tenant-b", storageB],
    ]);
    const factory = (tenantId: string) => {
      if (!storageMap.has(tenantId)) {
        storageMap.set(tenantId, createInMemoryAdapter());
      }
      return storageMap.get(tenantId)!;
    };

    const app = createTenantApp({
      storageFactory: factory,
      jwtSecret: JWT_SECRET,
      badgeBaseUrl: "https://app.gridseal.ai",
    });

    // Add an entry directly to tenant-a's storage via the API
    const tokenA = createTenantToken("tenant-a", JWT_SECRET);
    const addRes = await addEntry(app, "chain-1", {}, { Authorization: `Bearer ${tokenA}` });
    expect(addRes.status).toBe(201);

    // Verify the entry is in tenant-a's storage
    const entries = await storageA.getEntriesByChainId("chain-1");
    expect(entries.length).toBe(1);

    // Badge for tenant-a should show verified (has data)
    const resA = await app.request("/badge/tenant-a.svg?chain=chain-1");
    const svgA = await resA.text();
    expect(svgA).toContain("verified");

    // Badge for tenant-b should show no data (empty)
    const resB = await app.request("/badge/tenant-b.svg?chain=chain-1");
    const svgB = await resB.text();
    expect(svgB).toContain("no data");
  });
});

describe("Badge routes disabled", () => {
  it("returns 404 when badgeBaseUrl is not configured", async () => {
    const storage = createInMemoryAdapter();
    const app = createApp({ storage });
    const res = await app.request("/badge/acme.svg");
    expect(res.status).toBe(404);
  });
});
