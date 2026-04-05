/** Entry types matching @gridseal/core schema. */
export const ENTRY_TYPES = [
  "ai_decision",
  "human_override",
  "system_event",
  "policy_check",
  "data_access",
  "model_deployment",
  "feedback",
  "correction",
] as const;

export type EntryType = (typeof ENTRY_TYPES)[number];

export const DECISION_TYPES = [
  "classification",
  "generation",
  "recommendation",
  "extraction",
  "summarization",
  "translation",
  "embedding",
  "tool_call",
  "routing",
  "other",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

/** Proof Chain entry with all 24 fields across 3 tiers. */
export type ProofChainEntry = {
  readonly entryId: string;
  readonly chainId: string;
  readonly sequenceNumber: number;
  readonly timestamp: string;
  readonly entryType: EntryType;
  readonly entryHash: string;
  readonly previousHash: string | null;
  readonly parentEntryId: string | null;
  readonly modelId: string | null;
  readonly modelProvider: string | null;
  readonly inputHash: string | null;
  readonly outputHash: string | null;
  readonly inputTokenCount: number | null;
  readonly outputTokenCount: number | null;
  readonly decisionType: DecisionType | null;
  readonly confidenceScore: number | null;
  readonly reasoningCertificateId: string | null;
  readonly provenanceId: string | null;
  readonly sessionId: string | null;
  readonly actorId: string | null;
  readonly policyIds: ReadonlyArray<string>;
  readonly tags: Readonly<Record<string, string>>;
  readonly annotation: string | null;
  readonly complianceMetadata: Readonly<Record<string, unknown>>;
};

/** Chain summary returned by GET /chains. */
export type ChainSummary = {
  readonly chainId: string;
  readonly entryCount: number;
};

/** Paginated entries response from GET /chains/:chainId/entries. */
export type PaginatedEntries = {
  readonly chainId: string;
  readonly entries: ReadonlyArray<ProofChainEntry>;
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
};

/** Chain validation result from POST /chains/:chainId/validate. */
export type ValidationResult = {
  readonly valid: boolean;
  readonly chainId: string;
  readonly entryCount: number;
  readonly error?: unknown;
};

/** Reasoning certificate. */
export type ReasoningCertificate = {
  readonly certificateId: string;
  readonly timestamp: string;
  readonly modelId: string;
  readonly modelProvider: string;
  readonly claims: ReadonlyArray<{
    readonly claimId: string;
    readonly statement: string;
    readonly supportingEvidenceIds: ReadonlyArray<string>;
  }>;
  readonly supportingEvidence: ReadonlyArray<{
    readonly evidenceId: string;
    readonly evidenceType: string;
    readonly description: string;
    readonly source: string | null;
  }>;
  readonly unsupportedClaims: ReadonlyArray<{
    readonly statement: string;
    readonly reason: string;
  }>;
  readonly assumptions: ReadonlyArray<{
    readonly statement: string;
    readonly criticality: "low" | "medium" | "high";
  }>;
  readonly limitations: ReadonlyArray<{
    readonly description: string;
    readonly impact: string;
  }>;
  readonly confidenceAssessment: {
    readonly level: string;
    readonly score: number;
    readonly rationale: string;
  };
  readonly certificateHash: string;
};

/** Model provenance record. */
export type ModelProvenance = {
  readonly provenanceId: string;
  readonly timestamp: string;
  readonly bomVersion: string;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly modelType: string;
  readonly modelProvider: string;
  readonly modelDescription: string | null;
  readonly modelAuthor: string | null;
  readonly modelLicense: string | null;
  readonly trainingDatasets: ReadonlyArray<{
    readonly datasetId: string;
    readonly name: string;
    readonly version: string | null;
    readonly source: string | null;
    readonly description: string | null;
  }>;
  readonly performanceMetrics: ReadonlyArray<{
    readonly metricId: string;
    readonly name: string;
    readonly value: number;
    readonly slice: string | null;
    readonly confidenceInterval: {
      readonly lower: number;
      readonly upper: number;
    } | null;
  }>;
  readonly ethicalConsiderations: ReadonlyArray<{
    readonly category: string;
    readonly description: string;
    readonly mitigationStrategy: string | null;
  }>;
  readonly externalReferences: ReadonlyArray<{
    readonly referenceType: string;
    readonly url: string;
    readonly description: string | null;
  }>;
  readonly provenanceHash: string;
};
