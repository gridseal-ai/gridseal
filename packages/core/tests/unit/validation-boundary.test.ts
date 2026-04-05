import { describe, it, expect } from "vitest";
import {
  createChain,
  appendEntry,
} from "../../src/chain/proof-chain.js";
import {
  validateEntry,
  validateChain,
  validateSubtree,
} from "../../src/chain/validation.js";
import { computeEntryHash } from "../../src/chain/hash.js";
import type { ChainState, AppendEntryInput } from "../../src/chain/proof-chain.js";
import type { ProofChainEntry } from "../../src/schema/proof-chain-entry.js";
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

function appendN(chain: ChainState, count: number): ChainState {
  let current = chain;
  for (let i = 0; i < count; i++) {
    const result = appendEntry(
      current,
      makeInput({ entryId: `entry-${i}` }),
    );
    if (!result.ok) throw new Error(`Failed to append entry ${i}: ${result.error.type}`);
    current = result.value.chain;
  }
  return current;
}

function tamperEntry(
  chain: ChainState,
  index: number,
  fieldOverride: Partial<ProofChainEntry>,
): ChainState {
  const entries = chain.entries.slice() as Array<ProofChainEntry>;
  entries[index] = { ...entries[index], ...fieldOverride };
  return { chainId: chain.chainId, entries };
}

describe("validateEntry boundary cases", () => {
  it("validates an entry with all 24 fields populated", () => {
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
      policyIds: ["colorado-ai-act"],
      tags: { env: "prod" },
      annotation: "Full entry",
      complianceMetadata: { riskLevel: "high" },
    }));
    if (!result.ok) throw new Error("append failed");

    const validation = validateEntry(result.value.entry);
    expect(validation.ok).toBe(true);
  });

  it("validates an entry with unicode fields", () => {
    const chain = createChain("chain-\u00fc");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-\u00e9",
      annotation: "\u4f60\u597d\u4e16\u754c \ud83d\ude80",
      tags: { "\u00fc": "\u00f6" },
    }));
    if (!result.ok) throw new Error("append failed");

    const validation = validateEntry(result.value.entry);
    expect(validation.ok).toBe(true);
  });

  it("detects single-bit change in annotation (unicode tampering)", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-0",
      annotation: "original text",
    }));
    if (!result.ok) throw new Error("append failed");

    const tampered = { ...result.value.entry, annotation: "Original text" };
    const validation = validateEntry(tampered);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.type).toBe("HASH_MISMATCH");
  });

  it("detects tampering of confidenceScore from 0 to null", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-0",
      confidenceScore: 0,
    }));
    if (!result.ok) throw new Error("append failed");

    const tampered = { ...result.value.entry, confidenceScore: null };
    const validation = validateEntry(tampered);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.type).toBe("HASH_MISMATCH");
  });

  it("detects tampering of empty policyIds to single empty string", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-0",
      policyIds: [],
    }));
    if (!result.ok) throw new Error("append failed");

    const tampered = { ...result.value.entry, policyIds: [""] };
    const validation = validateEntry(tampered);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.type).toBe("HASH_MISMATCH");
  });

  it("detects tampering of tags order (adding a new key)", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-0",
      tags: { a: "1" },
    }));
    if (!result.ok) throw new Error("append failed");

    const tampered = { ...result.value.entry, tags: { a: "1", b: "2" } };
    const validation = validateEntry(tampered);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.error.type).toBe("HASH_MISMATCH");
  });
});

describe("validateChain boundary cases", () => {
  it("validates a chain with all entry types", () => {
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

    let chain = createChain("chain-types");
    for (const entryType of entryTypes) {
      const result = appendEntry(
        chain,
        makeInput({ entryId: `entry-${entryType}`, entryType }),
      );
      if (!result.ok) throw new Error("append failed");
      chain = result.value.chain;
    }

    const validation = validateChain(chain);
    expect(validation.ok).toBe(true);
  });

  it("detects tampering at position 0 (genesis entry)", () => {
    const chain = appendN(createChain("chain-1"), 5);
    const tampered = tamperEntry(chain, 0, { annotation: "tampered-genesis" });

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("HASH_MISMATCH");
    if (result.error.type !== "HASH_MISMATCH") return;
    expect(result.error.sequenceNumber).toBe(0);
  });

  it("detects tampering at the last position", () => {
    const chain = appendN(createChain("chain-1"), 5);
    const tampered = tamperEntry(chain, 4, { annotation: "tampered-last" });

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("HASH_MISMATCH");
    if (result.error.type !== "HASH_MISMATCH") return;
    expect(result.error.sequenceNumber).toBe(4);
  });

  it("detects entry insertion (duplicate sequence number)", () => {
    const chain = appendN(createChain("chain-1"), 3);
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    const duplicate = { ...entries[1], entryId: "duplicate-entry" };
    entries.splice(2, 0, duplicate);
    const tampered: ChainState = { chainId: chain.chainId, entries };

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
  });

  it("detects entry removal (gap in sequence)", () => {
    const chain = appendN(createChain("chain-1"), 5);
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    entries.splice(2, 1);
    const tampered: ChainState = { chainId: chain.chainId, entries };

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
  });

  it("detects entry swap (two adjacent entries swapped)", () => {
    const chain = appendN(createChain("chain-1"), 5);
    const entries = chain.entries.slice() as Array<ProofChainEntry>;
    const temp = entries[2];
    entries[2] = entries[3];
    entries[3] = temp;
    const tampered: ChainState = { chainId: chain.chainId, entries };

    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
  });

  it("validates a chain with tree-structured entries (parent-child)", () => {
    let chain = createChain("tree-chain");
    const r0 = appendEntry(chain, makeInput({ entryId: "root" }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;

    const r1 = appendEntry(chain, makeInput({ entryId: "child-1", parentEntryId: "root" }));
    if (!r1.ok) throw new Error("append failed");
    chain = r1.value.chain;

    const r2 = appendEntry(chain, makeInput({ entryId: "child-2", parentEntryId: "root" }));
    if (!r2.ok) throw new Error("append failed");
    chain = r2.value.chain;

    const r3 = appendEntry(chain, makeInput({ entryId: "grandchild", parentEntryId: "child-1" }));
    if (!r3.ok) throw new Error("append failed");
    chain = r3.value.chain;

    const validation = validateChain(chain);
    expect(validation.ok).toBe(true);
  });

  it("detects tampering in a tree-structured chain at a child entry", () => {
    let chain = createChain("tree-chain");
    const r0 = appendEntry(chain, makeInput({ entryId: "root" }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;

    const r1 = appendEntry(chain, makeInput({ entryId: "child", parentEntryId: "root" }));
    if (!r1.ok) throw new Error("append failed");
    chain = r1.value.chain;

    const tampered = tamperEntry(chain, 1, { annotation: "tampered-child" });
    const result = validateChain(tampered);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("HASH_MISMATCH");
  });

  it("validates chain with entries containing null vs populated optional fields", () => {
    let chain = createChain("mixed-chain");
    const r0 = appendEntry(chain, makeInput({
      entryId: "minimal",
    }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;

    const r1 = appendEntry(chain, makeInput({
      entryId: "full",
      modelId: "gpt-4o",
      modelProvider: "openai",
      inputHash: "d".repeat(64),
      outputHash: "e".repeat(64),
      inputTokenCount: 500,
      outputTokenCount: 250,
      decisionType: "classification",
      confidenceScore: 0.8,
      sessionId: "s-1",
      actorId: "a-1",
      policyIds: ["p1", "p2"],
      tags: { key: "value" },
      annotation: "annotated",
      complianceMetadata: { risk: "low" },
    }));
    if (!r1.ok) throw new Error("append failed");
    chain = r1.value.chain;

    const validation = validateChain(chain);
    expect(validation.ok).toBe(true);
  });
});

describe("validateSubtree boundary cases", () => {
  it("validates a subtree with deeply nested entries (5 levels)", () => {
    let chain = createChain("deep-chain");
    const r0 = appendEntry(chain, makeInput({ entryId: "l0" }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;

    for (let i = 1; i <= 5; i++) {
      const result = appendEntry(
        chain,
        makeInput({ entryId: `l${i}`, parentEntryId: `l${i - 1}` }),
      );
      if (!result.ok) throw new Error("append failed");
      chain = result.value.chain;
    }

    const result = validateSubtree(chain, "l0");
    expect(result.ok).toBe(true);
  });

  it("detects tampering in a deeply nested subtree entry", () => {
    let chain = createChain("deep-chain");
    const r0 = appendEntry(chain, makeInput({ entryId: "l0" }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;

    for (let i = 1; i <= 3; i++) {
      const result = appendEntry(
        chain,
        makeInput({ entryId: `l${i}`, parentEntryId: `l${i - 1}` }),
      );
      if (!result.ok) throw new Error("append failed");
      chain = result.value.chain;
    }

    const tampered = tamperEntry(chain, 3, { annotation: "tampered-deep" });
    const result = validateSubtree(tampered, "l0");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("HASH_MISMATCH");
    if (result.error.type !== "HASH_MISMATCH") return;
    expect(result.error.entryId).toBe("l3");
  });

  it("validates only the targeted subtree when sibling subtrees are tampered", () => {
    let chain = createChain("multi-tree");
    const r0 = appendEntry(chain, makeInput({ entryId: "tree-a" }));
    if (!r0.ok) throw new Error("append failed");
    chain = r0.value.chain;

    const r1 = appendEntry(chain, makeInput({ entryId: "tree-b" }));
    if (!r1.ok) throw new Error("append failed");
    chain = r1.value.chain;

    const r2 = appendEntry(chain, makeInput({ entryId: "child-a", parentEntryId: "tree-a" }));
    if (!r2.ok) throw new Error("append failed");
    chain = r2.value.chain;

    const r3 = appendEntry(chain, makeInput({ entryId: "child-b", parentEntryId: "tree-b" }));
    if (!r3.ok) throw new Error("append failed");
    chain = r3.value.chain;

    const tampered = tamperEntry(chain, 3, { annotation: "tampered-b-child" });

    const resultA = validateSubtree(tampered, "tree-a");
    expect(resultA.ok).toBe(true);

    const resultB = validateSubtree(tampered, "tree-b");
    expect(resultB.ok).toBe(false);
  });
});

describe("tamper detection at every position in a chain", () => {
  it("detects tampering at each of 20 positions", () => {
    const chain = appendN(createChain("chain-tamper"), 20);

    for (let i = 0; i < 20; i++) {
      const tampered = tamperEntry(chain, i, { annotation: `tampered-at-${i}` });
      const result = validateChain(tampered);
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.type).toBe("HASH_MISMATCH");
      if (result.error.type !== "HASH_MISMATCH") continue;
      expect(result.error.sequenceNumber).toBe(i);
    }
  });
});
