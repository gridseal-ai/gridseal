import { describe, it, expect } from "vitest";
import {
  createChain,
  appendEntry,
  getChildren,
  getRootEntries,
  getSubtree,
  getLastEntry,
} from "../../src/chain/proof-chain.js";
import type { ChainState, AppendEntryInput } from "../../src/chain/proof-chain.js";
import type { EntryType } from "../../src/schema/entry-types.js";

function makeInput(overrides: Partial<AppendEntryInput> & { entryId: string }): AppendEntryInput {
  return {
    timestamp: "2026-04-04T00:00:00.000Z",
    entryType: "ai_decision" as EntryType,
    ...overrides,
  };
}

function appendOrThrow(chain: ChainState, input: AppendEntryInput): { chain: ChainState } {
  const result = appendEntry(chain, input);
  if (!result.ok) throw new Error(`Failed: ${result.error.type}`);
  return result.value;
}

describe("getChildren", () => {
  it("returns direct children of a given entry", () => {
    let chain = createChain("chain-1");
    chain = appendOrThrow(chain, makeInput({ entryId: "root" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "child-1", parentEntryId: "root" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "child-2", parentEntryId: "root" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "grandchild", parentEntryId: "child-1" })).chain;

    const children = getChildren(chain, "root");
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.entryId)).toEqual(["child-1", "child-2"]);
  });

  it("returns empty array for entries with no children", () => {
    let chain = createChain("chain-1");
    chain = appendOrThrow(chain, makeInput({ entryId: "leaf" })).chain;
    expect(getChildren(chain, "leaf")).toEqual([]);
  });
});

describe("getRootEntries", () => {
  it("returns entries with no parentEntryId", () => {
    let chain = createChain("chain-1");
    chain = appendOrThrow(chain, makeInput({ entryId: "root-1" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "root-2" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "child", parentEntryId: "root-1" })).chain;

    const roots = getRootEntries(chain);
    expect(roots).toHaveLength(2);
    expect(roots.map((r) => r.entryId)).toEqual(["root-1", "root-2"]);
  });
});

describe("getSubtree", () => {
  it("returns the full subtree rooted at a given entry", () => {
    let chain = createChain("chain-1");
    chain = appendOrThrow(chain, makeInput({ entryId: "root" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "child-1", parentEntryId: "root" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "child-2", parentEntryId: "root" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "grandchild", parentEntryId: "child-1" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "unrelated" })).chain;

    const subtree = getSubtree(chain, "root");
    expect(subtree).toHaveLength(4);
    expect(subtree.map((e) => e.entryId)).toEqual([
      "root",
      "child-1",
      "child-2",
      "grandchild",
    ]);
  });

  it("returns empty array for nonexistent entry ID", () => {
    const chain = createChain("chain-1");
    expect(getSubtree(chain, "nonexistent")).toEqual([]);
  });

  it("returns single entry when the root has no children", () => {
    let chain = createChain("chain-1");
    chain = appendOrThrow(chain, makeInput({ entryId: "leaf" })).chain;

    const subtree = getSubtree(chain, "leaf");
    expect(subtree).toHaveLength(1);
    expect(subtree[0].entryId).toBe("leaf");
  });
});

describe("getLastEntry", () => {
  it("returns undefined for an empty chain", () => {
    const chain = createChain("chain-1");
    expect(getLastEntry(chain)).toBeUndefined();
  });

  it("returns the most recently appended entry", () => {
    let chain = createChain("chain-1");
    chain = appendOrThrow(chain, makeInput({ entryId: "first" })).chain;
    chain = appendOrThrow(chain, makeInput({ entryId: "second" })).chain;

    const last = getLastEntry(chain);
    expect(last).toBeDefined();
    expect(last?.entryId).toBe("second");
  });
});
