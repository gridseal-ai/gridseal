import { describe, it, expect, beforeEach } from "vitest";
import { verify } from "../../src/commands/verify.js";
import type { StorageAdapter, ProofChainEntry } from "@gridseal/core";
import { createTestChain, createTestTree, createMemoryStorage } from "../helpers.js";

describe("verify command", () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("validates a valid chain of 10 entries", async () => {
    await createTestChain("chain-1", 10, storage);
    const result = await verify({ storage, chainId: "chain-1" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("valid");
    expect(result.message).toContain("10 entries");
  });

  it("detects tampered entry by reporting hash mismatch", async () => {
    const entries = await createTestChain("chain-2", 5, storage);
    const tampered = entries[2];
    if (!tampered) {
      throw new Error("Expected entry at index 2");
    }
    const tamperedEntry: ProofChainEntry = {
      ...tampered,
      modelId: "tampered-model",
    };
    await storage.clear();
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e) {
        continue;
      }
      await storage.putEntry(i === 2 ? tamperedEntry : e);
    }
    const result = await verify({ storage, chainId: "chain-2" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("HASH_MISMATCH");
  });

  it("reports no entries found for nonexistent chain", async () => {
    const result = await verify({ storage, chainId: "nonexistent" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("No entries found");
  });

  it("validates a single entry by ID", async () => {
    await createTestChain("chain-3", 5, storage);
    const result = await verify({ storage, chainId: "chain-3", entryId: "entry-chain-3-2" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("valid");
    expect(result.message).toContain("seq 2");
  });

  it("reports entry not found for invalid entry ID in single entry mode", async () => {
    await createTestChain("chain-4", 3, storage);
    const result = await verify({ storage, chainId: "chain-4", entryId: "nonexistent-entry" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Entry not found");
  });

  it("validates a subtree rooted at a specific entry", async () => {
    await createTestTree("chain-tree", storage);
    const result = await verify({
      storage,
      chainId: "chain-tree",
      entryId: "root-1",
      subtree: true,
    });
    expect(result.success).toBe(true);
    expect(result.message).toContain("Subtree");
    expect(result.message).toContain("root-1");
  });

  it("validates the first entry in a chain with null previousHash", async () => {
    await createTestChain("chain-5", 1, storage);
    const result = await verify({ storage, chainId: "chain-5", entryId: "entry-chain-5-0" });
    expect(result.success).toBe(true);
  });

  it("validates a 100-entry chain", async () => {
    await createTestChain("chain-large", 100, storage);
    const result = await verify({ storage, chainId: "chain-large" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("100 entries");
  });
});
