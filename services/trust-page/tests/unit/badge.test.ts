import { describe, it, expect, beforeEach } from "vitest";
import { createInMemoryAdapter, createChain, appendEntry } from "@gridseal/core";
import type { StorageAdapter, ChainState } from "@gridseal/core";
import { computeBadgeData, renderBadgeSvg } from "../../src/badge.js";
import type { BadgeData } from "../../src/badge.js";

async function seedChain(
  storage: StorageAdapter,
  chainId: string,
  count: number,
): Promise<void> {
  let chain: ChainState = createChain(chainId);
  for (let i = 0; i < count; i++) {
    const result = appendEntry(chain, {
      entryId: `${chainId}-entry-${String(i)}`,
      timestamp: new Date().toISOString(),
      entryType: "ai_decision",
    });
    if (!result.ok) {
      throw new Error(`Failed to append entry: ${result.error.type}`);
    }
    chain = result.value.chain;
    await storage.putEntry(result.value.entry);
  }
}

describe("computeBadgeData", () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
  });

  it("returns no_data when no chains exist", async () => {
    const data = await computeBadgeData(storage, { tenantSlug: "test" });
    expect(data.status).toBe("no_data");
    expect(data.entryCount).toBe(0);
    expect(data.chainCount).toBe(0);
    expect(data.trustPageUrl).toBeNull();
  });

  it("returns no_data for a specific chain that does not exist", async () => {
    const data = await computeBadgeData(storage, {
      tenantSlug: "test",
      chainId: "nonexistent",
    });
    expect(data.status).toBe("no_data");
    expect(data.entryCount).toBe(0);
  });

  it("returns verified for a valid chain", async () => {
    await seedChain(storage, "chain-1", 5);
    const data = await computeBadgeData(storage, {
      tenantSlug: "test",
      chainId: "chain-1",
    });
    expect(data.status).toBe("verified");
    expect(data.entryCount).toBe(5);
    expect(data.chainCount).toBe(1);
  });

  it("returns verified when checking all chains and all are valid", async () => {
    await seedChain(storage, "chain-a", 3);
    await seedChain(storage, "chain-b", 2);
    const data = await computeBadgeData(storage, { tenantSlug: "test" });
    expect(data.status).toBe("verified");
    expect(data.entryCount).toBe(5);
    expect(data.chainCount).toBe(2);
  });

  it("returns unverified when a chain has tampered entries", async () => {
    await seedChain(storage, "chain-1", 3);
    // Tamper: insert an entry with wrong hash into the same chain
    const tamperedEntry = {
      entryId: "tampered-entry",
      chainId: "chain-1",
      sequenceNumber: 3,
      timestamp: new Date().toISOString(),
      entryType: "ai_decision" as const,
      entryHash: "0".repeat(64),
      previousHash: "wrong".repeat(12) + "wrong1234567",
      parentEntryId: null,
      modelId: null,
      modelProvider: null,
      modelVersion: null,
      inputHash: null,
      outputHash: null,
      inputTokenCount: null,
      outputTokenCount: null,
      decisionType: null,
      confidenceScore: null,
      reasoningCertificateId: null,
      provenanceId: null,
      sessionId: null,
      actorId: null,
      policyIds: [] as ReadonlyArray<string>,
      tags: {} as Readonly<Record<string, string>>,
      annotation: null,
      complianceMetadata: {} as Readonly<Record<string, string>>,
    };
    await storage.putEntry(tamperedEntry);
    const data = await computeBadgeData(storage, {
      tenantSlug: "test",
      chainId: "chain-1",
    });
    expect(data.status).toBe("unverified");
  });

  it("constructs trust page URL with baseUrl and specific chainId", async () => {
    await seedChain(storage, "my-chain", 2);
    const data = await computeBadgeData(storage, {
      tenantSlug: "acme",
      chainId: "my-chain",
      baseUrl: "https://app.gridseal.ai",
    });
    expect(data.trustPageUrl).toBe(
      "https://app.gridseal.ai/chains/my-chain/trust",
    );
  });

  it("constructs trust page URL with baseUrl for all-chains mode", async () => {
    await seedChain(storage, "first-chain", 2);
    await seedChain(storage, "second-chain", 1);
    const data = await computeBadgeData(storage, {
      tenantSlug: "acme",
      baseUrl: "https://app.gridseal.ai",
    });
    expect(data.trustPageUrl).toBeTruthy();
    expect(data.trustPageUrl).toContain("/chains/");
    expect(data.trustPageUrl).toContain("/trust");
  });

  it("returns null trust page URL when no baseUrl is provided", async () => {
    await seedChain(storage, "chain-1", 2);
    const data = await computeBadgeData(storage, {
      tenantSlug: "test",
      chainId: "chain-1",
    });
    expect(data.trustPageUrl).toBeNull();
  });

  it("encodes chainId in trust page URL", async () => {
    await seedChain(storage, "chain with spaces", 1);
    const data = await computeBadgeData(storage, {
      tenantSlug: "test",
      chainId: "chain with spaces",
      baseUrl: "https://example.com",
    });
    expect(data.trustPageUrl).toBe(
      "https://example.com/chains/chain%20with%20spaces/trust",
    );
  });
});

describe("renderBadgeSvg", () => {
  it("renders valid SVG for verified status", () => {
    const data: BadgeData = {
      status: "verified",
      entryCount: 10,
      chainCount: 1,
      trustPageUrl: null,
    };
    const svg = renderBadgeSvg(data);
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("GridSeal");
    expect(svg).toContain("verified");
    expect(svg).toContain("#1B6B9A");
  });

  it("renders valid SVG for unverified status", () => {
    const data: BadgeData = {
      status: "unverified",
      entryCount: 5,
      chainCount: 1,
      trustPageUrl: null,
    };
    const svg = renderBadgeSvg(data);
    expect(svg).toContain("unverified");
    expect(svg).toContain("#c0392b");
  });

  it("renders valid SVG for no_data status", () => {
    const data: BadgeData = {
      status: "no_data",
      entryCount: 0,
      chainCount: 0,
      trustPageUrl: null,
    };
    const svg = renderBadgeSvg(data);
    expect(svg).toContain("no data");
    expect(svg).toContain("#6b7280");
  });

  it("wraps SVG in a link when trustPageUrl is provided", () => {
    const data: BadgeData = {
      status: "verified",
      entryCount: 10,
      chainCount: 1,
      trustPageUrl: "https://app.gridseal.ai/chains/test/trust",
    };
    const svg = renderBadgeSvg(data);
    expect(svg).toContain("xlink:href");
    expect(svg).toContain("https://app.gridseal.ai/chains/test/trust");
  });

  it("does not include a link when trustPageUrl is null", () => {
    const data: BadgeData = {
      status: "verified",
      entryCount: 10,
      chainCount: 1,
      trustPageUrl: null,
    };
    const svg = renderBadgeSvg(data);
    expect(svg).not.toContain("xlink:href");
  });

  it("escapes special characters in trustPageUrl", () => {
    const data: BadgeData = {
      status: "verified",
      entryCount: 1,
      chainCount: 1,
      trustPageUrl: "https://example.com/chains/a&b/trust",
    };
    const svg = renderBadgeSvg(data);
    expect(svg).toContain("a&amp;b");
    expect(svg).not.toContain("a&b");
  });

  it("includes aria-label for accessibility", () => {
    const data: BadgeData = {
      status: "verified",
      entryCount: 1,
      chainCount: 1,
      trustPageUrl: null,
    };
    const svg = renderBadgeSvg(data);
    expect(svg).toContain('aria-label="GridSeal: verified"');
  });

  it("includes title element for tooltip", () => {
    const data: BadgeData = {
      status: "unverified",
      entryCount: 1,
      chainCount: 1,
      trustPageUrl: null,
    };
    const svg = renderBadgeSvg(data);
    expect(svg).toContain("<title>GridSeal: unverified</title>");
  });

  it("uses Celestir midnight navy for the label background", () => {
    const data: BadgeData = {
      status: "verified",
      entryCount: 1,
      chainCount: 1,
      trustPageUrl: null,
    };
    const svg = renderBadgeSvg(data);
    expect(svg).toContain("#0A1628");
  });

  it("produces consistent output for the same input", () => {
    const data: BadgeData = {
      status: "verified",
      entryCount: 10,
      chainCount: 1,
      trustPageUrl: null,
    };
    const svg1 = renderBadgeSvg(data);
    const svg2 = renderBadgeSvg(data);
    expect(svg1).toBe(svg2);
  });
});
