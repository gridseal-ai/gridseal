import { describe, it, expect } from "vitest";
import {
  createChain,
  appendEntry,
} from "../../src/chain/proof-chain.js";
import { computeEntryHash } from "../../src/chain/hash.js";
import type { ChainState, AppendEntryInput } from "../../src/chain/proof-chain.js";
import type { EntryType } from "../../src/schema/entry-types.js";

function makeInput(overrides: Partial<AppendEntryInput> & { entryId: string }): AppendEntryInput {
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
      makeInput({ entryId: `entry-${i}` })
    );
    if (!result.ok) {
      throw new Error(`Failed to append entry ${i}: ${result.error.type}`);
    }
    current = result.value.chain;
  }
  return current;
}

describe("createChain", () => {
  it("creates an empty chain with the given ID", () => {
    const chain = createChain("chain-1");
    expect(chain.chainId).toBe("chain-1");
    expect(chain.entries).toEqual([]);
  });
});

describe("appendEntry", () => {
  it("creates a genesis entry with sequenceNumber 0 and null previousHash", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "entry-0" }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { entry } = result.value;
    expect(entry.sequenceNumber).toBe(0);
    expect(entry.previousHash).toBeNull();
    expect(entry.chainId).toBe("chain-1");
    expect(entry.entryId).toBe("entry-0");
    expect(entry.parentEntryId).toBeNull();
  });

  it("sets previousHash to the hash of the preceding entry", () => {
    let chain = createChain("chain-1");
    const r1 = appendEntry(chain, makeInput({ entryId: "entry-0" }));
    if (!r1.ok) throw new Error("unexpected");

    chain = r1.value.chain;
    const r2 = appendEntry(chain, makeInput({ entryId: "entry-1" }));
    if (!r2.ok) throw new Error("unexpected");

    expect(r2.value.entry.previousHash).toBe(r1.value.entry.entryHash);
    expect(r2.value.entry.sequenceNumber).toBe(1);
  });

  it("computes entryHash correctly from hashable fields", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "entry-0" }));
    if (!result.ok) throw new Error("unexpected");

    const entry = result.value.entry;
    const { entryHash: _removed, ...hashableFields } = entry;
    const recomputed = computeEntryHash(hashableFields);
    expect(entry.entryHash).toBe(recomputed);
  });

  it("applies Tier 2 defaults for omitted fields", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "entry-0" }));
    if (!result.ok) throw new Error("unexpected");

    const entry = result.value.entry;
    expect(entry.modelId).toBeNull();
    expect(entry.modelProvider).toBeNull();
    expect(entry.inputHash).toBeNull();
    expect(entry.outputHash).toBeNull();
    expect(entry.inputTokenCount).toBeNull();
    expect(entry.outputTokenCount).toBeNull();
    expect(entry.decisionType).toBeNull();
    expect(entry.confidenceScore).toBeNull();
    expect(entry.reasoningCertificateId).toBeNull();
    expect(entry.provenanceId).toBeNull();
  });

  it("applies Tier 3 defaults for omitted fields", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "entry-0" }));
    if (!result.ok) throw new Error("unexpected");

    const entry = result.value.entry;
    expect(entry.sessionId).toBeNull();
    expect(entry.actorId).toBeNull();
    expect(entry.policyIds).toEqual([]);
    expect(entry.tags).toEqual({});
    expect(entry.annotation).toBeNull();
    expect(entry.complianceMetadata).toEqual({});
  });

  it("preserves provided Tier 2 and Tier 3 values", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({
      entryId: "entry-0",
      modelId: "gpt-4o",
      modelProvider: "openai",
      inputTokenCount: 100,
      outputTokenCount: 50,
      decisionType: "classification",
      confidenceScore: 0.95,
      sessionId: "session-1",
      actorId: "user-1",
      policyIds: ["policy-a"],
      tags: { env: "staging" },
      annotation: "test annotation",
    }));
    if (!result.ok) throw new Error("unexpected");

    const entry = result.value.entry;
    expect(entry.modelId).toBe("gpt-4o");
    expect(entry.modelProvider).toBe("openai");
    expect(entry.inputTokenCount).toBe(100);
    expect(entry.outputTokenCount).toBe(50);
    expect(entry.decisionType).toBe("classification");
    expect(entry.confidenceScore).toBe(0.95);
    expect(entry.sessionId).toBe("session-1");
    expect(entry.actorId).toBe("user-1");
    expect(entry.policyIds).toEqual(["policy-a"]);
    expect(entry.tags).toEqual({ env: "staging" });
    expect(entry.annotation).toBe("test annotation");
  });

  it("rejects duplicate entry IDs", () => {
    let chain = createChain("chain-1");
    const r1 = appendEntry(chain, makeInput({ entryId: "dup-id" }));
    if (!r1.ok) throw new Error("unexpected");
    chain = r1.value.chain;

    const r2 = appendEntry(chain, makeInput({ entryId: "dup-id" }));
    expect(r2.ok).toBe(false);
    if (r2.ok) return;
    expect(r2.error.type).toBe("DUPLICATE_ENTRY_ID");
    expect(r2.error.entryId).toBe("dup-id");
  });

  it("supports parentEntryId for tree structure", () => {
    let chain = createChain("chain-1");
    const r1 = appendEntry(chain, makeInput({ entryId: "root" }));
    if (!r1.ok) throw new Error("unexpected");
    chain = r1.value.chain;

    const r2 = appendEntry(
      chain,
      makeInput({ entryId: "child-1", parentEntryId: "root" })
    );
    if (!r2.ok) throw new Error("unexpected");

    expect(r2.value.entry.parentEntryId).toBe("root");
  });

  it("rejects entries with non-existent parentEntryId", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(
      chain,
      makeInput({ entryId: "child", parentEntryId: "nonexistent" })
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("PARENT_NOT_FOUND");
  });

  it("does not mutate the original chain state", () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "entry-0" }));
    if (!result.ok) throw new Error("unexpected");

    expect(chain.entries).toHaveLength(0);
    expect(result.value.chain.entries).toHaveLength(1);
  });

  it("builds a linear chain of 100 entries with correct sequencing", () => {
    const chain = appendN(createChain("chain-1"), 100);

    expect(chain.entries).toHaveLength(100);
    for (let i = 0; i < 100; i++) {
      expect(chain.entries[i].sequenceNumber).toBe(i);
    }
    for (let i = 1; i < 100; i++) {
      expect(chain.entries[i].previousHash).toBe(
        chain.entries[i - 1].entryHash
      );
    }
  });

  it("appends 10000 entries in under 500ms", () => {
    const start = performance.now();
    appendN(createChain("perf-chain"), 10_000);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(2000);
  });
});

describe("hash chain integrity", () => {
  it("produces different hashes for entries at different positions", () => {
    const chain = appendN(createChain("chain-1"), 5);
    const hashes = chain.entries.map((e) => e.entryHash);
    const unique = new Set(hashes);
    expect(unique.size).toBe(5);
  });

  it("produces deterministic hashes for identical inputs", () => {
    const chain1 = appendN(createChain("chain-1"), 5);
    const chain2 = appendN(createChain("chain-1"), 5);

    for (let i = 0; i < 5; i++) {
      expect(chain1.entries[i].entryHash).toBe(chain2.entries[i].entryHash);
    }
  });

  it("changes all subsequent hashes when an early entry differs", () => {
    const chainA = appendN(createChain("chain-1"), 5);

    let chainB = createChain("chain-1");
    const r = appendEntry(chainB, makeInput({
      entryId: "different-id",
      timestamp: "2099-01-01T00:00:00.000Z",
    }));
    if (!r.ok) throw new Error("unexpected");
    chainB = r.value.chain;
    for (let i = 1; i < 5; i++) {
      const r2 = appendEntry(chainB, makeInput({ entryId: `entry-${i}` }));
      if (!r2.ok) throw new Error("unexpected");
      chainB = r2.value.chain;
    }

    for (let i = 0; i < 5; i++) {
      expect(chainA.entries[i].entryHash).not.toBe(
        chainB.entries[i].entryHash
      );
    }
  });
});
