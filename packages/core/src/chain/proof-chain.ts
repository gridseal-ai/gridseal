import type {
  ProofChainEntry,
  HashableEntryFields,
  Tier2Fields,
  Tier3Fields,
} from "../schema/proof-chain-entry.js";
import {
  TIER_2_DEFAULTS,
  TIER_3_DEFAULTS,
} from "../schema/proof-chain-entry.js";
import type { EntryType } from "../schema/entry-types.js";
import type { Result } from "../schema/result.js";
import { ok, err } from "../schema/result.js";
import { computeEntryHash } from "./hash.js";

/** Immutable state of a proof chain. */
export type ChainState = {
  readonly chainId: string;
  readonly entries: ReadonlyArray<ProofChainEntry>;
};

/** Error types for chain operations. */
export type ChainError =
  | { readonly type: "DUPLICATE_ENTRY_ID"; readonly entryId: string }
  | { readonly type: "PARENT_NOT_FOUND"; readonly parentEntryId: string }
  | {
      readonly type: "PARENT_CHAIN_MISMATCH";
      readonly parentEntryId: string;
      readonly expectedChainId: string;
    };

/** Input fields the caller provides when appending an entry. */
export type AppendEntryInput = {
  readonly entryId: string;
  readonly timestamp: string;
  readonly entryType: EntryType;
  readonly parentEntryId?: string | null;
} & Partial<Tier2Fields> &
  Partial<Tier3Fields>;

/** Create an empty chain with the given ID. */
export function createChain(chainId: string): ChainState {
  return { chainId, entries: [] };
}

function validateAppendInput(
  chain: ChainState,
  input: AppendEntryInput
): Result<null, ChainError> {
  const { entries, chainId } = chain;

  if (entries.find((e) => e.entryId === input.entryId)) {
    return err({ type: "DUPLICATE_ENTRY_ID", entryId: input.entryId });
  }

  const parentEntryId = input.parentEntryId ?? null;
  if (parentEntryId !== null) {
    const parent = entries.find((e) => e.entryId === parentEntryId);
    if (!parent) {
      return err({ type: "PARENT_NOT_FOUND", parentEntryId });
    }
    if (parent.chainId !== chainId) {
      return err({
        type: "PARENT_CHAIN_MISMATCH",
        parentEntryId,
        expectedChainId: chainId,
      });
    }
  }

  return ok(null);
}

function buildHashableFields(
  chain: ChainState,
  input: AppendEntryInput
): HashableEntryFields {
  const { entries, chainId } = chain;
  const lastEntry = entries.length > 0 ? entries[entries.length - 1] : undefined;

  return {
    entryId: input.entryId,
    chainId,
    sequenceNumber: entries.length,
    timestamp: input.timestamp,
    entryType: input.entryType,
    previousHash: lastEntry !== undefined ? lastEntry.entryHash : null,
    parentEntryId: input.parentEntryId ?? null,
    modelId: input.modelId ?? TIER_2_DEFAULTS.modelId,
    modelProvider: input.modelProvider ?? TIER_2_DEFAULTS.modelProvider,
    inputHash: input.inputHash ?? TIER_2_DEFAULTS.inputHash,
    outputHash: input.outputHash ?? TIER_2_DEFAULTS.outputHash,
    inputTokenCount: input.inputTokenCount ?? TIER_2_DEFAULTS.inputTokenCount,
    outputTokenCount: input.outputTokenCount ?? TIER_2_DEFAULTS.outputTokenCount,
    decisionType: input.decisionType ?? TIER_2_DEFAULTS.decisionType,
    confidenceScore: input.confidenceScore ?? TIER_2_DEFAULTS.confidenceScore,
    reasoningCertificateId:
      input.reasoningCertificateId ?? TIER_2_DEFAULTS.reasoningCertificateId,
    provenanceId: input.provenanceId ?? TIER_2_DEFAULTS.provenanceId,
    sessionId: input.sessionId ?? TIER_3_DEFAULTS.sessionId,
    actorId: input.actorId ?? TIER_3_DEFAULTS.actorId,
    policyIds: input.policyIds ?? TIER_3_DEFAULTS.policyIds,
    tags: input.tags ?? TIER_3_DEFAULTS.tags,
    annotation: input.annotation ?? TIER_3_DEFAULTS.annotation,
    complianceMetadata:
      input.complianceMetadata ?? TIER_3_DEFAULTS.complianceMetadata,
  };
}

/** Append an entry to the chain and return the updated state with the new entry. */
export function appendEntry(
  chain: ChainState,
  input: AppendEntryInput
): Result<{ chain: ChainState; entry: ProofChainEntry }, ChainError> {
  const validation = validateAppendInput(chain, input);
  if (!validation.ok) {
    return validation;
  }

  const hashableFields = buildHashableFields(chain, input);
  const entry: ProofChainEntry = {
    ...hashableFields,
    entryHash: computeEntryHash(hashableFields),
  };

  const newEntries = chain.entries.slice() as Array<ProofChainEntry>;
  newEntries.push(entry);

  return ok({
    chain: { chainId: chain.chainId, entries: newEntries },
    entry,
  });
}

/** Get all entries that are direct children of the given parent entry. */
export function getChildren(
  chain: ChainState,
  parentEntryId: string
): ReadonlyArray<ProofChainEntry> {
  return chain.entries.filter((e) => e.parentEntryId === parentEntryId);
}

/** Get all root entries (entries with no parent). */
export function getRootEntries(
  chain: ChainState
): ReadonlyArray<ProofChainEntry> {
  return chain.entries.filter((e) => e.parentEntryId === null);
}

/** Get the subtree rooted at the given entry (inclusive). */
export function getSubtree(
  chain: ChainState,
  rootEntryId: string
): ReadonlyArray<ProofChainEntry> {
  const result: Array<ProofChainEntry> = [];
  const rootEntry = chain.entries.find((e) => e.entryId === rootEntryId);
  if (!rootEntry) {
    return result;
  }

  const queue: Array<string> = [rootEntryId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const current = chain.entries.find((e) => e.entryId === currentId);
    if (current) {
      result.push(current);
      const children = chain.entries.filter(
        (e) => e.parentEntryId === currentId
      );
      for (const child of children) {
        queue.push(child.entryId);
      }
    }
  }

  return result;
}

/** Get the last entry in the chain, or undefined if empty. */
export function getLastEntry(
  chain: ChainState
): ProofChainEntry | undefined {
  return chain.entries.length > 0
    ? chain.entries[chain.entries.length - 1]
    : undefined;
}
