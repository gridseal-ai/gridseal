import type { Regulation, RegulatoryRequirement } from "../types.js";
import {
  NIST_GOVERN_REQUIREMENTS,
  NIST_MAP_REQUIREMENTS,
} from "./nist-ai-rmf-govern-map.js";

const REG_ID = "nist-ai-rmf";

/* ---------- MEASURE function ---------- */

const measureMetrics: RegulatoryRequirement = {
  requirementId: `${REG_ID}-measure-1`,
  regulationId: REG_ID,
  sectionRef: "MEASURE 1",
  title: "Appropriate metrics for AI risk measurement",
  description:
    "Appropriate methods and metrics are identified and applied. Performance and risk metrics are captured regularly and tracked over time.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["confidenceScore", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

const measureEvaluation: RegulatoryRequirement = {
  requirementId: `${REG_ID}-measure-2`,
  regulationId: REG_ID,
  sectionRef: "MEASURE 2",
  title: "AI system evaluation and testing",
  description:
    "AI systems are evaluated for trustworthy characteristics. Systems are tested with domain experts and stakeholders in conditions consistent with the deployment context.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["modelId", "inputHash", "outputHash"],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

const measureMonitoring: RegulatoryRequirement = {
  requirementId: `${REG_ID}-measure-3`,
  regulationId: REG_ID,
  sectionRef: "MEASURE 3",
  title: "Mechanisms for tracking identified risks over time",
  description:
    "Mechanisms for tracking identified AI risks over time are in place. Risks are regularly monitored and reassessed as new information becomes available.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["sessionId", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const measureFeedback: RegulatoryRequirement = {
  requirementId: `${REG_ID}-measure-4`,
  regulationId: REG_ID,
  sectionRef: "MEASURE 4",
  title: "Feedback mechanisms for ongoing measurement",
  description:
    "Feedback about efficacy of measurement is collected and integrated, including from affected communities and domain experts.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["actorId", "annotation"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

/* ---------- MANAGE function ---------- */

const manageRiskPrioritization: RegulatoryRequirement = {
  requirementId: `${REG_ID}-manage-1`,
  regulationId: REG_ID,
  sectionRef: "MANAGE 1",
  title: "AI risk prioritization and treatment",
  description:
    "AI risks based on assessments and other analytical output from the MAP and MEASURE functions are prioritized, responded to, and managed.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["policyIds", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const manageRiskMitigation: RegulatoryRequirement = {
  requirementId: `${REG_ID}-manage-2`,
  regulationId: REG_ID,
  sectionRef: "MANAGE 2",
  title: "Risk mitigation strategies",
  description:
    "Strategies to maximize AI benefits and minimize negative impacts are planned, prepared, implemented, documented, and informed by input from relevant AI actors.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: ["autonomous", "human_in_the_loop"],
  minimumRiskLevel: null,
  requiredFields: ["policyIds", "annotation", "complianceMetadata"],
  requiresReasoningCertificate: true,
  requiresProvenance: false,
};

const manageIncidentResponse: RegulatoryRequirement = {
  requirementId: `${REG_ID}-manage-3`,
  regulationId: REG_ID,
  sectionRef: "MANAGE 3",
  title: "Incident response and escalation",
  description:
    "Post-deployment AI system monitoring plans are implemented, including mechanisms for capturing and evaluating input from users and other relevant AI actors, appeal and override, decommission, incident response, recovery, and change management.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["actorId", "policyIds"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const manageDocumentation: RegulatoryRequirement = {
  requirementId: `${REG_ID}-manage-4`,
  regulationId: REG_ID,
  sectionRef: "MANAGE 4",
  title: "Risk management documentation and communication",
  description:
    "Risk treatments, including response and recovery, and communication plans for the identified and measured AI risks are documented and monitored regularly.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["annotation", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

export const NIST_AI_RMF_REQUIREMENTS: ReadonlyArray<RegulatoryRequirement> = [
  ...NIST_GOVERN_REQUIREMENTS,
  ...NIST_MAP_REQUIREMENTS,
  measureMetrics,
  measureEvaluation,
  measureMonitoring,
  measureFeedback,
  manageRiskPrioritization,
  manageRiskMitigation,
  manageIncidentResponse,
  manageDocumentation,
];

export const nistAiRmf: Regulation = {
  regulationId: REG_ID,
  name: "NIST AI Risk Management Framework (AI RMF 1.0)",
  jurisdiction: "United States (Federal, voluntary framework)",
  version: "2023-01-26",
  description:
    "The NIST AI RMF provides voluntary guidance for managing risks throughout the AI lifecycle. It is organized around four core functions: Govern (cross-cutting policies and accountability), Map (context and risk identification), Measure (analysis and tracking), and Manage (prioritization and response).",
  requirements: NIST_AI_RMF_REQUIREMENTS,
};
