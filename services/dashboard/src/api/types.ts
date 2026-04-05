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

export type ConfidenceLevel =
  | "very_low"
  | "low"
  | "medium"
  | "high"
  | "very_high";

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

export type ChainSummary = {
  readonly chainId: string;
  readonly entryCount: number;
};

export type ChainsListResponse = {
  readonly chains: ReadonlyArray<ChainSummary>;
};

export type ChainEntriesResponse = {
  readonly chainId: string;
  readonly entries: ReadonlyArray<ProofChainEntry>;
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
};

export type ValidationResult = {
  readonly valid: boolean;
  readonly chainId: string;
  readonly entryCount: number;
  readonly error?: ValidationError | undefined;
};

export type ValidationError = {
  readonly type: string;
  readonly entryId?: string | undefined;
  readonly sequenceNumber?: number | undefined;
  readonly expectedHash?: string | undefined;
  readonly actualHash?: string | undefined;
  readonly expectedPreviousHash?: string | undefined;
  readonly actualPreviousHash?: string | undefined;
};

export type EntryValidationResult = {
  readonly valid: boolean;
  readonly entryId: string;
  readonly error?: ValidationError | undefined;
};

export type Claim = {
  readonly claimId: string;
  readonly statement: string;
  readonly supportingEvidenceIds: ReadonlyArray<string>;
};

export type Evidence = {
  readonly evidenceId: string;
  readonly evidenceType: string;
  readonly description: string;
  readonly source: string | null;
};

export type UnsupportedClaim = {
  readonly statement: string;
  readonly reason: string;
};

export type Assumption = {
  readonly statement: string;
  readonly criticality: "low" | "medium" | "high";
};

export type Limitation = {
  readonly description: string;
  readonly impact: string;
};

export type ConfidenceAssessment = {
  readonly level: ConfidenceLevel;
  readonly score: number;
  readonly rationale: string;
};

export type ReasoningCertificate = {
  readonly certificateId: string;
  readonly timestamp: string;
  readonly modelId: string;
  readonly modelProvider: string;
  readonly certificateHash: string;
  readonly claims: ReadonlyArray<Claim>;
  readonly supportingEvidence: ReadonlyArray<Evidence>;
  readonly unsupportedClaims: ReadonlyArray<UnsupportedClaim>;
  readonly assumptions: ReadonlyArray<Assumption>;
  readonly limitations: ReadonlyArray<Limitation>;
  readonly confidenceAssessment: ConfidenceAssessment;
};

export type CertificateVerifyResult = {
  readonly valid: boolean;
  readonly certificateId: string;
};

export type TrainingDataset = {
  readonly datasetId: string;
  readonly name: string;
  readonly version: string | null;
  readonly source: string | null;
  readonly description: string | null;
};

export type PerformanceMetric = {
  readonly metricId: string;
  readonly name: string;
  readonly value: number;
  readonly slice: string | null;
  readonly confidenceInterval: { readonly lower: number; readonly upper: number } | null;
};

export type EthicalConsideration = {
  readonly category: string;
  readonly description: string;
  readonly mitigationStrategy: string | null;
};

export type ExternalReference = {
  readonly referenceType: string;
  readonly url: string;
  readonly description: string | null;
};

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
  readonly provenanceHash: string;
  readonly trainingDatasets: ReadonlyArray<TrainingDataset>;
  readonly performanceMetrics: ReadonlyArray<PerformanceMetric>;
  readonly ethicalConsiderations: ReadonlyArray<EthicalConsideration>;
  readonly externalReferences: ReadonlyArray<ExternalReference>;
};

export type ProvenanceVerifyResult = {
  readonly valid: boolean;
  readonly provenanceId: string;
};
