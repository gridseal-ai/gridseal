import { describe, it, expect } from "vitest";
import type { ProofChainEntry, ChainState } from "@gridseal/core";
import { createChain, appendEntry } from "@gridseal/core";
import {
  verifyChain,
  countEntryTypes,
  countDecisionTypes,
  aggregateModelUsage,
  computeTimeline,
  collectActors,
  collectSessions,
  collectPolicyIds,
  computeHumanReview,
  computeComplianceAvailability,
  aggregateTrustPageData,
} from "../../src/aggregate.js";

function makeEntry(overrides: Partial<ProofChainEntry> = {}): ProofChainEntry {
  return {
    entryId: crypto.randomUUID(),
    chainId: "chain-1",
    sequenceNumber: 0,
    timestamp: "2026-01-01T00:00:00.000Z",
    entryType: "ai_decision",
    entryHash: "abc123",
    previousHash: null,
    parentEntryId: null,
    modelId: null,
    modelProvider: null,
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
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
    ...overrides,
  };
}

describe("countEntryTypes", () => {
  it("counts entries by their type", () => {
    const entries = [
      makeEntry({ entryType: "ai_decision" }),
      makeEntry({ entryType: "ai_decision" }),
      makeEntry({ entryType: "human_override" }),
    ];
    const counts = countEntryTypes(entries);
    expect(counts["ai_decision"]).toBe(2);
    expect(counts["human_override"]).toBe(1);
  });

  it("returns empty object for empty entries", () => {
    expect(countEntryTypes([])).toEqual({});
  });
});

describe("countDecisionTypes", () => {
  it("counts entries by decision type, ignoring null", () => {
    const entries = [
      makeEntry({ decisionType: "classification" }),
      makeEntry({ decisionType: "classification" }),
      makeEntry({ decisionType: "generation" }),
      makeEntry({ decisionType: null }),
    ];
    const counts = countDecisionTypes(entries);
    expect(counts["classification"]).toBe(2);
    expect(counts["generation"]).toBe(1);
    expect(Object.keys(counts)).toHaveLength(2);
  });
});

describe("aggregateModelUsage", () => {
  it("aggregates token usage by model", () => {
    const entries = [
      makeEntry({
        modelId: "gpt-4",
        modelProvider: "openai",
        inputTokenCount: 100,
        outputTokenCount: 50,
      }),
      makeEntry({
        modelId: "gpt-4",
        modelProvider: "openai",
        inputTokenCount: 200,
        outputTokenCount: 100,
      }),
      makeEntry({
        modelId: "claude-sonnet-4-20250514",
        modelProvider: "anthropic",
        inputTokenCount: 300,
        outputTokenCount: 150,
      }),
    ];
    const usage = aggregateModelUsage(entries);
    expect(usage).toHaveLength(2);
    const gpt4 = usage.find((m) => m.modelId === "gpt-4");
    expect(gpt4).toBeDefined();
    expect(gpt4?.entryCount).toBe(2);
    expect(gpt4?.totalInputTokens).toBe(300);
    expect(gpt4?.totalOutputTokens).toBe(150);
  });

  it("skips entries with null modelId", () => {
    const entries = [makeEntry({ modelId: null, modelProvider: null })];
    expect(aggregateModelUsage(entries)).toHaveLength(0);
  });

  it("sorts by entry count descending", () => {
    const entries = [
      makeEntry({ modelId: "a", modelProvider: "p" }),
      makeEntry({ modelId: "b", modelProvider: "p" }),
      makeEntry({ modelId: "b", modelProvider: "p" }),
    ];
    const usage = aggregateModelUsage(entries);
    expect(usage[0]?.modelId).toBe("b");
  });
});

describe("computeTimeline", () => {
  it("returns null timestamps for empty entries", () => {
    const result = computeTimeline([]);
    expect(result.firstEntryTimestamp).toBeNull();
    expect(result.lastEntryTimestamp).toBeNull();
    expect(result.durationMs).toBeNull();
  });

  it("computes correct timeline from entries", () => {
    const entries = [
      makeEntry({ timestamp: "2026-01-01T00:00:00.000Z" }),
      makeEntry({ timestamp: "2026-01-01T01:00:00.000Z" }),
    ];
    const result = computeTimeline(entries);
    expect(result.firstEntryTimestamp).toBe("2026-01-01T00:00:00.000Z");
    expect(result.lastEntryTimestamp).toBe("2026-01-01T01:00:00.000Z");
    expect(result.durationMs).toBe(3600000);
  });
});

describe("collectActors", () => {
  it("collects unique actor IDs sorted alphabetically", () => {
    const entries = [
      makeEntry({ actorId: "bob" }),
      makeEntry({ actorId: "alice" }),
      makeEntry({ actorId: "bob" }),
      makeEntry({ actorId: null }),
    ];
    expect(collectActors(entries)).toEqual(["alice", "bob"]);
  });
});

describe("collectSessions", () => {
  it("collects unique session IDs", () => {
    const entries = [
      makeEntry({ sessionId: "s1" }),
      makeEntry({ sessionId: "s2" }),
      makeEntry({ sessionId: "s1" }),
    ];
    expect(collectSessions(entries)).toEqual(["s1", "s2"]);
  });
});

describe("collectPolicyIds", () => {
  it("collects unique policy IDs from all entries", () => {
    const entries = [
      makeEntry({ policyIds: ["colorado-sb205", "nist-ai-rmf"] }),
      makeEntry({ policyIds: ["colorado-sb205"] }),
    ];
    expect(collectPolicyIds(entries)).toEqual([
      "colorado-sb205",
      "nist-ai-rmf",
    ]);
  });
});

describe("computeHumanReview", () => {
  it("computes review rate from tags.review_status", () => {
    const entries = [
      makeEntry({ tags: { review_status: "approved" } }),
      makeEntry({ tags: { review_status: "approved" } }),
      makeEntry({ tags: { review_status: "rejected" } }),
      makeEntry({ tags: { review_status: "pending" } }),
      makeEntry({ tags: {} }),
    ];
    const review = computeHumanReview(entries);
    expect(review.approved).toBe(2);
    expect(review.rejected).toBe(1);
    expect(review.pending).toBe(1);
    expect(review.totalReviewed).toBe(3);
    expect(review.reviewRate).toBeCloseTo(0.6);
  });

  it("returns zero rate for empty entries", () => {
    const review = computeHumanReview([]);
    expect(review.reviewRate).toBe(0);
    expect(review.totalReviewed).toBe(0);
  });

  it("returns zero rate when no entries have review_status", () => {
    const entries = [makeEntry({ tags: {} }), makeEntry({ tags: {} })];
    const review = computeHumanReview(entries);
    expect(review.reviewRate).toBe(0);
  });
});

describe("computeComplianceAvailability", () => {
  it("marks regulations as available when entries exist", () => {
    const entries = [makeEntry({ policyIds: ["colorado-sb205"] })];
    const result = computeComplianceAvailability(entries, [
      "colorado-sb205",
      "nist-ai-rmf",
    ]);
    expect(result).toHaveLength(2);
    const colorado = result.find((r) => r.regulationId === "colorado-sb205");
    expect(colorado?.available).toBe(true);
    const nist = result.find((r) => r.regulationId === "nist-ai-rmf");
    expect(nist?.available).toBe(true);
  });

  it("returns empty array for no regulations", () => {
    expect(computeComplianceAvailability([], [])).toEqual([]);
  });
});

describe("verifyChain", () => {
  it("returns valid for a properly constructed chain", () => {
    const chain = createChain("test-chain");
    const r1 = appendEntry(chain, {
      entryId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      entryType: "ai_decision",
    });
    if (!r1.ok) throw new Error("Failed to append");
    const result = verifyChain(r1.value.chain);
    expect(result.valid).toBe(true);
    expect(result.entryCount).toBe(1);
    expect(result.errorType).toBeNull();
  });

  it("returns invalid for a tampered chain", () => {
    const chain = createChain("test-chain");
    const r1 = appendEntry(chain, {
      entryId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      entryType: "ai_decision",
    });
    if (!r1.ok) throw new Error("Failed to append");
    const tampered: ChainState = {
      chainId: r1.value.chain.chainId,
      entries: [
        {
          ...r1.value.chain.entries[0]!,
          entryHash: "tampered",
        },
      ],
    };
    const result = verifyChain(tampered);
    expect(result.valid).toBe(false);
    expect(result.errorType).toBe("HASH_MISMATCH");
    expect(result.errorDetail).toBeDefined();
  });
});

describe("aggregateTrustPageData", () => {
  it("produces complete TrustPageData with all fields", () => {
    const chain = createChain("aggregate-test");
    const r1 = appendEntry(chain, {
      entryId: crypto.randomUUID(),
      timestamp: "2026-01-01T00:00:00.000Z",
      entryType: "ai_decision",
      modelId: "gpt-4",
      modelProvider: "openai",
      inputTokenCount: 100,
      outputTokenCount: 50,
      actorId: "user-1",
      sessionId: "session-1",
      tags: { review_status: "approved" },
    });
    if (!r1.ok) throw new Error("Failed to append");

    const data = aggregateTrustPageData(r1.value.chain, [], [], [
      "colorado-sb205",
    ]);

    expect(data.chainId).toBe("aggregate-test");
    expect(data.verification.valid).toBe(true);
    expect(data.verification.entryCount).toBe(1);
    expect(data.modelUsage).toHaveLength(1);
    expect(data.uniqueActors).toEqual(["user-1"]);
    expect(data.uniqueSessions).toEqual(["session-1"]);
    expect(data.humanReview.approved).toBe(1);
    expect(data.humanReview.reviewRate).toBe(1);
    expect(data.complianceAvailability).toHaveLength(1);
    expect(data.lastVerificationTimestamp).toBeDefined();
    expect(data.generatedAt).toBeDefined();
  });
});
