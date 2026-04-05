/** Entry types matching the core schema. */
export type EntryType =
  | "ai_decision"
  | "human_override"
  | "system_event"
  | "policy_check"
  | "data_access"
  | "model_deployment"
  | "feedback"
  | "correction";

export type DecisionType =
  | "classification"
  | "generation"
  | "recommendation"
  | "extraction"
  | "summarization"
  | "translation"
  | "embedding"
  | "tool_call"
  | "routing"
  | "other";

/** Proof Chain Entry with all 24 fields. */
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
  readonly policyIds: readonly string[];
  readonly tags: Readonly<Record<string, string>>;
  readonly annotation: string | null;
  readonly complianceMetadata: Readonly<Record<string, unknown>>;
};

export type ChainSummary = {
  readonly chainId: string;
  readonly entryCount: number;
};

export type EntryListResponse = {
  readonly chainId: string;
  readonly entries: readonly ProofChainEntry[];
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
};

export type ValidationResult = {
  readonly valid: boolean;
  readonly chainId: string;
  readonly entryCount: number;
  readonly error?: {
    readonly type: string;
    readonly message: string;
  };
};

export type EntryFilters = {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly modelId?: string;
  readonly actorId?: string;
  readonly sessionId?: string;
};

export type ReasoningCertificate = {
  readonly certificateId: string;
  readonly timestamp: string;
  readonly modelId: string;
  readonly modelProvider: string;
  readonly claims: readonly {
    readonly claimId: string;
    readonly statement: string;
    readonly supportingEvidenceIds: readonly string[];
  }[];
  readonly supportingEvidence: readonly {
    readonly evidenceId: string;
    readonly evidenceType: string;
    readonly description: string;
    readonly source: string | null;
  }[];
  readonly unsupportedClaims: readonly {
    readonly statement: string;
    readonly reason: string;
  }[];
  readonly assumptions: readonly {
    readonly statement: string;
    readonly criticality: "low" | "medium" | "high";
  }[];
  readonly limitations: readonly {
    readonly description: string;
    readonly impact: string;
  }[];
  readonly confidenceAssessment: {
    readonly level: string;
    readonly score: number;
    readonly rationale: string;
  };
  readonly certificateHash: string;
};
