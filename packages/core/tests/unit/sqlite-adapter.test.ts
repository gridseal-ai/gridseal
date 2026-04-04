import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createSqliteAdapter } from "../../src/storage/sqlite-adapter.js";
import type { StorageAdapter } from "../../src/storage/storage-adapter.js";
import {
  createChain,
  appendEntry,
  makeInput,
  appendN,
} from "./storage-test-helpers.js";

let adapter: StorageAdapter;

beforeEach(() => {
  adapter = createSqliteAdapter({ path: ":memory:" });
});

describe("putEntry / getEntry", () => {
  it("stores and retrieves a proof chain entry by ID", async () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "e-1" }));
    if (!result.ok) throw new Error("append failed");
    const entry = result.value.entry;

    const putResult = await adapter.putEntry(entry);
    expect(putResult.ok).toBe(true);

    const getResult = await adapter.getEntry("e-1");
    expect(getResult.ok).toBe(true);
    if (!getResult.ok) return;
    expect(getResult.value).toEqual(entry);
  });

  it("returns DUPLICATE_ENTRY when storing an entry with an existing ID", async () => {
    const chain = createChain("chain-1");
    const result = appendEntry(chain, makeInput({ entryId: "e-1" }));
    if (!result.ok) throw new Error("append failed");
    const entry = result.value.entry;

    await adapter.putEntry(entry);
    const duplicate = await adapter.putEntry(entry);

    expect(duplicate.ok).toBe(false);
    if (duplicate.ok) return;
    expect(duplicate.error.type).toBe("DUPLICATE_ENTRY");
    expect(duplicate.error).toEqual({
      type: "DUPLICATE_ENTRY",
      entryId: "e-1",
    });
  });

  it("returns ENTRY_NOT_FOUND for a nonexistent entry ID", async () => {
    const result = await adapter.getEntry("nonexistent");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual({
      type: "ENTRY_NOT_FOUND",
      entryId: "nonexistent",
    });
  });
});

describe("getEntriesByChainId", () => {
  it("returns entries ordered by sequenceNumber for a given chain", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 5);

    for (const entry of entries) {
      await adapter.putEntry(entry);
    }

    const result = await adapter.getEntriesByChainId("chain-1");
    expect(result).toHaveLength(5);
    for (let i = 0; i < result.length; i++) {
      expect(result[i].sequenceNumber).toBe(i);
    }
  });

  it("returns an empty array for a nonexistent chain", async () => {
    const result = await adapter.getEntriesByChainId("nonexistent");
    expect(result).toEqual([]);
  });

  it("does not mix entries from different chains", async () => {
    const chain1 = createChain("chain-1");
    const chain2 = createChain("chain-2");
    const { entries: entries1 } = appendN(chain1, 3, "c1");
    const { entries: entries2 } = appendN(chain2, 2, "c2");

    for (const e of [...entries1, ...entries2]) {
      await adapter.putEntry(e);
    }

    const result1 = await adapter.getEntriesByChainId("chain-1");
    const result2 = await adapter.getEntriesByChainId("chain-2");
    expect(result1).toHaveLength(3);
    expect(result2).toHaveLength(2);
    expect(result1.every((e) => e.chainId === "chain-1")).toBe(true);
    expect(result2.every((e) => e.chainId === "chain-2")).toBe(true);
  });
});

describe("getEntriesBySequenceRange", () => {
  it("returns entries within the inclusive sequence range", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 10);

    for (const entry of entries) {
      await adapter.putEntry(entry);
    }

    const result = await adapter.getEntriesBySequenceRange("chain-1", 3, 7);
    expect(result).toHaveLength(5);
    expect(result[0].sequenceNumber).toBe(3);
    expect(result[4].sequenceNumber).toBe(7);
  });

  it("returns empty array for a nonexistent chain", async () => {
    const result = await adapter.getEntriesBySequenceRange("nope", 0, 10);
    expect(result).toEqual([]);
  });

  it("returns empty array when range has no matching entries", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 3);
    for (const entry of entries) {
      await adapter.putEntry(entry);
    }

    const result = await adapter.getEntriesBySequenceRange("chain-1", 10, 20);
    expect(result).toEqual([]);
  });

  it("returns a single entry when start equals end", async () => {
    const chain = createChain("chain-1");
    const { entries } = appendN(chain, 5);
    for (const entry of entries) {
      await adapter.putEntry(entry);
    }

    const result = await adapter.getEntriesBySequenceRange("chain-1", 2, 2);
    expect(result).toHaveLength(1);
    expect(result[0].sequenceNumber).toBe(2);
  });
});

describe("getEntriesByParentId", () => {
  it("returns children of a given parent entry", async () => {
    const chain = createChain("chain-1");
    const rootResult = appendEntry(
      chain,
      makeInput({ entryId: "root" })
    );
    if (!rootResult.ok) throw new Error("append failed");
    let current = rootResult.value.chain;

    const child1Result = appendEntry(
      current,
      makeInput({ entryId: "child-1", parentEntryId: "root" })
    );
    if (!child1Result.ok) throw new Error("append failed");
    current = child1Result.value.chain;

    const child2Result = appendEntry(
      current,
      makeInput({ entryId: "child-2", parentEntryId: "root" })
    );
    if (!child2Result.ok) throw new Error("append failed");
    current = child2Result.value.chain;

    const unrelatedResult = appendEntry(
      current,
      makeInput({ entryId: "unrelated" })
    );
    if (!unrelatedResult.ok) throw new Error("append failed");

    await adapter.putEntry(rootResult.value.entry);
    await adapter.putEntry(child1Result.value.entry);
    await adapter.putEntry(child2Result.value.entry);
    await adapter.putEntry(unrelatedResult.value.entry);

    const children = await adapter.getEntriesByParentId("root");
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.entryId)).toEqual(["child-1", "child-2"]);
  });

  it("returns empty array when no children exist", async () => {
    const result = await adapter.getEntriesByParentId("no-parent");
    expect(result).toEqual([]);
  });
});
