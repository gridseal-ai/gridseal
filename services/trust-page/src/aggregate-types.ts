import type {
  DecisionType,
  EntryType,
} from "@gridseal/core";

/** Summary of chain verification results. */
export type VerificationSummary = {
  readonly valid: boolean;
  readonly entryCount: number;
  readonly errorType: string | null;
  readonly errorEntryId: string | null;
  readonly errorDetail: string | null;
};

/** Count of entries grouped by their type. */
export type EntryTypeCounts = Readonly<Partial<Record<EntryType, number>>>;

/** Count of AI decisions grouped by their decision type. */
export type DecisionTypeCounts = Readonly<Partial<Record<DecisionType, number>>>;

/** Summary of a model's usage across the chain. */
export type ModelUsageSummary = {
  readonly modelId: string;
  readonly modelProvider: string;
  readonly entryCount: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
};

/** Timeline boundaries for the chain. */
export type TimelineSummary = {
  readonly firstEntryTimestamp: string | null;
  readonly lastEntryTimestamp: string | null;
  readonly durationMs: number | null;
};

/** Human review statistics. */
export type HumanReviewSummary = {
  readonly totalReviewed: number;
  readonly approved: number;
  readonly rejected: number;
  readonly pending: number;
  readonly reviewRate: number;
};

/** Compliance report availability for a regulation. */
export type ComplianceAvailability = {
  readonly regulationId: string;
  readonly available: boolean;
};

/** Abbreviated certificate data for rendering. */
export type CertificateSummary = {
  readonly certificateId: string;
  readonly modelId: string;
  readonly timestamp: string;
  readonly claimCount: number;
  readonly unsupportedClaimCount: number;
  readonly confidenceLevel: string;
  readonly confidenceScore: number;
};

/** Abbreviated provenance data for rendering. */
export type ProvenanceSummary = {
  readonly provenanceId: string;
  readonly modelName: string;
  readonly modelVersion: string;
  readonly modelProvider: string;
  readonly datasetCount: number;
  readonly metricCount: number;
  readonly ethicalConsiderationCount: number;
};

/** Aggregated statistics for a single chain, ready for rendering. */
export type TrustPageData = {
  readonly chainId: string;
  readonly generatedAt: string;
  readonly verification: VerificationSummary;
  readonly entryTypeCounts: EntryTypeCounts;
  readonly decisionTypeCounts: DecisionTypeCounts;
  readonly modelUsage: ReadonlyArray<ModelUsageSummary>;
  readonly timeline: TimelineSummary;
  readonly uniqueActors: ReadonlyArray<string>;
  readonly uniqueSessions: ReadonlyArray<string>;
  readonly policyIds: ReadonlyArray<string>;
  readonly certificateCount: number;
  readonly provenanceCount: number;
  readonly certificates: ReadonlyArray<CertificateSummary>;
  readonly provenanceRecords: ReadonlyArray<ProvenanceSummary>;
  readonly humanReview: HumanReviewSummary;
  readonly complianceAvailability: ReadonlyArray<ComplianceAvailability>;
  readonly lastVerificationTimestamp: string;
};
