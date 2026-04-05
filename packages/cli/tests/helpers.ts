import {
  createChain,
  appendEntry,
  createInMemoryAdapter,
} from "@gridseal/core";
import { createSqliteAdapter } from "@gridseal/core/sqlite";
import type { ProofChainEntry, StorageAdapter, ChainState } from "@gridseal/core";

/** Create a chain with N entries in an in-memory storage adapter. */
export async function createTestChain(
  chainId: string,
  count: number,
  storage: StorageAdapter
): Promise<ReadonlyArray<ProofChainEntry>> {
  let chain: ChainState = createChain(chainId);
  const entries: Array<ProofChainEntry> = [];

  for (let i = 0; i < count; i++) {
    const result = appendEntry(chain, {
      entryId: `entry-${chainId}-${i}`,
      timestamp: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
      entryType: "ai_decision",
      modelId: i % 2 === 0 ? "gpt-4" : null,
      modelProvider: i % 2 === 0 ? "openai" : null,
    });

    if (!result.ok) {
      throw new Error(`Failed to create test entry: ${JSON.stringify(result.error)}`);
    }

    chain = result.value.chain;
    entries.push(result.value.entry);
    await storage.putEntry(result.value.entry);
  }

  return entries;
}

/** Create a chain with parent-child relationships for subtree testing. */
export async function createTestTree(
  chainId: string,
  storage: StorageAdapter
): Promise<ReadonlyArray<ProofChainEntry>> {
  let chain: ChainState = createChain(chainId);
  const entries: Array<ProofChainEntry> = [];

  const specs: ReadonlyArray<{
    entryId: string;
    parentEntryId?: string;
    entryType: "ai_decision" | "human_override" | "system_event";
  }> = [
    { entryId: "root-1", entryType: "ai_decision" },
    { entryId: "child-1a", parentEntryId: "root-1", entryType: "human_override" },
    { entryId: "child-1b", parentEntryId: "root-1", entryType: "system_event" },
    { entryId: "grandchild-1a1", parentEntryId: "child-1a", entryType: "ai_decision" },
    { entryId: "root-2", entryType: "ai_decision" },
  ];

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    if (!spec) {
      continue;
    }
    const result = appendEntry(chain, {
      entryId: spec.entryId,
      timestamp: `2026-01-01T00:00:${String(i).padStart(2, "0")}Z`,
      entryType: spec.entryType,
      parentEntryId: spec.parentEntryId,
      modelId: "gpt-4",
      modelProvider: "openai",
    });

    if (!result.ok) {
      throw new Error(`Failed to create test entry: ${JSON.stringify(result.error)}`);
    }

    chain = result.value.chain;
    entries.push(result.value.entry);
    await storage.putEntry(result.value.entry);
  }

  return entries;
}

/** Create an in-memory storage adapter. */
export function createMemoryStorage(): StorageAdapter {
  return createInMemoryAdapter();
}

/** Create a SQLite storage adapter with an in-memory database. */
export function createSqliteMemoryStorage(): StorageAdapter {
  return createSqliteAdapter({ path: ":memory:" });
}
