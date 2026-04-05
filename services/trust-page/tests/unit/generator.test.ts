import { describe, it, expect, beforeEach } from "vitest";
import {
  createInMemoryAdapter,
  createChain,
  appendEntry,
} from "@gridseal/core";
import type { StorageAdapter } from "@gridseal/core";
import { generateTrustPage, generateTrustPageData } from "../../src/generator.js";

async function seedChain(
  storage: StorageAdapter,
  chainId: string,
  count: number,
): Promise<void> {
  let chain = createChain(chainId);
  for (let i = 0; i < count; i++) {
    const result = appendEntry(chain, {
      entryId: crypto.randomUUID(),
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
      entryType: "ai_decision",
      modelId: "gpt-4",
      modelProvider: "openai",
      inputTokenCount: 100,
      outputTokenCount: 50,
      actorId: `actor-${String(i % 3)}`,
      sessionId: `session-${String(i % 2)}`,
      tags: i % 2 === 0 ? { review_status: "approved" } : {},
    });
    if (!result.ok) {
      throw new Error(`Failed to append entry ${String(i)}: ${result.error.type}`);
    }
    await storage.putEntry(result.value.entry);
    chain = result.value.chain;
  }
}

describe("generateTrustPage", () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
  });

  it("returns CHAIN_EMPTY error for nonexistent chain", async () => {
    const result = await generateTrustPage(storage, { chainId: "missing" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.type).toBe("CHAIN_EMPTY");
      expect(result.error.chainId).toBe("missing");
    }
  });

  it("generates HTML and data for a valid chain", async () => {
    await seedChain(storage, "test-chain", 5);
    const result = await generateTrustPage(storage, { chainId: "test-chain" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.html).toContain("<!DOCTYPE html>");
      expect(result.value.html).toContain("test-chain");
      expect(result.value.data.verification.valid).toBe(true);
      expect(result.value.data.verification.entryCount).toBe(5);
      expect(result.value.data.modelUsage).toHaveLength(1);
      expect(result.value.data.modelUsage[0]?.modelId).toBe("gpt-4");
    }
  });

  it("includes human review rate in generated data", async () => {
    await seedChain(storage, "review-chain", 4);
    const result = await generateTrustPage(storage, {
      chainId: "review-chain",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.humanReview.approved).toBe(2);
      expect(result.value.data.humanReview.reviewRate).toBe(0.5);
    }
  });

  it("includes compliance availability in generated data", async () => {
    await seedChain(storage, "compliance-chain", 2);
    const result = await generateTrustPage(storage, {
      chainId: "compliance-chain",
      regulationIds: ["colorado-sb205", "eu-ai-act"],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.complianceAvailability).toHaveLength(2);
    }
  });

  it("includes last verification timestamp", async () => {
    await seedChain(storage, "ts-chain", 1);
    const before = new Date().toISOString();
    const result = await generateTrustPage(storage, { chainId: "ts-chain" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.lastVerificationTimestamp).toBeDefined();
      expect(
        result.value.data.lastVerificationTimestamp >= before,
      ).toBe(true);
    }
  });

  it("collects unique actors and sessions", async () => {
    await seedChain(storage, "actors-chain", 6);
    const result = await generateTrustPage(storage, {
      chainId: "actors-chain",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.data.uniqueActors).toHaveLength(3);
      expect(result.value.data.uniqueSessions).toHaveLength(2);
    }
  });
});

describe("generateTrustPageData", () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createInMemoryAdapter();
  });

  it("returns only data without HTML", async () => {
    await seedChain(storage, "data-only", 3);
    const result = await generateTrustPageData(storage, {
      chainId: "data-only",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chainId).toBe("data-only");
      expect(result.value.verification.entryCount).toBe(3);
      expect((result.value as Record<string, unknown>)["html"]).toBeUndefined();
    }
  });

  it("returns error for empty chain", async () => {
    const result = await generateTrustPageData(storage, {
      chainId: "empty",
    });
    expect(result.ok).toBe(false);
  });
});
