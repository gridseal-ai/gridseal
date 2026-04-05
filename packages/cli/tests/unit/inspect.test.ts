import { describe, it, expect, beforeEach } from "vitest";
import { inspect } from "../../src/commands/inspect.js";
import type { StorageAdapter } from "@gridseal/core";
import { createTestChain, createMemoryStorage } from "../helpers.js";

describe("inspect command", () => {
  let storage: StorageAdapter;

  beforeEach(async () => {
    storage = createMemoryStorage();
    await createTestChain("chain-1", 5, storage);
  });

  it("shows detailed entry information in text format", async () => {
    const result = await inspect({ storage, entryId: "entry-chain-1-0" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("entry-chain-1-0");
    expect(result.message).toContain("chain-1");
    expect(result.message).toContain("ai_decision");
    expect(result.message).toContain("2026-01-01T00:00:00Z");
  });

  it("shows entry in JSON format when --json is specified", async () => {
    const result = await inspect({ storage, entryId: "entry-chain-1-0", json: true });
    expect(result.success).toBe(true);
    const parsed = JSON.parse(result.message) as Record<string, unknown>;
    expect(parsed.entryId).toBe("entry-chain-1-0");
    expect(parsed.chainId).toBe("chain-1");
    expect(parsed.entryType).toBe("ai_decision");
  });

  it("reports entry not found for nonexistent entry ID", async () => {
    const result = await inspect({ storage, entryId: "nonexistent" });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Entry not found");
  });

  it("shows tier 2 model fields when present", async () => {
    const result = await inspect({ storage, entryId: "entry-chain-1-0" });
    expect(result.success).toBe(true);
    expect(result.message).toContain("gpt-4");
    expect(result.message).toContain("openai");
  });
});
