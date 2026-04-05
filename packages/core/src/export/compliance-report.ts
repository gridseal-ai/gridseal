/**
 * Compliance report generator. Takes a chain segment and entry metadata,
 * runs auto-tagging against regulatory requirements, and produces a
 * structured report with chain integrity verification, regulation mappings,
 * gap analysis, and reasoning certificate summaries.
 */

import type { ChainState } from "../chain/proof-chain.js";
import { validateChain } from "../chain/validation.js";
import type { ReasoningCertificate } from "../certificate/reasoning-certificate.js";
import type { EntryMetadata } from "../compliance/auto-tagger.js";
import { tagEntryForRegulation } from "../compliance/auto-tagger.js";
import {
  getAllRegulations,
  getRegulationById,
} from "../compliance/regulations/registry.js";
import type {
  ChainIntegrityResult,
  RegulationSummary,
  EntryRegulationMapping,
  ComplianceGap,
  CertificateSummary,
  ComplianceReport,
  ReportStatistics,
  GenerateReportInput,
} from "./compliance-report-types.js";

export type {
  ChainIntegrityResult,
  RegulationSummary,
  EntryRegulationMapping,
  ComplianceGap,
  CertificateSummary,
  ReportStatistics,
  ComplianceReport,
  GenerateReportInput,
} from "./compliance-report-types.js";

function verifyChainIntegrity(chain: ChainState): ChainIntegrityResult {
  const result = validateChain(chain);
  return {
    valid: result.ok,
    totalEntries: chain.entries.length,
    error: result.ok ? null : result.error,
  };
}

function getMetadataForEntry(
  entryId: string,
  defaultMetadata: EntryMetadata,
  overrides?: Readonly<Record<string, EntryMetadata>>,
): EntryMetadata {
  if (overrides && entryId in overrides) {
    return overrides[entryId] as EntryMetadata;
  }
  return defaultMetadata;
}

function buildRegulationSummaries(
  entriesByRegulation: Record<string, ReadonlyArray<EntryRegulationMapping>>,
  regulationIds: ReadonlyArray<string>,
): ReadonlyArray<RegulationSummary> {
  const summaries: Array<RegulationSummary> = [];

  for (const regId of regulationIds) {
    const regulation = getRegulationById(regId);
    if (!regulation) continue;

    const mappings = entriesByRegulation[regId] ?? [];
    const requirementSatisfaction = new Map<string, boolean>();

    for (const mapping of mappings) {
      for (const match of mapping.matches) {
        const reqId = match.requirement.requirementId;
        const current = requirementSatisfaction.get(reqId);
        if (current === undefined) {
          requirementSatisfaction.set(reqId, match.satisfied);
        } else if (!match.satisfied) {
          requirementSatisfaction.set(reqId, false);
        }
      }
    }

    const applicableRequirements = requirementSatisfaction.size;
    let satisfiedRequirements = 0;
    for (const satisfied of requirementSatisfaction.values()) {
      if (satisfied) satisfiedRequirements++;
    }

    summaries.push({
      regulationId: regId,
      regulationName: regulation.name,
      totalRequirements: regulation.requirements.length,
      applicableRequirements,
      satisfiedRequirements,
      complianceRate:
        applicableRequirements > 0
          ? satisfiedRequirements / applicableRequirements
          : 1,
    });
  }

  return summaries;
}

function collectGaps(
  entriesByRegulation: Record<string, ReadonlyArray<EntryRegulationMapping>>,
): ReadonlyArray<ComplianceGap> {
  const gaps: Array<ComplianceGap> = [];
  const seen = new Set<string>();

  for (const mappings of Object.values(entriesByRegulation)) {
    for (const mapping of mappings) {
      for (const match of mapping.matches) {
        if (match.satisfied) continue;
        const key = `${mapping.entryId}:${match.requirement.requirementId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        gaps.push({
          entryId: mapping.entryId,
          sequenceNumber: mapping.sequenceNumber,
          requirementId: match.requirement.requirementId,
          regulationId: match.requirement.regulationId,
          requirementTitle: match.requirement.title,
          missingFields: match.missingFields,
          gaps: match.gaps,
        });
      }
    }
  }

  return gaps;
}

function buildCertificateSummaries(
  chain: ChainState,
  certificates: ReadonlyMap<string, ReasoningCertificate> | undefined,
): ReadonlyArray<CertificateSummary> {
  if (!certificates || certificates.size === 0) return [];

  const summaries: Array<CertificateSummary> = [];
  for (const entry of chain.entries) {
    if (entry.reasoningCertificateId === null) continue;
    const cert = certificates.get(entry.reasoningCertificateId);
    if (!cert) continue;
    summaries.push({
      certificateId: cert.certificateId,
      entryId: entry.entryId,
      modelId: cert.modelId,
      modelProvider: cert.modelProvider,
      claimCount: cert.claims.length,
      unsupportedClaimCount: cert.unsupportedClaims.length,
      confidenceLevel: cert.confidenceAssessment.level,
      confidenceScore: cert.confidenceAssessment.score,
    });
  }

  return summaries;
}

/**
 * Generate a compliance report for a chain segment.
 * Runs auto-tagging on every entry, groups results by regulation,
 * identifies gaps, and summarizes attached reasoning certificates.
 */
export function generateComplianceReport(
  input: GenerateReportInput,
): ComplianceReport {
  const {
    reportId,
    chain,
    defaultMetadata,
    entryMetadataOverrides,
    certificates,
  } = input;

  const targetRegulationIds =
    input.regulationIds && input.regulationIds.length > 0
      ? input.regulationIds
      : getAllRegulations().map((r) => r.regulationId);

  const chainIntegrity = verifyChainIntegrity(chain);

  const entriesByRegulation: Record<string, Array<EntryRegulationMapping>> = {};
  for (const regId of targetRegulationIds) {
    entriesByRegulation[regId] = [];
  }

  let entriesWithCertificates = 0;
  let entriesWithProvenance = 0;

  for (const entry of chain.entries) {
    const metadata = getMetadataForEntry(
      entry.entryId,
      defaultMetadata,
      entryMetadataOverrides,
    );

    if (entry.reasoningCertificateId !== null) entriesWithCertificates++;
    if (entry.provenanceId !== null) entriesWithProvenance++;

    for (const regId of targetRegulationIds) {
      const tagResult = tagEntryForRegulation(entry, metadata, regId);
      if (tagResult.matches.length === 0) continue;

      const satisfiedCount = tagResult.matches.filter((m) => m.satisfied).length;
      const mapping: EntryRegulationMapping = {
        entryId: entry.entryId,
        sequenceNumber: entry.sequenceNumber,
        entryType: entry.entryType,
        decisionType: entry.decisionType,
        matches: tagResult.matches,
        satisfiedCount,
        totalCount: tagResult.matches.length,
      };

      (entriesByRegulation[regId] as Array<EntryRegulationMapping>).push(mapping);
    }
  }

  const regulationSummaries = buildRegulationSummaries(
    entriesByRegulation,
    targetRegulationIds,
  );
  const gaps = collectGaps(entriesByRegulation);
  const certificateSummaries = buildCertificateSummaries(chain, certificates);

  let totalApplicable = 0;
  let totalSatisfied = 0;
  for (const summary of regulationSummaries) {
    totalApplicable += summary.applicableRequirements;
    totalSatisfied += summary.satisfiedRequirements;
  }

  const statistics: ReportStatistics = {
    totalEntries: chain.entries.length,
    entriesWithCertificates,
    entriesWithProvenance,
    totalGaps: gaps.length,
    overallComplianceRate:
      totalApplicable > 0 ? totalSatisfied / totalApplicable : 1,
  };

  return {
    reportId,
    generatedAt: new Date().toISOString(),
    chainId: chain.chainId,
    chainIntegrity,
    regulationSummaries,
    entriesByRegulation,
    gaps,
    certificateSummaries,
    statistics,
  };
}

/** Serialize a compliance report as a formatted JSON string. */
export function exportReportAsJson(report: ComplianceReport): string {
  return JSON.stringify(report, null, 2);
}
