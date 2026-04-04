import type { DecisionType, EntryType } from "./entry-types.js";

/**
 * Tier 1: Core fields required for every Proof Chain entry.
 * These fields are the minimum needed to maintain chain integrity.
 * 8 fields.
 */
export type Tier1Fields = {
  /** Unique identifier for this entry (UUIDv7 for time-ordered IDs). */
  readonly entryId: string;
  /** Identifier of the chain this entry belongs to. */
  readonly chainId: string;
  /** Zero-based position of this entry in the linear chain. */
  readonly sequenceNumber: number;
  /** ISO 8601 timestamp of when this entry was created. */
  readonly timestamp: string;
  /** Discriminated type of this entry. */
  readonly entryType: EntryType;
  /** SHA-256 hash of this entry's canonical content (hex-encoded). */
  readonly entryHash: string;
  /** SHA-256 hash of the previous entry. Null for the genesis entry. */
  readonly previousHash: string | null;
  /** Entry ID of the logical parent (for tree-structured chains). Null for root entries. */
  readonly parentEntryId: string | null;
};

/**
 * Tier 2: AI decision context fields.
 * These capture the specifics of an AI model invocation.
 * 10 fields.
 */
export type Tier2Fields = {
  /** Identifier of the AI model used (e.g., "gpt-4o", "claude-sonnet-4-20250514"). */
  readonly modelId: string | null;
  /** Provider of the AI model (e.g., "openai", "anthropic", "azure"). */
  readonly modelProvider: string | null;
  /** SHA-256 hash of the input payload sent to the model (hex-encoded). */
  readonly inputHash: string | null;
  /** SHA-256 hash of the output received from the model (hex-encoded). */
  readonly outputHash: string | null;
  /** Number of input tokens consumed. */
  readonly inputTokenCount: number | null;
  /** Number of output tokens generated. */
  readonly outputTokenCount: number | null;
  /** Subtype of the AI decision. */
  readonly decisionType: DecisionType | null;
  /** Model-reported confidence score, normalized to [0, 1]. */
  readonly confidenceScore: number | null;
  /** Reference to an associated reasoning certificate entry. */
  readonly reasoningCertificateId: string | null;
  /** Reference to an associated AIBOM / model provenance record. */
  readonly provenanceId: string | null;
};

/**
 * Tier 3: Extended compliance and metadata fields.
 * These support regulatory reporting and human annotation.
 * 6 fields.
 */
export type Tier3Fields = {
  /** Groups related entries into a logical session. */
  readonly sessionId: string | null;
  /** Identifier of the actor (user, service, or system) that triggered this entry. */
  readonly actorId: string | null;
  /** IDs of compliance policies evaluated for this entry. */
  readonly policyIds: ReadonlyArray<string>;
  /** Arbitrary key-value metadata tags. */
  readonly tags: Readonly<Record<string, string>>;
  /** Human-readable annotation or note. */
  readonly annotation: string | null;
  /** Regulatory-specific metadata (e.g., Colorado AI Act, EU AI Act fields). */
  readonly complianceMetadata: Readonly<Record<string, unknown>>;
};

/**
 * A complete Proof Chain entry with all 24 fields across 3 tiers.
 * Tier 1 (8 fields): Core chain integrity.
 * Tier 2 (10 fields): AI decision context.
 * Tier 3 (6 fields): Extended compliance and metadata.
 */
export type ProofChainEntry = Tier1Fields & Tier2Fields & Tier3Fields;

/** Input for creating a new entry. Omits computed fields (entryHash, previousHash, sequenceNumber). */
export type CreateEntryInput = Omit<
  ProofChainEntry,
  "entryHash" | "previousHash" | "sequenceNumber"
>;

/** The subset of fields included in the hash computation (everything except the hash itself). */
export type HashableEntryFields = Omit<ProofChainEntry, "entryHash">;

/** Default values for Tier 2 nullable fields. */
export const TIER_2_DEFAULTS: Tier2Fields = {
  modelId: null,
  modelProvider: null,
  inputHash: null,
  outputHash: null,
  inputTokenCount: null,
  outputTokenCount: null,
  decisionType: null,
  confidenceScore: null,
  reasoningCertificateId: null,
  provenanceId: null,
} as const;

/** Default values for Tier 3 fields. */
export const TIER_3_DEFAULTS: Tier3Fields = {
  sessionId: null,
  actorId: null,
  policyIds: [],
  tags: {},
  annotation: null,
  complianceMetadata: {},
} as const;
