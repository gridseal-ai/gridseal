import { describe, it, expect } from "vitest";
import {
  createChain,
  appendEntry,
  getChildren,
  getRootEntries,
  getSubtree,
  getLastEntry,
} from "../../src/chain/proof-chain.js";
import { computeEntryHash } from "../../src/chain/hash.js";
import type { ChainState, AppendEntryInput } from "../../src/chain/proof-chain.js";
import type { EntryType } from "../../src/schema/entry-types.js";

function makeInput(
  overrides: Partial<AppendEntryInput> & { entryId: string },
): AppendEntryInput {
  return {
    timestamp: "2026-04-04T00:00:00.000Z",
    entryType: "ai_decision" as EntryType,
    ...overrides,
  };
}

function appendOrThrow(
  chain: ChainState,
  input: AppendEntryInput,
): { chain: ChainState; entry: ReturnType<typeof appendEntry> extends { ok: true; value: infer V } ? V : never } {
  const result = appendEntry(chain, input);
  if (!result.ok) throw new Error(`Failed: ${result.error.type}`);
  return { chain: result.value.chain, entry: result.value as never };
}

function appendN(chain: ChainState, count: number, prefix = "entry"): ChainState {
  let current = chain;
  for (let i = 0; i < count; i++) {
    const result = appendEntry(
      current,
      makeInput({ entryId: `${prefix}-${i}` }),
    );
    if (!result.ok) throw new Error(`Failed to append entry ${i}: ${result.error.type}`);
    current = result.value.chain;
  }
  return current;
}

describe("createChain boundary", () => {
  it("creates a chain with an empty string ID", () => {
    const chain = createChain("");
    expect(chain.chainId).toBe("");
    expect(chain.entries).toEqual([]);
  });

  it("creates a chain with a unicode ID", () => {
    const chain = createChain("\u4f60\u597d-chain-\ud83d\ude80");
    expect(chain.chainId).toBe("\u4f60\u597d-chain-\ud83d\ude80");
  });

  it("creates a chain with a very long ID (1000 characters)", () => {
    const longId = "c".repeat(1000);
    const chain = createChain(longId);
    expect(chain.chainId).toBe(longId);
  });
});

describe("appendEntry boundary inputs", () => {
  it("appends an entry with unicode in all string fields", () => {
    const chain = createChain("chain-\u00fc");
    const result = appendEntry(
      chain,
      makeInput({
        entryId: "entry-\u00e9",
        modelId: "\u00e9l\u00e8ve-model",
        modelProvider: "fournisseur-\u00e7a",
        sessionId: "session-\u4f60\u597d",
        actorId: "user-\ud83d\ude80",
        annotation: "\u4f60\u597d\u4e16\u754c - \ud83c\udf1f stars",
        tags: { "\u00fc": "\u00f6" },
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entry.modelId).toBe("\u00e9l\u00e8ve-model");
    expect(result.value.entry.annotation).toBe("\u4f60\u597d\u4e16\u754c - \ud83c\udf1f stars");
    expect(result.value.entry.tags).toEqual({ "\u00fc": "\u00f6" });
  });

  it("appends an entry with maximum-length annotation (10K characters)", () => {
    const chain = createChain("chain-1");
    const longAnnotation = "x".repeat(10_000);
    const result = appendEntry(
      chain,
      makeInput({ entryId: "entry-long", annotation: longAnnotation }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entry.annotation).toBe(longAnnotation);
  });

  it("appends entries with all 8 entry types and verifies hash uniqueness", () => {
    const entryTypes: ReadonlyArray<EntryType> = [
      "ai_decision",
      "human_override",
      "system_event",
      "policy_check",
      "data_access",
      "model_deployment",
      "feedback",
      "correction",
    ];
    const hashes = new Set<string>();

    let chain = createChain("chain-types");
    for (const entryType of entryTypes) {
      const result = appendEntry(
        chain,
        makeInput({ entryId: `entry-${entryType}`, entryType }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      hashes.add(result.value.entry.entryHash);
      chain = result.value.chain;
    }
    expect(hashes.size).toBe(8);
  });

  it("preserves all 24 fields on a fully-populated entry", () => {
    const chain = createChain("chain-full");
    const result = appendEntry(chain, makeInput({
      entryId: "full-entry",
      modelId: "claude-sonnet-4-20250514",
      modelProvider: "anthropic",
      inputHash: "b".repeat(64),
      outputHash: "c".repeat(64),
      inputTokenCount: 1500,
      outputTokenCount: 3000,
      decisionType: "generation",
      confidenceScore: 0.95,
      reasoningCertificateId: "cert-001",
      provenanceId: "prov-001",
      sessionId: "session-001",
      actorId: "user-42",
      policyIds: ["colorado-ai-act", "eu-ai-act"],
      tags: { env: "prod", team: "ml" },
      annotation: "Full entry test",
      complianceMetadata: { riskLevel: "high" },
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = result.value.entry;

    expect(Object.keys(entry)).toHaveLength(24);
    expect(entry.modelId).toBe("claude-sonnet-4-20250514");
    expect(entry.modelProvider).toBe("anthropic");
    expect(entry.inputHash).toBe("b".repeat(64));
    expect(entry.outputHash).toBe("c".repeat(64));
    expect(entry.inputTokenCount).toBe(1500);
    expect(entry.outputTokenCount).toBe(3000);
    expect(entry.decisionType).toBe("generation");
    expect(entry.confidenceScore).toBe(0.95);
    expect(entry.reasoningCertificateId).toBe("cert-001");
    expect(entry.provenanceId).toBe("prov-001");
    expect(entry.sessionId).toBe("session-001");
    expect(entry.actorId).toBe("user-42");
    expect(entry.policyIds).toEqual(["colorado-ai-act", "eu-ai-act"]);
    expect(entry.tags).toEqual({ env: "prod", team: "ml" });
    expect(entry.annotation).toBe("Full entry test");
    expect(entry.complianceMetadata).toEqual({ riskLevel: "high" });

    const { entryHash: _removed, ...hashableFields } = entry;
    const recomputed = computeEntryHash(hashableFields);
    expect(entry.entryHash).toBe(recomputed);
  });

  it("handles entry with zero token counts", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "zero-tokens",
      inputTokenCount: 0,
      outputTokenCount: 0,
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entry.inputTokenCount).toBe(0);
    expect(result.value.entry.outputTokenCount).toBe(0);
  });

  it("handles entry with confidence score at boundary values", () => {
    const chain = createChain("chain-1");
    const r1 = appendEntry(chain, makeInput({
      entryId: "score-zero",
      confidenceScore: 0,
    }));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.value.entry.confidenceScore).toBe(0);

    const r2 = appendEntry(r1.value.chain, makeInput({
      entryId: "score-one",
      confidenceScore: 1,
    }));
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    expect(r2.value.entry.confidenceScore).toBe(1);
  });

  it("handles entry with empty policyIds and tags", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "empty-collections",
      policyIds: [],
      tags: {},
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entry.policyIds).toEqual([]);
    expect(result.value.entry.tags).toEqual({});
  });

  it("handles entry with special characters in entryId", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-with/slashes-and:colons",
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entry.entryId).toBe("entry-with/slashes-and:colons");
  });

  it("handles entry with newlines in annotation", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-newlines",
      annotation: "line1\nline2\r\nline3",
    }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.entry.annotation).toBe("line1\nline2\r\nline3");
  });
});

describe("appendEntry determinism", () => {
  it("produces identical chains when built from identical inputs", () => {
    const build = (): ChainState => {
      let chain = createChain("determinism-chain");
      for (let i = 0; i < 10; i++) {
        const result = appendEntry(chain, makeInput({
          entryId: `entry-${i}`,
          modelId: "test-model",
          annotation: `Entry number ${i}`,
        }));
        if (!result.ok) throw new Error("append failed");
        chain = result.value.chain;
      }
      return chain;
    };

    const chain1 = build();
    const chain2 = build();

    for (let i = 0; i < 10; i++) {
      expect(chain1.entries[i].entryHash).toBe(chain2.entries[i].entryHash);
      expect(chain1.entries[i].previousHash).toBe(chain2.entries[i].previousHash);
    }
  });
});

describe("tree structure boundary cases", () => {
  it("supports deeply nested tree (10 levels deep)", () => {
    let chain = createChain("deep-tree");
    const r0 = appendEntry(chain, makeInput({ entryId: "level-0" }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;

    for (let i = 1; i <= 10; i++) {
      const result = appendEntry(
        chain,
        makeInput({ entryId: `level-${i}`, parentEntryId: `level-${i - 1}` }),
      );
      if (!result.ok) throw new Error(`Failed at level ${i}`);
      chain = result.value.chain;
    }

    expect(chain.entries).toHaveLength(11);
    const subtree = getSubtree(chain, "level-0");
    expect(subtree).toHaveLength(11);
  });

  it("supports wide tree (one parent with 50 children)", () => {
    let chain = createChain("wide-tree");
    const r0 = appendEntry(chain, makeInput({ entryId: "root" }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;

    for (let i = 0; i < 50; i++) {
      const result = appendEntry(
        chain,
        makeInput({ entryId: `child-${i}`, parentEntryId: "root" }),
      );
      if (!result.ok) throw new Error(`Failed at child ${i}`);
      chain = result.value.chain;
    }

    const children = getChildren(chain, "root");
    expect(children).toHaveLength(50);
    expect(getRootEntries(chain)).toHaveLength(1);
  });

  it("getChildren returns empty for nonexistent parent ID in populated chain", () => {
    const chain = appendN(createChain("chain-1"), 5);
    expect(getChildren(chain, "nonexistent-parent")).toEqual([]);
  });

  it("getRootEntries returns empty for an empty chain", () => {
    const chain = createChain("empty-chain");
    expect(getRootEntries(chain)).toEqual([]);
  });

  it("getLastEntry returns the last entry in a single-entry chain", () => {
    let chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "only-entry" }));
    if (!result.ok) throw new Error("append failed");
    chain = result.value.chain;

    const last = getLastEntry(chain);
    expect(last).toBeDefined();
    expect(last?.entryId).toBe("only-entry");
    expect(last?.sequenceNumber).toBe(0);
  });

  it("getSubtree with multiple independent subtrees returns correct subtree", () => {
    let chain = createChain("multi-tree");
    const entries = [
      makeInput({ entryId: "tree-a-root" }),
      makeInput({ entryId: "tree-b-root" }),
      makeInput({ entryId: "tree-a-child-1", parentEntryId: "tree-a-root" }),
      makeInput({ entryId: "tree-a-child-2", parentEntryId: "tree-a-root" }),
      makeInput({ entryId: "tree-b-child-1", parentEntryId: "tree-b-root" }),
    ];

    for (const input of entries) {
      const result = appendEntry(chain, input);
      if (!result.ok) throw new Error(`Failed: ${result.error.type}`);
      chain = result.value.chain;
    }

    const subtreeA = getSubtree(chain, "tree-a-root");
    expect(subtreeA).toHaveLength(3);
    expect(subtreeA.map((e) => e.entryId)).toContain("tree-a-root");
    expect(subtreeA.map((e) => e.entryId)).toContain("tree-a-child-1");
    expect(subtreeA.map((e) => e.entryId)).toContain("tree-a-child-2");
    expect(subtreeA.map((e) => e.entryId)).not.toContain("tree-b-root");
    expect(subtreeA.map((e) => e.entryId)).not.toContain("tree-b-child-1");

    const subtreeB = getSubtree(chain, "tree-b-root");
    expect(subtreeB).toHaveLength(2);
  });
});

describe("hash chain integrity boundary", () => {
  it("single-entry chain has null previousHash and valid entryHash", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "only" }));
    if (!result.ok) throw new Error("append failed");

    const entry = result.value.entry;
    expect(entry.previousHash).toBeNull();
    expect(entry.entryHash).toMatch(/^[0-9a-f]{64}$/);

    const { entryHash: _removed, ...hashable } = entry;
    expect(entry.entryHash).toBe(computeEntryHash(hashable));
  });

  it("hash integrity holds after appending 1000 entries", () => {
    const chain = appendN(createChain("big-chain"), 1000);
    expect(chain.entries).toHaveLength(1000);

    expect(chain.entries[0].previousHash).toBeNull();
    for (let i = 1; i < 1000; i++) {
      expect(chain.entries[i].previousHash).toBe(chain.entries[i - 1].entryHash);
    }

    for (let i = 0; i < 1000; i++) {
      const { entryHash: _removed, ...hashable } = chain.entries[i];
      expect(chain.entries[i].entryHash).toBe(computeEntryHash(hashable));
    }
  });
});
