/**
 * Type definitions for compliance reports.
 */

import type { ValidationError } from "../chain/validation.js";
import type { ChainState } from "../chain/proof-chain.js";
import type { RegulationMatch } from "../compliance/types.js";
import type { EntryMetadata } from "../compliance/auto-tagger.js";
import type { ReasoningCertificate } from "../certificate/reasoning-certificate.js";

/** Chain integrity verification result included in every report. */
export type ChainIntegrityResult = {
  readonly valid: boolean;
  readonly totalEntries: number;
  readonly error: ValidationError | null;
};

/** Per-regulation summary statistics. */
export type RegulationSummary = {
  readonly regulationId: string;
  readonly regulationName: string;
  readonly totalRequirements: number;
  readonly applicableRequirements: number;
  readonly satisfiedRequirements: number;
  readonly complianceRate: number;
};

/** Maps a single entry to its regulation matches. */
export type EntryRegulationMapping = {
  readonly entryId: string;
  readonly sequenceNumber: number;
  readonly entryType: string;
  readonly decisionType: string | null;
  readonly matches: ReadonlyArray<RegulationMatch>;
  readonly satisfiedCount: number;
  readonly totalCount: number;
};

/** A specific compliance gap found during analysis. */
export type ComplianceGap = {
  readonly entryId: string;
  readonly sequenceNumber: number;
  readonly requirementId: string;
  readonly regulationId: string;
  readonly requirementTitle: string;
  readonly missingFields: ReadonlyArray<string>;
  readonly gaps: ReadonlyArray<string>;
};

/** Summary of a reasoning certificate attached to an entry. */
export type CertificateSummary = {
  readonly certificateId: string;
  readonly entryId: string;
  readonly modelId: string;
  readonly modelProvider: string;
  readonly claimCount: number;
  readonly unsupportedClaimCount: number;
  readonly confidenceLevel: string;
  readonly confidenceScore: number;
};

/** Aggregate statistics for the report. */
export type ReportStatistics = {
  readonly totalEntries: number;
  readonly entriesWithCertificates: number;
  readonly entriesWithProvenance: number;
  readonly totalGaps: number;
  readonly overallComplianceRate: number;
};

/** The complete compliance report structure. */
export type ComplianceReport = {
  readonly reportId: string;
  readonly generatedAt: string;
  readonly chainId: string;
  readonly chainIntegrity: ChainIntegrityResult;
  readonly regulationSummaries: ReadonlyArray<RegulationSummary>;
  readonly entriesByRegulation: Readonly<Record<string, ReadonlyArray<EntryRegulationMapping>>>;
  readonly gaps: ReadonlyArray<ComplianceGap>;
  readonly certificateSummaries: ReadonlyArray<CertificateSummary>;
  readonly statistics: ReportStatistics;
};

/** Input for generating a compliance report. */
export type GenerateReportInput = {
  /** Unique identifier for this report (UUIDv7 recommended). */
  readonly reportId: string;
  /** The chain segment to analyze. */
  readonly chain: ChainState;
  /** Default metadata applied to all entries unless overridden. */
  readonly defaultMetadata: EntryMetadata;
  /** Per-entry metadata overrides keyed by entryId. */
  readonly entryMetadataOverrides?: Readonly<Record<string, EntryMetadata>> | undefined;
  /** Regulation IDs to include. Omit or empty to include all. */
  readonly regulationIds?: ReadonlyArray<string> | undefined;
  /** Certificates keyed by certificateId for summary generation. */
  readonly certificates?: ReadonlyMap<string, ReasoningCertificate> | undefined;
};
