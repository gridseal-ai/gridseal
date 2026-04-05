import type { Regulation, RegulatoryRequirement } from "../types.js";

const REG_ID = "colorado-sb205";

const impactAssessment: RegulatoryRequirement = {
  requirementId: `${REG_ID}-6-1-1703-3`,
  regulationId: REG_ID,
  sectionRef: "Section 6-1-1703(3)",
  title: "Impact assessment for high-risk AI systems",
  description:
    "Deployers of high-risk AI systems must complete an impact assessment before deploying the system, documenting the purpose, intended benefits, potential risks, and the categories of data processed.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: ["autonomous", "human_in_the_loop"],
  minimumRiskLevel: "high",
  requiredFields: [
    "decisionType",
    "modelId",
    "modelProvider",
    "complianceMetadata",
  ],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

const disclosureToConsumers: RegulatoryRequirement = {
  requirementId: `${REG_ID}-6-1-1703-4a`,
  regulationId: REG_ID,
  sectionRef: "Section 6-1-1703(4)(a)",
  title: "Disclosure to consumers interacting with AI",
  description:
    "Deployers must disclose to consumers that they are interacting with an AI system and provide a summary of the system's purpose, limitations, and the nature of the consequential decision.",
  applicableSectors: [],
  applicableDecisionTypes: [
    "classification",
    "recommendation",
    "routing",
  ],
  applicableDataTypes: ["personal", "sensitive", "health", "financial"],
  applicableAuthorityLevels: ["autonomous", "human_in_the_loop"],
  minimumRiskLevel: "high",
  requiredFields: ["actorId", "decisionType", "tags"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const explanationOfDecision: RegulatoryRequirement = {
  requirementId: `${REG_ID}-6-1-1703-4b`,
  regulationId: REG_ID,
  sectionRef: "Section 6-1-1703(4)(b)",
  title: "Explanation of consequential AI decisions",
  description:
    "When an AI system makes or substantially contributes to a consequential decision, the deployer must provide the consumer with a statement disclosing the principal reasons for the decision, including the data that influenced it.",
  applicableSectors: [
    "healthcare",
    "finance",
    "insurance",
    "employment",
    "education",
    "housing",
    "criminal_justice",
  ],
  applicableDecisionTypes: [
    "classification",
    "recommendation",
  ],
  applicableDataTypes: ["personal", "sensitive", "health", "financial"],
  applicableAuthorityLevels: ["autonomous", "human_in_the_loop"],
  minimumRiskLevel: "high",
  requiredFields: [
    "decisionType",
    "inputHash",
    "outputHash",
    "confidenceScore",
    "reasoningCertificateId",
  ],
  requiresReasoningCertificate: true,
  requiresProvenance: false,
};

const appealProcess: RegulatoryRequirement = {
  requirementId: `${REG_ID}-6-1-1703-4b-appeal`,
  regulationId: REG_ID,
  sectionRef: "Section 6-1-1703(4)(b)",
  title: "Opportunity to appeal consequential decisions",
  description:
    "Deployers must provide consumers with an opportunity to appeal a consequential decision made by an AI system and to request human review of the decision.",
  applicableSectors: [
    "healthcare",
    "finance",
    "insurance",
    "employment",
    "education",
    "housing",
  ],
  applicableDecisionTypes: ["classification", "recommendation"],
  applicableDataTypes: ["personal", "sensitive"],
  applicableAuthorityLevels: ["autonomous"],
  minimumRiskLevel: "high",
  requiredFields: ["actorId", "decisionType", "annotation"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const riskManagementProgram: RegulatoryRequirement = {
  requirementId: `${REG_ID}-6-1-1703-2`,
  regulationId: REG_ID,
  sectionRef: "Section 6-1-1703(2)",
  title: "Risk management policy and program",
  description:
    "Deployers must implement a risk management policy and program governing the deployment and use of high-risk AI systems, including governance, oversight measures, and regular assessments.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: "high",
  requiredFields: ["policyIds", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const dataGovernance: RegulatoryRequirement = {
  requirementId: `${REG_ID}-6-1-1703-3-data`,
  regulationId: REG_ID,
  sectionRef: "Section 6-1-1703(3)",
  title: "Data governance for training and operation",
  description:
    "Developers and deployers must maintain governance practices over the data used to train, test, and operate high-risk AI systems, including measures to detect and mitigate bias.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: ["personal", "sensitive", "health", "biometric"],
  applicableAuthorityLevels: [],
  minimumRiskLevel: "high",
  requiredFields: ["inputHash", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

export const COLORADO_SB205_REQUIREMENTS: ReadonlyArray<RegulatoryRequirement> = [
  impactAssessment,
  disclosureToConsumers,
  explanationOfDecision,
  appealProcess,
  riskManagementProgram,
  dataGovernance,
];

export const coloradoSb205: Regulation = {
  regulationId: REG_ID,
  name: "Colorado AI Act (SB 24-205)",
  jurisdiction: "State of Colorado, United States",
  version: "2024-05-17",
  description:
    "Colorado's comprehensive AI governance law requiring impact assessments, consumer disclosures, explanation rights, and risk management for high-risk AI systems making consequential decisions in areas such as employment, finance, healthcare, housing, insurance, and education.",
  requirements: COLORADO_SB205_REQUIREMENTS,
};
