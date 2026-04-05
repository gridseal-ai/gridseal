/**
 * Types for the regulatory compliance reference database.
 * Each regulation is modeled as a collection of typed requirement objects
 * that can be matched against Proof Chain entry metadata.
 */

/** Sectors where AI regulations commonly apply. */
export const SECTORS = [
  "healthcare",
  "finance",
  "insurance",
  "employment",
  "education",
  "housing",
  "criminal_justice",
  "government",
  "general",
] as const;

export type Sector = (typeof SECTORS)[number];

/** Risk levels for AI systems under various regulatory frameworks. */
export const RISK_LEVELS = [
  "minimal",
  "limited",
  "high",
  "unacceptable",
] as const;

export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Data types that may trigger regulatory requirements. */
export const DATA_TYPES = [
  "personal",
  "sensitive",
  "health",
  "financial",
  "biometric",
  "behavioral",
  "anonymized",
  "aggregated",
  "public",
] as const;

export type DataType = (typeof DATA_TYPES)[number];

/** Authority levels for AI decision-making. */
export const AUTHORITY_LEVELS = [
  "autonomous",
  "human_in_the_loop",
  "human_on_the_loop",
  "advisory",
] as const;

export type AuthorityLevel = (typeof AUTHORITY_LEVELS)[number];

/** A single regulatory requirement within a regulation. */
export type RegulatoryRequirement = {
  /** Unique identifier for this requirement (e.g., "CO-SB205-6-1-1703-a"). */
  readonly requirementId: string;
  /** The regulation this requirement belongs to. */
  readonly regulationId: string;
  /** Section or article reference within the regulation. */
  readonly sectionRef: string;
  /** Human-readable title of the requirement. */
  readonly title: string;
  /** Detailed description of what the requirement mandates. */
  readonly description: string;
  /** Sectors this requirement applies to. Empty array means all sectors. */
  readonly applicableSectors: ReadonlyArray<Sector>;
  /** Decision types this requirement applies to. Empty array means all types. */
  readonly applicableDecisionTypes: ReadonlyArray<string>;
  /** Data types that trigger this requirement. Empty array means all types. */
  readonly applicableDataTypes: ReadonlyArray<DataType>;
  /** Authority levels this requirement applies to. Empty array means all levels. */
  readonly applicableAuthorityLevels: ReadonlyArray<AuthorityLevel>;
  /** Minimum risk level that triggers this requirement. Null means any risk level. */
  readonly minimumRiskLevel: RiskLevel | null;
  /** Proof Chain fields that must be populated to satisfy this requirement. */
  readonly requiredFields: ReadonlyArray<string>;
  /** Whether this requirement mandates a reasoning certificate. */
  readonly requiresReasoningCertificate: boolean;
  /** Whether this requirement mandates model provenance / AIBOM. */
  readonly requiresProvenance: boolean;
};

/** Metadata about a regulation as a whole. */
export type Regulation = {
  /** Unique identifier for the regulation (e.g., "colorado-sb205"). */
  readonly regulationId: string;
  /** Official name of the regulation. */
  readonly name: string;
  /** Jurisdiction or issuing body. */
  readonly jurisdiction: string;
  /** Version or effective date of the regulation. */
  readonly version: string;
  /** Brief description of the regulation's scope and purpose. */
  readonly description: string;
  /** All requirements defined by this regulation. */
  readonly requirements: ReadonlyArray<RegulatoryRequirement>;
};

/** Metadata tags on a Proof Chain entry used for regulatory matching. */
export type EntryComplianceContext = {
  /** Sectors relevant to this entry. */
  readonly sectors: ReadonlyArray<Sector>;
  /** Data types processed by this entry. */
  readonly dataTypes: ReadonlyArray<DataType>;
  /** The decision type of this entry (from ProofChainEntry.decisionType). */
  readonly decisionType: string | null;
  /** Authority level of this AI decision. */
  readonly authorityLevel: AuthorityLevel | null;
  /** Risk level assigned to this AI system. */
  readonly riskLevel: RiskLevel | null;
  /** Whether a reasoning certificate is attached. */
  readonly hasReasoningCertificate: boolean;
  /** Whether model provenance is attached. */
  readonly hasProvenance: boolean;
  /** Set of populated field names on the entry. */
  readonly populatedFields: ReadonlyArray<string>;
};

/** Result of matching an entry against regulatory requirements. */
export type RegulationMatch = {
  /** The requirement that applies. */
  readonly requirement: RegulatoryRequirement;
  /** Whether the entry satisfies this requirement based on populated fields. */
  readonly satisfied: boolean;
  /** Fields that are required but missing. */
  readonly missingFields: ReadonlyArray<string>;
  /** Specific reasons why the requirement is not satisfied, if applicable. */
  readonly gaps: ReadonlyArray<string>;
};
