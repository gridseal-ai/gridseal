import {
  validateChain,
  validateSubtree,
  validateEntry,
} from "@gridseal/core";
import type { StorageAdapter, ProofChainEntry, ChainState } from "@gridseal/core";
import { formatValidationError } from "../format.js";

export type VerifyOptions = {
  readonly storage: StorageAdapter;
  readonly chainId: string;
  readonly entryId?: string | undefined;
  readonly subtree?: boolean | undefined;
};

export type VerifyResult = {
  readonly success: boolean;
  readonly message: string;
};

/** Rebuild a ChainState from storage entries sorted by sequence number. */
function rebuildChainState(
  chainId: string,
  entries: ReadonlyArray<ProofChainEntry>
): ChainState {
  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  return { chainId, entries: sorted };
}

/** Verify chain integrity. Supports full chain, single entry, or subtree modes. */
export async function verify(options: VerifyOptions): Promise<VerifyResult> {
  const entries = await options.storage.getEntriesByChainId(options.chainId);

  if (entries.length === 0) {
    return { success: false, message: `No entries found for chain: ${options.chainId}` };
  }

  const chain = rebuildChainState(options.chainId, entries);

  if (options.entryId && options.subtree) {
    const result = validateSubtree(chain, options.entryId);
    if (result.ok) {
      const subtreeCount = countSubtreeEntries(chain, options.entryId);
      return {
        success: true,
        message: `Subtree rooted at ${options.entryId} is valid (${subtreeCount} entries in subtree, ${entries.length} in chain)`,
      };
    }
    return { success: false, message: formatValidationError(result.error) };
  }

  if (options.entryId) {
    const entry = entries.find((e) => e.entryId === options.entryId);
    if (!entry) {
      return { success: false, message: `Entry not found: ${options.entryId}` };
    }
    const prevEntry = entry.sequenceNumber > 0
      ? chain.entries.find((e) => e.sequenceNumber === entry.sequenceNumber - 1)
      : undefined;
    const expectedPrevHash = prevEntry ? prevEntry.entryHash : null;
    const result = validateEntry(entry, expectedPrevHash);
    if (result.ok) {
      return { success: true, message: `Entry ${options.entryId} is valid (seq ${entry.sequenceNumber})` };
    }
    return { success: false, message: formatValidationError(result.error) };
  }

  const result = validateChain(chain);
  if (result.ok) {
    return { success: true, message: `Chain ${options.chainId} is valid (${entries.length} entries)` };
  }
  return { success: false, message: formatValidationError(result.error) };
}

/** Count entries in a subtree via BFS. */
function countSubtreeEntries(chain: ChainState, rootEntryId: string): number {
  const visited = new Set<string>();
  const queue: Array<string> = [rootEntryId];

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    for (const entry of chain.entries) {
      if (entry.parentEntryId === currentId) {
        queue.push(entry.entryId);
      }
    }
  }

  return visited.size;
}
