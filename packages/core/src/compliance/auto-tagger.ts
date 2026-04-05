import type {
  AuthorityLevel,
  DataType,
  EntryComplianceContext,
  RegulationMatch,
  RegulatoryRequirement,
  RiskLevel,
  Sector,
} from "./types.js";
import type { ProofChainEntry } from "../schema/proof-chain-entry.js";
import { getAllRegulations } from "./regulations/registry.js";

/**
 * Entry metadata not derivable from ProofChainEntry fields alone.
 * Callers supply sector, data type, authority, and risk context.
 */
export type EntryMetadata = {
  readonly sectors: ReadonlyArray<Sector>;
  readonly dataTypes: ReadonlyArray<DataType>;
  readonly authorityLevel: AuthorityLevel | null;
  readonly riskLevel: RiskLevel | null;
};

const RISK_LEVEL_ORDER: Record<RiskLevel, number> = {
  minimal: 0,
  limited: 1,
  high: 2,
  unacceptable: 3,
};

/** Returns true if the entry's risk level meets or exceeds the minimum. */
function meetsMinimumRisk(
  entryRisk: RiskLevel | null,
  minimumRisk: RiskLevel | null,
): boolean {
  if (minimumRisk === null) return true;
  if (entryRisk === null) return false;
  return RISK_LEVEL_ORDER[entryRisk] >= RISK_LEVEL_ORDER[minimumRisk];
}

/** Returns true if at least one element appears in both arrays, or if the filter is empty. */
function hasOverlap(
  entryValues: ReadonlyArray<string>,
  filterValues: ReadonlyArray<string>,
): boolean {
  if (filterValues.length === 0) return true;
  if (entryValues.length === 0) return false;
  const filterSet = new Set(filterValues);
  return entryValues.some((v) => filterSet.has(v));
}

/** Collects the names of all non-null, non-empty fields on an entry. */
function getPopulatedFields(entry: ProofChainEntry): ReadonlyArray<string> {
  const populated: Array<string> = [];
  for (const [key, value] of Object.entries(entry)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) continue;
    populated.push(key);
  }
  return populated;
}

/** Extracts an EntryComplianceContext from a ProofChainEntry and external metadata. */
export function extractComplianceContext(
  entry: ProofChainEntry,
  metadata: EntryMetadata,
): EntryComplianceContext {
  return {
    sectors: metadata.sectors,
    dataTypes: metadata.dataTypes,
    decisionType: entry.decisionType,
    authorityLevel: metadata.authorityLevel,
    riskLevel: metadata.riskLevel,
    hasReasoningCertificate: entry.reasoningCertificateId !== null,
    hasProvenance: entry.provenanceId !== null,
    populatedFields: getPopulatedFields(entry),
  };
}

/** Checks whether a single requirement applies to a context, and if so, whether it is satisfied. */
export function matchRequirement(
  context: EntryComplianceContext,
  requirement: RegulatoryRequirement,
): RegulationMatch | null {
  if (!hasOverlap(context.sectors, requirement.applicableSectors)) {
    return null;
  }

  if (!hasOverlap(context.dataTypes, requirement.applicableDataTypes)) {
    return null;
  }

  const decisionTypes = context.decisionType !== null ? [context.decisionType] : [];
  if (!hasOverlap(decisionTypes, requirement.applicableDecisionTypes)) {
    return null;
  }

  const authorityLevels = context.authorityLevel !== null ? [context.authorityLevel] : [];
  if (!hasOverlap(authorityLevels, requirement.applicableAuthorityLevels)) {
    return null;
  }

  if (!meetsMinimumRisk(context.riskLevel, requirement.minimumRiskLevel)) {
    return null;
  }

  const populatedSet = new Set(context.populatedFields);
  const missingFields: Array<string> = [];
  for (const field of requirement.requiredFields) {
    if (!populatedSet.has(field)) {
      missingFields.push(field);
    }
  }

  const gaps: Array<string> = [];
  if (requirement.requiresReasoningCertificate && !context.hasReasoningCertificate) {
    gaps.push("Missing reasoning certificate");
  }
  if (requirement.requiresProvenance && !context.hasProvenance) {
    gaps.push("Missing model provenance");
  }
  if (missingFields.length > 0) {
    gaps.push(`Missing required fields: ${missingFields.join(", ")}`);
  }

  return {
    requirement,
    satisfied: missingFields.length === 0 && gaps.length === 0,
    missingFields,
    gaps,
  };
}

/** Result of auto-tagging an entry against all regulations. */
export type AutoTagResult = {
  readonly context: EntryComplianceContext;
  readonly matches: ReadonlyArray<RegulationMatch>;
  readonly regulationIds: ReadonlyArray<string>;
};

/**
 * Tags a Proof Chain entry against all registered regulations.
 * Returns all applicable requirement matches with satisfaction status.
 */
export function tagEntry(
  entry: ProofChainEntry,
  metadata: EntryMetadata,
): AutoTagResult {
  const context = extractComplianceContext(entry, metadata);
  const matches: Array<RegulationMatch> = [];
  const regulationIdSet = new Set<string>();

  for (const regulation of getAllRegulations()) {
    for (const requirement of regulation.requirements) {
      const match = matchRequirement(context, requirement);
      if (match !== null) {
        matches.push(match);
        regulationIdSet.add(requirement.regulationId);
      }
    }
  }

  return {
    context,
    matches,
    regulationIds: Array.from(regulationIdSet),
  };
}

/**
 * Tags an entry against a specific regulation by ID.
 * Returns matches for only that regulation's requirements.
 */
export function tagEntryForRegulation(
  entry: ProofChainEntry,
  metadata: EntryMetadata,
  regulationId: string,
): AutoTagResult {
  const context = extractComplianceContext(entry, metadata);
  const matches: Array<RegulationMatch> = [];

  for (const regulation of getAllRegulations()) {
    if (regulation.regulationId !== regulationId) continue;
    for (const requirement of regulation.requirements) {
      const match = matchRequirement(context, requirement);
      if (match !== null) {
        matches.push(match);
      }
    }
  }

  return {
    context,
    matches,
    regulationIds: matches.length > 0 ? [regulationId] : [],
  };
}
