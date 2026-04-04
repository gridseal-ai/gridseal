import { describe, it, expect } from "vitest";
import {
  createChain,
  appendEntry,
} from "../../src/chain/proof-chain.js";
import {
  validateSubtree,
} from "../../src/chain/validation.js";
import type { ChainState, AppendEntryInput } from "../../src/chain/proof-chain.js";
import type { ProofChainEntry } from "../../src/schema/proof-chain-entry.js";
import type { EntryType } from "../../src/schema/entry-types.js";

function makeInput(overrides: Partial<AppendEntryInput> & { entryId: string }): AppendEntryInput {
  return {
    timestamp: "2026-04-04T00:00:00.000Z",
    entryType: "ai_decision" as EntryType,
    ...overrides,
  };
}

function tamperEntry(
  chain: ChainState,
  index: number,
  fieldOverride: Partial<ProofChainEntry>
): ChainState {
  const entries = chain.entries.slice() as Array<ProofChainEntry>;
  entries[index] = { ...entries[index], ...fieldOverride };
  return { chainId: chain.chainId, entries };
}

describe("validateSubtree", () => {
  it("returns ENTRY_NOT_FOUND for a nonexistent root entry ID", () => {
    const chain0 = createChain("chain-1");
    const r1 = appendEntry(chain0, makeInput({ entryId: "e-0" }));
    if (!r1.ok) throw new Error("append failed");
    const r2 = appendEntry(r1.value.chain, makeInput({ entryId: "e-1" }));
    if (!r2.ok) throw new Error("append failed");
    const r3 = appendEntry(r2.value.chain, makeInput({ entryId: "e-2" }));
    if (!r3.ok) throw new Error("append failed");

    const result = validateSubtree(r3.value.chain, "nonexistent");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("ENTRY_NOT_FOUND");
    if (result.error.type !== "ENTRY_NOT_FOUND") return;
    expect(result.error.entryId).toBe("nonexistent");
  });

  it("validates a subtree with a single root entry", () => {
    const chain0 = createChain("chain-1");
    const r1 = appendEntry(chain0, makeInput({ entryId: "e-0" }));
    if (!r1.ok) throw new Error("append failed");
    const r2 = appendEntry(r1.value.chain, makeInput({ entryId: "e-1" }));
    if (!r2.ok) throw new Error("append failed");
    const r3 = appendEntry(r2.value.chain, makeInput({ entryId: "e-2" }));
    if (!r3.ok) throw new Error("append failed");

    const result = validateSubtree(r3.value.chain, "e-0");
    expect(result.ok).toBe(true);
  });

  it("validates a subtree with parent-child relationships", () => {
    const chain0 = createChain("chain-1");
    const r1 = appendEntry(chain0, makeInput({ entryId: "root" }));
    if (!r1.ok) throw new Error("append failed");

    const r2 = appendEntry(r1.value.chain, makeInput({ entryId: "child-1", parentEntryId: "root" }));
    if (!r2.ok) throw new Error("append failed");

    const r3 = appendEntry(r2.value.chain, makeInput({ entryId: "child-2", parentEntryId: "root" }));
    if (!r3.ok) throw new Error("append failed");

    const r4 = appendEntry(r3.value.chain, makeInput({ entryId: "grandchild-1", parentEntryId: "child-1" }));
    if (!r4.ok) throw new Error("append failed");

    const result = validateSubtree(r4.value.chain, "root");
    expect(result.ok).toBe(true);
  });

  it("detects tampered entry within a subtree", () => {
    const chain0 = createChain("chain-1");
    const r1 = appendEntry(chain0, makeInput({ entryId: "root" }));
    if (!r1.ok) throw new Error("append failed");

    const r2 = appendEntry(r1.value.chain, makeInput({ entryId: "child-1", parentEntryId: "root" }));
    if (!r2.ok) throw new Error("append failed");

    const r3 = appendEntry(r2.value.chain, makeInput({ entryId: "child-2", parentEntryId: "root" }));
    if (!r3.ok) throw new Error("append failed");

    const tampered = tamperEntry(r3.value.chain, 1, { annotation: "tampered" });

    const result = validateSubtree(tampered, "root");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("HASH_MISMATCH");
    if (result.error.type !== "HASH_MISMATCH") return;
    expect(result.error.entryId).toBe("child-1");
  });

  it("does not report errors for entries outside the subtree", () => {
    const chain0 = createChain("chain-1");
    const r1 = appendEntry(chain0, makeInput({ entryId: "root-a" }));
    if (!r1.ok) throw new Error("append failed");

    const r2 = appendEntry(r1.value.chain, makeInput({ entryId: "root-b" }));
    if (!r2.ok) throw new Error("append failed");

    const r3 = appendEntry(r2.value.chain, makeInput({ entryId: "child-of-a", parentEntryId: "root-a" }));
    if (!r3.ok) throw new Error("append failed");

    const tampered = tamperEntry(r3.value.chain, 1, { annotation: "tampered" });

    const result = validateSubtree(tampered, "root-a");
    expect(result.ok).toBe(true);
  });

  it("validates subtree entries check previousHash linkage against the linear chain", () => {
    const chain0 = createChain("chain-1");
    const r1 = appendEntry(chain0, makeInput({ entryId: "root" }));
    if (!r1.ok) throw new Error("append failed");

    const r2 = appendEntry(r1.value.chain, makeInput({ entryId: "child", parentEntryId: "root" }));
    if (!r2.ok) throw new Error("append failed");

    const tampered = tamperEntry(r2.value.chain, 1, { previousHash: "bad-hash" });

    const result = validateSubtree(tampered, "root");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(["HASH_MISMATCH", "PREVIOUS_HASH_MISMATCH"]).toContain(result.error.type);
  });
});
