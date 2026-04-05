import type {
  DecisionType,
  EntryType,
  ProofChainEntry,
  ChainState,
  ReasoningCertificate,
  ModelProvenance,
} from "@gridseal/core";
import { validateChain } from "@gridseal/core";

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

/** Verify the chain and return a structured summary. */
export function verifyChain(chain: ChainState): VerificationSummary {
  const result = validateChain(chain);
  if (result.ok) {
    return {
      valid: true,
      entryCount: chain.entries.length,
      errorType: null,
      errorEntryId: null,
      errorDetail: null,
    };
  }
  const error = result.error;
  const entryId = "entryId" in error ? (error.entryId as string) : null;
  let detail: string;
  switch (error.type) {
    case "HASH_MISMATCH":
      detail = `Expected hash ${error.expectedHash.slice(0, 16)}... but computed ${error.actualHash.slice(0, 16)}... at sequence ${String(error.sequenceNumber)}`;
      break;
    case "PREVIOUS_HASH_MISMATCH":
      detail = `Previous hash linkage broken at sequence ${String(error.sequenceNumber)}`;
      break;
    case "SEQUENCE_NUMBER_MISMATCH":
      detail = `Expected sequence ${String(error.expectedSequenceNumber)} but found ${String(error.actualSequenceNumber)}`;
      break;
    case "CHAIN_ID_MISMATCH":
      detail = `Expected chain ${error.expectedChainId} but found ${error.actualChainId}`;
      break;
    case "ENTRY_NOT_FOUND":
      detail = `Entry ${error.entryId} not found in chain`;
      break;
    case "EMPTY_CHAIN":
      detail = "Chain contains no entries";
      break;
  }
  return {
    valid: false,
    entryCount: chain.entries.length,
    errorType: error.type,
    errorEntryId: entryId,
    errorDetail: detail,
  };
}

/** Count entries grouped by their entryType field. */
export function countEntryTypes(
  entries: ReadonlyArray<ProofChainEntry>,
): EntryTypeCounts {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    counts[entry.entryType] = (counts[entry.entryType] ?? 0) + 1;
  }
  return counts as EntryTypeCounts;
}

/** Count AI decision entries grouped by their decisionType field. */
export function countDecisionTypes(
  entries: ReadonlyArray<ProofChainEntry>,
): DecisionTypeCounts {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    if (entry.decisionType !== null) {
      counts[entry.decisionType] = (counts[entry.decisionType] ?? 0) + 1;
    }
  }
  return counts as DecisionTypeCounts;
}

/** Aggregate model usage statistics across all entries. */
export function aggregateModelUsage(
  entries: ReadonlyArray<ProofChainEntry>,
): ReadonlyArray<ModelUsageSummary> {
  const byModel = new Map<
    string,
    {
      modelId: string;
      modelProvider: string;
      entryCount: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    }
  >();
  for (const entry of entries) {
    if (entry.modelId === null || entry.modelProvider === null) {
      continue;
    }
    const key = `${entry.modelProvider}:${entry.modelId}`;
    const existing = byModel.get(key);
    if (existing) {
      existing.entryCount += 1;
      existing.totalInputTokens += entry.inputTokenCount ?? 0;
      existing.totalOutputTokens += entry.outputTokenCount ?? 0;
    } else {
      byModel.set(key, {
        modelId: entry.modelId,
        modelProvider: entry.modelProvider,
        entryCount: 1,
        totalInputTokens: entry.inputTokenCount ?? 0,
        totalOutputTokens: entry.outputTokenCount ?? 0,
      });
    }
  }
  return [...byModel.values()]
    .sort((a, b) => b.entryCount - a.entryCount)
    .map((m) => ({
      modelId: m.modelId,
      modelProvider: m.modelProvider,
      entryCount: m.entryCount,
      totalInputTokens: m.totalInputTokens,
      totalOutputTokens: m.totalOutputTokens,
    }));
}

/** Compute timeline boundaries from entries. */
export function computeTimeline(
  entries: ReadonlyArray<ProofChainEntry>,
): TimelineSummary {
  if (entries.length === 0) {
    return {
      firstEntryTimestamp: null,
      lastEntryTimestamp: null,
      durationMs: null,
    };
  }
  const first = entries[0];
  const last = entries[entries.length - 1];
  if (!first || !last) {
    return {
      firstEntryTimestamp: null,
      lastEntryTimestamp: null,
      durationMs: null,
    };
  }
  const firstTime = new Date(first.timestamp).getTime();
  const lastTime = new Date(last.timestamp).getTime();
  return {
    firstEntryTimestamp: first.timestamp,
    lastEntryTimestamp: last.timestamp,
    durationMs: lastTime - firstTime,
  };
}

/** Collect unique actor IDs from entries. */
export function collectActors(
  entries: ReadonlyArray<ProofChainEntry>,
): ReadonlyArray<string> {
  const actors = new Set<string>();
  for (const entry of entries) {
    if (entry.actorId !== null) {
      actors.add(entry.actorId);
    }
  }
  return [...actors].sort();
}

/** Collect unique session IDs from entries. */
export function collectSessions(
  entries: ReadonlyArray<ProofChainEntry>,
): ReadonlyArray<string> {
  const sessions = new Set<string>();
  for (const entry of entries) {
    if (entry.sessionId !== null) {
      sessions.add(entry.sessionId);
    }
  }
  return [...sessions].sort();
}

/** Collect unique policy IDs from entries. */
export function collectPolicyIds(
  entries: ReadonlyArray<ProofChainEntry>,
): ReadonlyArray<string> {
  const policies = new Set<string>();
  for (const entry of entries) {
    for (const policyId of entry.policyIds) {
      policies.add(policyId);
    }
  }
  return [...policies].sort();
}

/** Compute human review statistics from entry tags. */
export function computeHumanReview(
  entries: ReadonlyArray<ProofChainEntry>,
): HumanReviewSummary {
  let approved = 0;
  let rejected = 0;
  let pending = 0;
  for (const entry of entries) {
    const status = entry.tags["review_status"];
    if (status === "approved") {
      approved += 1;
    } else if (status === "rejected") {
      rejected += 1;
    } else if (status === "pending") {
      pending += 1;
    }
  }
  const totalReviewed = approved + rejected;
  const reviewRate =
    entries.length > 0 ? totalReviewed / entries.length : 0;
  return { totalReviewed, approved, rejected, pending, reviewRate };
}

/** Determine which regulations have enough data for compliance reports. */
export function computeComplianceAvailability(
  entries: ReadonlyArray<ProofChainEntry>,
  regulationIds: ReadonlyArray<string>,
): ReadonlyArray<ComplianceAvailability> {
  const hasPolicyData = new Set<string>();
  for (const entry of entries) {
    for (const policyId of entry.policyIds) {
      hasPolicyData.add(policyId);
    }
    for (const key of Object.keys(entry.complianceMetadata)) {
      hasPolicyData.add(key);
    }
  }
  return regulationIds.map((regulationId) => ({
    regulationId,
    available: hasPolicyData.has(regulationId) || entries.length > 0,
  }));
}

/** Summarize a reasoning certificate for display. */
export function summarizeCertificate(
  cert: ReasoningCertificate,
): CertificateSummary {
  return {
    certificateId: cert.certificateId,
    modelId: cert.modelId,
    timestamp: cert.timestamp,
    claimCount: cert.claims.length,
    unsupportedClaimCount: cert.unsupportedClaims.length,
    confidenceLevel: cert.confidenceAssessment.level,
    confidenceScore: cert.confidenceAssessment.score,
  };
}

/** Summarize a provenance record for display. */
export function summarizeProvenance(
  prov: ModelProvenance,
): ProvenanceSummary {
  return {
    provenanceId: prov.provenanceId,
    modelName: prov.modelName,
    modelVersion: prov.modelVersion,
    modelProvider: prov.modelProvider,
    datasetCount: prov.trainingDatasets.length,
    metricCount: prov.performanceMetrics.length,
    ethicalConsiderationCount: prov.ethicalConsiderations.length,
  };
}

/** Build the full TrustPageData from chain state and related records. */
export function aggregateTrustPageData(
  chain: ChainState,
  certificates: ReadonlyArray<ReasoningCertificate>,
  provenanceRecords: ReadonlyArray<ModelProvenance>,
  regulationIds: ReadonlyArray<string>,
): TrustPageData {
  const now = new Date().toISOString();
  return {
    chainId: chain.chainId,
    generatedAt: now,
    verification: verifyChain(chain),
    entryTypeCounts: countEntryTypes(chain.entries),
    decisionTypeCounts: countDecisionTypes(chain.entries),
    modelUsage: aggregateModelUsage(chain.entries),
    timeline: computeTimeline(chain.entries),
    uniqueActors: collectActors(chain.entries),
    uniqueSessions: collectSessions(chain.entries),
    policyIds: collectPolicyIds(chain.entries),
    certificateCount: certificates.length,
    provenanceCount: provenanceRecords.length,
    certificates: certificates.map(summarizeCertificate),
    provenanceRecords: provenanceRecords.map(summarizeProvenance),
    humanReview: computeHumanReview(chain.entries),
    complianceAvailability: computeComplianceAvailability(
      chain.entries,
      regulationIds,
    ),
    lastVerificationTimestamp: now,
  };
}
