import { describe, it, expect } from "vitest";
import {
  formatValidationError,
  formatEntrySummary,
  formatEntryDetail,
  formatChainStats,
  formatChainList,
  padRight,
} from "../../src/format.js";
import type { ProofChainEntry, ValidationError } from "@gridseal/core";
import { TIER_2_DEFAULTS, TIER_3_DEFAULTS } from "@gridseal/core";

function makeEntry(overrides: Partial<ProofChainEntry> = {}): ProofChainEntry {
  return {
    entryId: "entry-001",
    chainId: "chain-001",
    sequenceNumber: 0,
    timestamp: "2026-01-01T00:00:00Z",
    entryType: "ai_decision",
    entryHash: "abc123",
    previousHash: null,
    parentEntryId: null,
    ...TIER_2_DEFAULTS,
    ...TIER_3_DEFAULTS,
    ...overrides,
  };
}

describe("formatValidationError", () => {
  it("formats HASH_MISMATCH with entry id, sequence, expected and actual hashes", () => {
    const error: ValidationError = {
      type: "HASH_MISMATCH",
      entryId: "entry-001",
      sequenceNumber: 5,
      expectedHash: "aaa",
      actualHash: "bbb",
    };
    const output = formatValidationError(error);
    expect(output).toContain("HASH_MISMATCH");
    expect(output).toContain("entry-001");
    expect(output).toContain("seq 5");
    expect(output).toContain("aaa");
    expect(output).toContain("bbb");
  });

  it("formats PREVIOUS_HASH_MISMATCH with null values displayed as (null)", () => {
    const error: ValidationError = {
      type: "PREVIOUS_HASH_MISMATCH",
      entryId: "entry-002",
      sequenceNumber: 0,
      expectedPreviousHash: null,
      actualPreviousHash: "xyz",
    };
    const output = formatValidationError(error);
    expect(output).toContain("PREVIOUS_HASH_MISMATCH");
    expect(output).toContain("(null)");
    expect(output).toContain("xyz");
  });

  it("formats SEQUENCE_NUMBER_MISMATCH with expected and actual numbers", () => {
    const error: ValidationError = {
      type: "SEQUENCE_NUMBER_MISMATCH",
      entryId: "entry-003",
      expectedSequenceNumber: 2,
      actualSequenceNumber: 5,
    };
    const output = formatValidationError(error);
    expect(output).toContain("SEQUENCE_NUMBER_MISMATCH");
    expect(output).toContain("2");
    expect(output).toContain("5");
  });

  it("formats CHAIN_ID_MISMATCH with expected and actual chain IDs", () => {
    const error: ValidationError = {
      type: "CHAIN_ID_MISMATCH",
      entryId: "entry-004",
      expectedChainId: "chain-a",
      actualChainId: "chain-b",
    };
    const output = formatValidationError(error);
    expect(output).toContain("CHAIN_ID_MISMATCH");
    expect(output).toContain("chain-a");
    expect(output).toContain("chain-b");
  });

  it("formats ENTRY_NOT_FOUND with the missing entry ID", () => {
    const error: ValidationError = { type: "ENTRY_NOT_FOUND", entryId: "missing-entry" };
    const output = formatValidationError(error);
    expect(output).toContain("ENTRY_NOT_FOUND");
    expect(output).toContain("missing-entry");
  });

  it("formats EMPTY_CHAIN", () => {
    const error: ValidationError = { type: "EMPTY_CHAIN" };
    const output = formatValidationError(error);
    expect(output).toContain("EMPTY_CHAIN");
  });
});

describe("formatEntrySummary", () => {
  it("includes sequence number, truncated ID, entry type, and timestamp", () => {
    const entry = makeEntry({ entryId: "0193abcdef12-7890-1234-5678", sequenceNumber: 3 });
    const output = formatEntrySummary(entry);
    expect(output).toContain("[3]");
    expect(output).toContain("0193abcdef12");
    expect(output).toContain("ai_decision");
    expect(output).toContain("2026-01-01T00:00:00Z");
  });

  it("includes model ID when present", () => {
    const entry = makeEntry({ modelId: "gpt-4o" });
    const output = formatEntrySummary(entry);
    expect(output).toContain("gpt-4o");
  });

  it("omits model ID when null", () => {
    const entry = makeEntry({ modelId: null });
    const output = formatEntrySummary(entry);
    expect(output).not.toContain("null");
  });
});

describe("formatEntryDetail", () => {
  it("shows all tier 1 fields for a minimal entry", () => {
    const entry = makeEntry();
    const output = formatEntryDetail(entry);
    expect(output).toContain("entry-001");
    expect(output).toContain("chain-001");
    expect(output).toContain("0");
    expect(output).toContain("2026-01-01T00:00:00Z");
    expect(output).toContain("ai_decision");
    expect(output).toContain("abc123");
    expect(output).toContain("(null)");
  });

  it("shows tier 2 fields when model data is present", () => {
    const entry = makeEntry({ modelId: "claude-3", modelProvider: "anthropic", inputHash: "inhash" });
    const output = formatEntryDetail(entry);
    expect(output).toContain("Tier 2");
    expect(output).toContain("claude-3");
    expect(output).toContain("anthropic");
    expect(output).toContain("inhash");
  });

  it("shows tier 3 fields when compliance data is present", () => {
    const entry = makeEntry({
      sessionId: "sess-1",
      actorId: "actor-1",
      policyIds: ["pol-1", "pol-2"],
      tags: { env: "prod" },
    });
    const output = formatEntryDetail(entry);
    expect(output).toContain("Tier 3");
    expect(output).toContain("sess-1");
    expect(output).toContain("actor-1");
    expect(output).toContain("pol-1, pol-2");
    expect(output).toContain("env");
  });
});

describe("formatChainStats", () => {
  it("shows basic stats for a chain with entries", () => {
    const entries = [
      makeEntry({ sequenceNumber: 0, entryType: "ai_decision", modelId: "gpt-4", timestamp: "2026-01-01T00:00:00Z" }),
      makeEntry({ sequenceNumber: 1, entryId: "entry-002", entryType: "ai_decision", modelId: null, timestamp: "2026-01-01T00:01:00Z" }),
      makeEntry({ sequenceNumber: 2, entryId: "entry-003", entryType: "human_override", modelId: null, parentEntryId: "entry-001", timestamp: "2026-01-01T00:02:00Z" }),
    ];
    const output = formatChainStats("chain-001", entries);
    expect(output).toContain("chain-001");
    expect(output).toContain("Total entries: 3");
    expect(output).toContain("ai_decision: 2");
    expect(output).toContain("human_override: 1");
    expect(output).toContain("Entries with model: 1");
    expect(output).toContain("Entries with parent: 1");
  });

  it("handles empty chain", () => {
    const output = formatChainStats("chain-empty", []);
    expect(output).toContain("Total entries: 0");
  });
});

describe("formatChainList", () => {
  it("formats a table of chains with entry counts", () => {
    const chains = [
      { chainId: "chain-alpha", entryCount: 100 },
      { chainId: "chain-beta", entryCount: 42 },
    ];
    const output = formatChainList(chains);
    expect(output).toContain("chain-alpha");
    expect(output).toContain("100");
    expect(output).toContain("chain-beta");
    expect(output).toContain("42");
  });

  it("returns a message when no chains exist", () => {
    const output = formatChainList([]);
    expect(output).toContain("No chains found");
  });
});

describe("padRight", () => {
  it("pads short strings to the specified width", () => {
    expect(padRight("abc", 6)).toBe("abc   ");
  });

  it("returns the original string when already at or exceeding width", () => {
    expect(padRight("abcdef", 4)).toBe("abcdef");
  });
});
