import type { ProofChainEntry, HashableEntryFields } from "../schema/proof-chain-entry.js";
import type { Result } from "../schema/result.js";
import { ok, err } from "../schema/result.js";
import { computeEntryHash } from "./hash.js";
import type { ChainState } from "./proof-chain.js";

/** Error types for validation failures. */
export type ValidationError =
  | {
      readonly type: "HASH_MISMATCH";
      readonly entryId: string;
      readonly sequenceNumber: number;
      readonly expectedHash: string;
      readonly actualHash: string;
    }
  | {
      readonly type: "PREVIOUS_HASH_MISMATCH";
      readonly entryId: string;
      readonly sequenceNumber: number;
      readonly expectedPreviousHash: string | null;
      readonly actualPreviousHash: string | null;
    }
  | {
      readonly type: "SEQUENCE_NUMBER_MISMATCH";
      readonly entryId: string;
      readonly expectedSequenceNumber: number;
      readonly actualSequenceNumber: number;
    }
  | {
      readonly type: "CHAIN_ID_MISMATCH";
      readonly entryId: string;
      readonly expectedChainId: string;
      readonly actualChainId: string;
    }
  | {
      readonly type: "ENTRY_NOT_FOUND";
      readonly entryId: string;
    }
  | {
      readonly type: "EMPTY_CHAIN";
    };

/** Extract hashable fields from a complete entry (everything except entryHash). */
function extractHashableFields(entry: ProofChainEntry): HashableEntryFields {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { entryHash: _, ...hashableFields } = entry;
  return hashableFields;
}

/**
 * Validate a single entry's hash against its content.
 * Optionally checks previousHash linkage if expectedPreviousHash is provided.
 */
export function validateEntry(
  entry: ProofChainEntry,
  expectedPreviousHash?: string | null
): Result<null, ValidationError> {
  const hashableFields = extractHashableFields(entry);
  const recomputedHash = computeEntryHash(hashableFields);

  if (recomputedHash !== entry.entryHash) {
    return err({
      type: "HASH_MISMATCH",
      entryId: entry.entryId,
      sequenceNumber: entry.sequenceNumber,
      expectedHash: entry.entryHash,
      actualHash: recomputedHash,
    });
  }

  if (expectedPreviousHash !== undefined && entry.previousHash !== expectedPreviousHash) {
    return err({
      type: "PREVIOUS_HASH_MISMATCH",
      entryId: entry.entryId,
      sequenceNumber: entry.sequenceNumber,
      expectedPreviousHash,
      actualPreviousHash: entry.previousHash,
    });
  }

  return ok(null);
}

/**
 * Validate the entire chain: sequence numbers, chain IDs, hash integrity, and previousHash linkage.
 * Returns the first error found, scanning from entry 0 forward.
 */
export function validateChain(
  chain: ChainState
): Result<null, ValidationError> {
  const { entries, chainId } = chain;

  if (entries.length === 0) {
    return ok(null);
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i] as ProofChainEntry;

    if (entry.chainId !== chainId) {
      return err({
        type: "CHAIN_ID_MISMATCH",
        entryId: entry.entryId,
        expectedChainId: chainId,
        actualChainId: entry.chainId,
      });
    }

    if (entry.sequenceNumber !== i) {
      return err({
        type: "SEQUENCE_NUMBER_MISMATCH",
        entryId: entry.entryId,
        expectedSequenceNumber: i,
        actualSequenceNumber: entry.sequenceNumber,
      });
    }

    const previousEntry = i === 0 ? undefined : entries[i - 1];
    const expectedPreviousHash = previousEntry ? previousEntry.entryHash : null;
    const result = validateEntry(entry, expectedPreviousHash);
    if (!result.ok) {
      return result;
    }
  }

  return ok(null);
}

/** Collect all entry IDs in the subtree rooted at rootEntryId via BFS. */
function collectSubtreeIds(entries: ReadonlyArray<ProofChainEntry>, rootEntryId: string): Set<string> {
  const subtreeIds = new Set<string>();
  const queue: Array<string> = [rootEntryId];

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    if (subtreeIds.has(currentId)) {
      continue;
    }
    subtreeIds.add(currentId);

    for (const entry of entries) {
      if (entry.parentEntryId === currentId) {
        queue.push(entry.entryId);
      }
    }
  }

  return subtreeIds;
}

/**
 * Validate the subtree rooted at the given entry ID.
 * Checks hash integrity and previousHash linkage for all entries in the subtree,
 * walking the entries in chain order (by sequenceNumber).
 */
export function validateSubtree(
  chain: ChainState,
  rootEntryId: string
): Result<null, ValidationError> {
  const rootEntry = chain.entries.find((e) => e.entryId === rootEntryId);
  if (!rootEntry) {
    return err({ type: "ENTRY_NOT_FOUND", entryId: rootEntryId });
  }

  const subtreeIds = collectSubtreeIds(chain.entries, rootEntryId);
  const subtreeEntries = chain.entries.filter((e) => subtreeIds.has(e.entryId));

  for (const entry of subtreeEntries) {
    const hashResult = validateEntry(entry);
    if (!hashResult.ok) {
      return hashResult;
    }

    const previousInChain = entry.sequenceNumber === 0
      ? undefined
      : chain.entries[entry.sequenceNumber - 1];
    const expectedPreviousHash = previousInChain ? previousInChain.entryHash : null;

    if (entry.previousHash !== expectedPreviousHash) {
      return err({
        type: "PREVIOUS_HASH_MISMATCH",
        entryId: entry.entryId,
        sequenceNumber: entry.sequenceNumber,
        expectedPreviousHash,
        actualPreviousHash: entry.previousHash,
      });
    }
  }

  return ok(null);
}
