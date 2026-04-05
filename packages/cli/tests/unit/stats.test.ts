import { describe, it, expect, beforeEach } from "vitest";
import { stats } from "../../src/commands/stats.js";
import type { StorageAdapter } from "@gridseal/core";
import { createTestChain, createTestTree, createMemoryStorage } from "../helpers.js";

describe("stats command", () => {
  let storage: StorageAdapter;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("shows entry count and type distribution for a chain", async () => {
    await createTestChain("chain-1", 10, storage);
    const result = await stats({ storage, chainId: "chain-1" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("chain-1");
    expect(result.message).toContain("Total entries: 10");
    expect(result.message).toContain("ai_decision: 10");
  });

  it("shows model and parent counts", async () => {
    await createTestTree("chain-tree", storage);
    const result = await stats({ storage, chainId: "chain-tree" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("Total entries: 5");
    expect(result.message).toContain("Entries with model: 5");
    expect(result.message).toContain("Entries with parent: 3");
  });

  it("shows entry type distribution across multiple types", async () => {
    await createTestTree("chain-tree2", storage);
    const result = await stats({ storage, chainId: "chain-tree2" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("ai_decision:");
    expect(result.message).toContain("human_override:");
    expect(result.message).toContain("system_event:");
  });

  it("shows timestamp range", async () => {
    await createTestChain("chain-ts", 3, storage);
    const result = await stats({ storage, chainId: "chain-ts" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("First entry: 2026-01-01T00:00:00Z");
    expect(result.message).toContain("Last entry:  2026-01-01T00:00:02Z");
  });

  it("reports no entries for nonexistent chain", async () => {
    const result = await stats({ storage, chainId: "nonexistent" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("No entries found");
  });
});
