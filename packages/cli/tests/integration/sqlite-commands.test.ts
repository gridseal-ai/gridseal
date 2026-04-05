import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSqliteAdapter } from "@gridseal/core/sqlite";
import type { StorageAdapter, ProofChainEntry } from "@gridseal/core";
import { verify } from "../../src/commands/verify.js";
import { inspect } from "../../src/commands/inspect.js";
import { list } from "../../src/commands/list.js";
import { stats } from "../../src/commands/stats.js";
import { createTestChain, createTestTree } from "../helpers.js";

describe("CLI commands with SQLite storage", () => {
  let tmpDir: string;
  let storage: StorageAdapter;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "gridseal-cli-test-"));
    const dbPath = join(tmpDir, "test.db");
    storage = createSqliteAdapter({ path: dbPath });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("verify with SQLite", () => {
    it("validates a chain stored in SQLite", async () => {
      await createTestChain("sqlite-chain", 20, storage);
      const result = await verify({ storage, chainId: "sqlite-chain" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("20 entries");
    });

    it("detects tampered entry in SQLite storage", async () => {
      const entries = await createTestChain("sqlite-tampered", 5, storage);
      const target = entries[3];
      if (!target) {
        throw new Error("Expected entry at index 3");
      }
      const tampered: ProofChainEntry = { ...target, annotation: "injected" };
      storage = createSqliteAdapter({ path: join(tmpDir, "test.db") });
      await storage.clear();
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e) {
          continue;
        }
        await storage.putEntry(i === 3 ? tampered : e);
      }
      const result = await verify({ storage, chainId: "sqlite-tampered" });
      expect(result.success).toBe(false);
      expect(result.message).toContain("HASH_MISMATCH");
    });

    it("validates a subtree in SQLite storage", async () => {
      await createTestTree("sqlite-tree", storage);
      const result = await verify({
        storage,
        chainId: "sqlite-tree",
        entryId: "root-1",
        subtree: true,
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Subtree");
    });
  });

  describe("inspect with SQLite", () => {
    it("retrieves and displays entry details from SQLite", async () => {
      await createTestChain("sqlite-inspect", 3, storage);
      const result = await inspect({ storage, entryId: "entry-sqlite-inspect-1" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("entry-sqlite-inspect-1");
      expect(result.message).toContain("sqlite-inspect");
    });

    it("outputs valid JSON from SQLite storage", async () => {
      await createTestChain("sqlite-json", 3, storage);
      const result = await inspect({ storage, entryId: "entry-sqlite-json-0", json: true });
      expect(result.success).toBe(true);
      const parsed = JSON.parse(result.message) as Record<string, unknown>;
      expect(parsed.entryId).toBe("entry-sqlite-json-0");
    });
  });

  describe("list with SQLite", () => {
    it("lists multiple chains from SQLite", async () => {
      await createTestChain("chain-a", 5, storage);
      await createTestChain("chain-b", 8, storage);
      const result = await list({ storage });
      expect(result.success).toBe(true);
      expect(result.message).toContain("chain-a");
      expect(result.message).toContain("chain-b");
    });

    it("lists entries within a chain from SQLite", async () => {
      await createTestChain("chain-entries", 10, storage);
      const result = await list({ storage, chainId: "chain-entries", limit: 5 });
      expect(result.success).toBe(true);
      expect(result.message).toContain("[0]");
      expect(result.message).toContain("5 more entries");
    });
  });

  describe("stats with SQLite", () => {
    it("shows statistics for a chain in SQLite", async () => {
      await createTestTree("sqlite-stats", storage);
      const result = await stats({ storage, chainId: "sqlite-stats" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("Total entries: 5");
      expect(result.message).toContain("ai_decision:");
      expect(result.message).toContain("human_override:");
      expect(result.message).toContain("system_event:");
    });
  });

  describe("data round-trip integrity", () => {
    it("entries written to SQLite and read back produce identical validation results", async () => {
      const entries = await createTestChain("roundtrip", 50, storage);
      const result = await verify({ storage, chainId: "roundtrip" });
      expect(result.success).toBe(true);
      expect(result.message).toContain("50 entries");

      const readBack = await storage.getEntriesByChainId("roundtrip");
      expect(readBack.length).toBe(entries.length);
      for (let i = 0; i < entries.length; i++) {
        const original = entries[i];
        const stored = readBack.find((e) => e.entryId === original?.entryId);
        expect(stored).toBeDefined();
        if (original && stored) {
          expect(stored.entryHash).toBe(original.entryHash);
        }
      }
    });
  });
});
