import type { ProofChainEntry } from "../schema/proof-chain-entry.js";
import type { ReasoningCertificate } from "../certificate/reasoning-certificate.js";
import type { ModelProvenance } from "../provenance/model-provenance.js";
import type { Result } from "../schema/result.js";

/** Error types for storage operations. */
export type StorageError =
  | { readonly type: "ENTRY_NOT_FOUND"; readonly entryId: string }
  | { readonly type: "CHAIN_NOT_FOUND"; readonly chainId: string }
  | { readonly type: "CERTIFICATE_NOT_FOUND"; readonly certificateId: string }
  | { readonly type: "PROVENANCE_NOT_FOUND"; readonly provenanceId: string }
  | { readonly type: "DUPLICATE_ENTRY"; readonly entryId: string }
  | { readonly type: "DUPLICATE_CERTIFICATE"; readonly certificateId: string }
  | { readonly type: "DUPLICATE_PROVENANCE"; readonly provenanceId: string };

/**
 * Interface for persistent storage of proof chain entries,
 * reasoning certificates, and model provenance records.
 */
export type StorageAdapter = {
  /** Store a proof chain entry. Fails if an entry with the same entryId exists. */
  readonly putEntry: (
    entry: ProofChainEntry
  ) => Promise<Result<ProofChainEntry, StorageError>>;

  /** Retrieve a single entry by its ID. */
  readonly getEntry: (
    entryId: string
  ) => Promise<Result<ProofChainEntry, StorageError>>;

  /** Retrieve all entries for a given chain, ordered by sequenceNumber. */
  readonly getEntriesByChainId: (
    chainId: string
  ) => Promise<ReadonlyArray<ProofChainEntry>>;

  /** Retrieve entries within a sequence number range (inclusive) for a chain. */
  readonly getEntriesBySequenceRange: (
    chainId: string,
    startSequence: number,
    endSequence: number
  ) => Promise<ReadonlyArray<ProofChainEntry>>;

  /** Retrieve entries that are children of a given parent entry. */
  readonly getEntriesByParentId: (
    parentEntryId: string
  ) => Promise<ReadonlyArray<ProofChainEntry>>;

  /** Store a reasoning certificate. Fails if a certificate with the same ID exists. */
  readonly putCertificate: (
    certificate: ReasoningCertificate
  ) => Promise<Result<ReasoningCertificate, StorageError>>;

  /** Retrieve a reasoning certificate by its ID. */
  readonly getCertificate: (
    certificateId: string
  ) => Promise<Result<ReasoningCertificate, StorageError>>;

  /** Store a model provenance record. Fails if a record with the same ID exists. */
  readonly putProvenance: (
    provenance: ModelProvenance
  ) => Promise<Result<ModelProvenance, StorageError>>;

  /** Retrieve a model provenance record by its ID. */
  readonly getProvenance: (
    provenanceId: string
  ) => Promise<Result<ModelProvenance, StorageError>>;

  /** Return the number of entries stored for a given chain. */
  readonly getChainLength: (chainId: string) => Promise<number>;

  /** Return the IDs of all chains that have at least one entry. */
  readonly listChainIds: () => Promise<ReadonlyArray<string>>;

  /** Remove all stored data. */
  readonly clear: () => Promise<void>;
};
