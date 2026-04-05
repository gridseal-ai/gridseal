import { describe, it, expect, beforeEach } from "vitest";
import { list } from "../../src/commands/list.js";
import type { StorageAdapter } from "@gridseal/core";
import { createTestChain, createMemoryStorage } from "../helpers.js";

describe("list command", () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("lists all chains with entry counts", async () => {
    await createTestChain("chain-alpha", 10, storage);
    await createTestChain("chain-beta", 5, storage);
    const result = await list({ storage });
    expect(result.success).toBe(true);
    expect(result.message).toContain("chain-alpha");
    expect(result.message).toContain("10");
    expect(result.message).toContain("chain-beta");
    expect(result.message).toContain("5");
  });

  it("reports no chains when storage is empty", async () => {
    const result = await list({ storage });
    expect(result.success).toBe(true);
    expect(result.message).toContain("No chains found");
  });

  it("lists entries within a specific chain", async () => {
    await createTestChain("chain-1", 5, storage);
    const result = await list({ storage, chainId: "chain-1" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("[0]");
    expect(result.message).toContain("[4]");
    expect(result.message).toContain("ai_decision");
  });

  it("limits the number of entries shown with --limit", async () => {
    await createTestChain("chain-2", 10, storage);
    const result = await list({ storage, chainId: "chain-2", limit: 3 });
    expect(result.success).toBe(true);
    expect(result.message).toContain("[0]");
    expect(result.message).toContain("[2]");
    expect(result.message).not.toContain("[3]");
    expect(result.message).toContain("7 more entries");
  });

  it("reports no entries for nonexistent chain", async () => {
    const result = await list({ storage, chainId: "nonexistent" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("No entries found");
  });
});
