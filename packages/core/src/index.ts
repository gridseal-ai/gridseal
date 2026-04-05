export type {
  ProofChainEntry,
  CreateEntryInput,
  HashableEntryFields,
  Tier1Fields,
  Tier2Fields,
  Tier3Fields,
} from "./schema/proof-chain-entry.js";

export {
  TIER_2_DEFAULTS,
  TIER_3_DEFAULTS,
} from "./schema/proof-chain-entry.js";

export type { EntryType, DecisionType } from "./schema/entry-types.js";
export { ENTRY_TYPES, DECISION_TYPES } from "./schema/entry-types.js";

export type { Result } from "./schema/result.js";
export { ok, err } from "./schema/result.js";

export {
  sha256,
  canonicalize,
  computeEntryHash,
  serializeForHashing,
} from "./chain/hash.js";

export type {
  ChainState,
  ChainError,
  AppendEntryInput,
} from "./chain/proof-chain.js";

export {
  createChain,
  appendEntry,
  getChildren,
  getRootEntries,
  getSubtree,
  getLastEntry,
} from "./chain/proof-chain.js";

export type { ValidationError } from "./chain/validation.js";

export {
  validateEntry,
  validateChain,
  validateSubtree,
} from "./chain/validation.js";

export type {
  ReasoningCertificate,
  CreateCertificateInput,
  Claim,
  Evidence,
  UnsupportedClaim,
  Assumption,
  Limitation,
  ConfidenceAssessment,
  ConfidenceLevel,
} from "./certificate/reasoning-certificate.js";

export {
  CONFIDENCE_LEVELS,
  createCertificate,
  verifyCertificate,
  computeCertificateHash,
  serializeCertificateForHashing,
} from "./certificate/reasoning-certificate.js";

export type {
  Premise,
  TraceStep,
  Conclusion,
  DecisionContext,
  CertificateTemplate,
  TemplateValidationResult,
} from "./certificate/engine.js";

export {
  CLASSIFICATION_TEMPLATE,
  RECOMMENDATION_TEMPLATE,
  APPROVAL_DENIAL_TEMPLATE,
  RISK_SCORING_TEMPLATE,
  CERTIFICATE_TEMPLATES,
  confidenceLevelFromScore,
  validateAgainstTemplate,
  generateCertificate,
  generateCertificateWithTemplate,
  getTemplateNames,
  getTemplate,
} from "./certificate/engine.js";

export type {
  ModelProvenance,
  CreateProvenanceInput,
  ModelType,
  PerformanceMetric,
  DatasetReference,
  ExternalReference,
  EthicalConsideration,
} from "./provenance/model-provenance.js";

export {
  MODEL_TYPES,
  createProvenance,
  verifyProvenance,
  computeProvenanceHash,
  serializeProvenanceForHashing,
} from "./provenance/model-provenance.js";

export type {
  StorageAdapter,
  StorageError,
} from "./storage/storage-adapter.js";

export { createInMemoryAdapter } from "./storage/in-memory-adapter.js";

export type {
  Sector,
  RiskLevel,
  DataType,
  AuthorityLevel,
  RegulatoryRequirement,
  Regulation,
  EntryComplianceContext,
  RegulationMatch,
} from "./compliance/types.js";

export {
  SECTORS,
  RISK_LEVELS,
  DATA_TYPES,
  AUTHORITY_LEVELS,
} from "./compliance/types.js";

export { coloradoSb205 } from "./compliance/regulations/colorado-sb205.js";
export { COLORADO_SB205_REQUIREMENTS } from "./compliance/regulations/colorado-sb205.js";
export { nistAiRmf } from "./compliance/regulations/nist-ai-rmf.js";
export { NIST_AI_RMF_REQUIREMENTS } from "./compliance/regulations/nist-ai-rmf.js";
export { euAiAct } from "./compliance/regulations/eu-ai-act.js";
export { EU_AI_ACT_REQUIREMENTS } from "./compliance/regulations/eu-ai-act.js";
export { hipaaAudit } from "./compliance/regulations/hipaa-audit.js";
export { HIPAA_AUDIT_REQUIREMENTS } from "./compliance/regulations/hipaa-audit.js";

export {
  getAllRegulations,
  getRegulationById,
  getRegulationIds,
} from "./compliance/regulations/registry.js";

export type { EntryMetadata, AutoTagResult } from "./compliance/auto-tagger.js";

export {
  extractComplianceContext,
  matchRequirement,
  tagEntry,
  tagEntryForRegulation,
} from "./compliance/auto-tagger.js";

export type {
  ChainIntegrityResult,
  RegulationSummary,
  EntryRegulationMapping,
  ComplianceGap,
  CertificateSummary,
  ReportStatistics,
  ComplianceReport,
  GenerateReportInput,
} from "./export/compliance-report.js";

export {
  generateComplianceReport,
  exportReportAsJson,
} from "./export/compliance-report.js";

export type {
  PolicyDecision,
  RuleCategory,
  ActionConditions,
  ActionRule,
  AuthorityPolicy,
  ActionRequest,
  EnforcementResult,
} from "./compliance/authority/types.js";

export {
  POLICY_DECISIONS,
  RULE_CATEGORIES,
} from "./compliance/authority/types.js";

export type { PolicyParseError } from "./compliance/authority/policy-parser.js";
export { parsePolicy } from "./compliance/authority/policy-parser.js";

export {
  enforcePolicy,
  enforcementToTags,
} from "./compliance/authority/enforcement.js";

export type {
  CycloneDxBom,
  CdxComponent,
  CdxModelCard,
  CdxMetadata,
  CdxPerformanceMetric,
  CdxDataset,
  CdxExternalReference,
  CdxHash,
  CdxLicense,
  CdxOrganization,
  GenerateBomInput,
  BomGenerationError,
} from "./provenance/cyclonedx.js";

export {
  generateCycloneDxBom,
  exportBomAsJson,
  exportBomAsCleanJson,
  stripNulls,
} from "./provenance/cyclonedx.js";
