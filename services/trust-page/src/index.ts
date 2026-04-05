export type {
  VerificationSummary,
  EntryTypeCounts,
  DecisionTypeCounts,
  ModelUsageSummary,
  TimelineSummary,
  HumanReviewSummary,
  ComplianceAvailability,
  CertificateSummary,
  ProvenanceSummary,
  TrustPageData,
} from "./aggregate.js";

export {
  verifyChain,
  countEntryTypes,
  countDecisionTypes,
  aggregateModelUsage,
  computeTimeline,
  collectActors,
  collectSessions,
  collectPolicyIds,
  computeHumanReview,
  computeComplianceAvailability,
  summarizeCertificate,
  summarizeProvenance,
  aggregateTrustPageData,
} from "./aggregate.js";

export { escapeHtml, formatDuration, renderTrustPage } from "./render.js";

export type {
  GeneratorError,
  GenerateOptions,
  GenerateResult,
} from "./generator.js";

export { generateTrustPage, generateTrustPageData } from "./generator.js";

export type {
  BadgeStatus,
  BadgeData,
  BadgeOptions,
} from "./badge.js";

export { computeBadgeData, renderBadgeSvg } from "./badge.js";
