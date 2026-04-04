import { describe, expect, it } from "vitest";
import type {
  CreateEntryInput,
  ProofChainEntry,
  Tier1Fields,
  Tier2Fields,
  Tier3Fields,
} from "../../src/schema/proof-chain-entry.js";
import {
  TIER_2_DEFAULTS,
  TIER_3_DEFAULTS,
} from "../../src/schema/proof-chain-entry.js";
import { ENTRY_TYPES, DECISION_TYPES } from "../../src/schema/entry-types.js";
import type { EntryType, DecisionType } from "../../src/schema/entry-types.js";

function makeTier1(): Tier1Fields {
  return {
    entryId: "019505f0-0000-7000-8000-000000000001",
    chainId: "chain-001",
    sequenceNumber: 0,
    timestamp: "2026-04-04T12:00:00.000Z",
    entryType: "ai_decision",
    entryHash: "abc123",
    previousHash: null,
    parentEntryId: null,
  };
}

function makeFullEntry(): ProofChainEntry {
  return {
    ...makeTier1(),
    entryHash:
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    modelId: "claude-sonnet-4-20250514",
    modelProvider: "anthropic",
    inputHash:
      "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    outputHash:
      "f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5d4c3b2a1f6e5",
    inputTokenCount: 150,
    outputTokenCount: 300,
    decisionType: "generation",
    confidenceScore: 0.95,
    reasoningCertificateId: "cert-001",
    provenanceId: "prov-001",
    sessionId: "session-001",
    actorId: "user-42",
    policyIds: ["colorado-ai-act", "eu-ai-act"],
    tags: { environment: "production", team: "ml-ops" },
    annotation: "Routine inference call",
    complianceMetadata: { riskLevel: "limited", assessmentDate: "2026-04-01" },
  };
}

describe("ProofChainEntry", () => {
  it("has exactly 24 fields across all three tiers", () => {
    const entry = makeFullEntry();
    const keys = Object.keys(entry);
    expect(keys).toHaveLength(24);
  });

  it("has 8 Tier 1 fields for chain integrity", () => {
    const tier1: Tier1Fields = makeTier1();
    const keys = Object.keys(tier1);
    expect(keys).toHaveLength(8);
    expect(keys).toContain("entryId");
    expect(keys).toContain("chainId");
    expect(keys).toContain("sequenceNumber");
    expect(keys).toContain("timestamp");
    expect(keys).toContain("entryType");
    expect(keys).toContain("entryHash");
    expect(keys).toContain("previousHash");
    expect(keys).toContain("parentEntryId");
  });

  it("has 10 Tier 2 fields for AI decision context", () => {
    const tier2: Tier2Fields = TIER_2_DEFAULTS;
    const keys = Object.keys(tier2);
    expect(keys).toHaveLength(10);
    expect(keys).toContain("modelId");
    expect(keys).toContain("modelProvider");
    expect(keys).toContain("inputHash");
    expect(keys).toContain("outputHash");
    expect(keys).toContain("inputTokenCount");
    expect(keys).toContain("outputTokenCount");
    expect(keys).toContain("decisionType");
    expect(keys).toContain("confidenceScore");
    expect(keys).toContain("reasoningCertificateId");
    expect(keys).toContain("provenanceId");
  });

  it("has 6 Tier 3 fields for compliance and metadata", () => {
    const tier3: Tier3Fields = TIER_3_DEFAULTS;
    const keys = Object.keys(tier3);
    expect(keys).toHaveLength(6);
    expect(keys).toContain("sessionId");
    expect(keys).toContain("actorId");
    expect(keys).toContain("policyIds");
    expect(keys).toContain("tags");
    expect(keys).toContain("annotation");
    expect(keys).toContain("complianceMetadata");
  });

  it("allows creating a valid entry with only Tier 1 and defaults for Tier 2/3", () => {
    const entry: ProofChainEntry = {
      ...makeTier1(),
      ...TIER_2_DEFAULTS,
      ...TIER_3_DEFAULTS,
    };
    expect(entry.entryId).toBe("019505f0-0000-7000-8000-000000000001");
    expect(entry.modelId).toBeNull();
    expect(entry.policyIds).toEqual([]);
    expect(entry.tags).toEqual({});
    expect(entry.complianceMetadata).toEqual({});
  });

  it("allows creating a full entry with all fields populated", () => {
    const entry = makeFullEntry();
    expect(entry.modelId).toBe("claude-sonnet-4-20250514");
    expect(entry.modelProvider).toBe("anthropic");
    expect(entry.inputTokenCount).toBe(150);
    expect(entry.outputTokenCount).toBe(300);
    expect(entry.confidenceScore).toBe(0.95);
    expect(entry.policyIds).toEqual(["colorado-ai-act", "eu-ai-act"]);
    expect(entry.tags).toEqual({ environment: "production", team: "ml-ops" });
    expect(entry.complianceMetadata).toEqual({
      riskLevel: "limited",
      assessmentDate: "2026-04-01",
    });
  });

  it("supports tree structure via parentEntryId", () => {
    const root: ProofChainEntry = {
      ...makeTier1(),
      ...TIER_2_DEFAULTS,
      ...TIER_3_DEFAULTS,
      parentEntryId: null,
    };
    const child: ProofChainEntry = {
      ...makeTier1(),
      ...TIER_2_DEFAULTS,
      ...TIER_3_DEFAULTS,
      entryId: "019505f0-0000-7000-8000-000000000002",
      sequenceNumber: 1,
      parentEntryId: root.entryId,
      previousHash: root.entryHash,
    };
    expect(root.parentEntryId).toBeNull();
    expect(child.parentEntryId).toBe(root.entryId);
  });
});

describe("EntryType", () => {
  it("defines exactly 8 entry types", () => {
    expect(ENTRY_TYPES).toHaveLength(8);
  });

  it("includes all expected entry types", () => {
    const expected: ReadonlyArray<EntryType> = [
      "ai_decision",
      "human_override",
      "system_event",
      "policy_check",
      "data_access",
      "model_deployment",
      "feedback",
      "correction",
    ];
    expect([...ENTRY_TYPES]).toEqual(expected);
  });
});

describe("DecisionType", () => {
  it("defines exactly 10 decision types", () => {
    expect(DECISION_TYPES).toHaveLength(10);
  });

  it("includes all expected decision types", () => {
    const expected: ReadonlyArray<DecisionType> = [
      "classification",
      "generation",
      "recommendation",
      "extraction",
      "summarization",
      "translation",
      "embedding",
      "tool_call",
      "routing",
      "other",
    ];
    expect([...DECISION_TYPES]).toEqual(expected);
  });
});

describe("CreateEntryInput", () => {
  it("omits entryHash, previousHash, and sequenceNumber from the input type", () => {
    const input: CreateEntryInput = {
      entryId: "019505f0-0000-7000-8000-000000000001",
      chainId: "chain-001",
      timestamp: "2026-04-04T12:00:00.000Z",
      entryType: "ai_decision",
      parentEntryId: null,
      ...TIER_2_DEFAULTS,
      ...TIER_3_DEFAULTS,
    };
    expect(input.entryId).toBe("019505f0-0000-7000-8000-000000000001");
    // @ts-expect-error entryHash should not exist on CreateEntryInput
    expect(input.entryHash).toBeUndefined();
  });
});

describe("TIER_2_DEFAULTS", () => {
  it("sets all Tier 2 fields to null", () => {
    for (const value of Object.values(TIER_2_DEFAULTS)) {
      expect(value).toBeNull();
    }
  });
});

describe("TIER_3_DEFAULTS", () => {
  it("sets nullable fields to null and collections to empty", () => {
    expect(TIER_3_DEFAULTS.sessionId).toBeNull();
    expect(TIER_3_DEFAULTS.actorId).toBeNull();
    expect(TIER_3_DEFAULTS.annotation).toBeNull();
    expect(TIER_3_DEFAULTS.policyIds).toEqual([]);
    expect(TIER_3_DEFAULTS.tags).toEqual({});
    expect(TIER_3_DEFAULTS.complianceMetadata).toEqual({});
  });
});
