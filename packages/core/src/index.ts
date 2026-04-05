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
