import type { Regulation, RegulatoryRequirement } from "../types.js";

const REG_ID = "eu-ai-act";

/* ---------- Article 12: Record-keeping ---------- */

const recordKeepingAutoLog: RegulatoryRequirement = {
  requirementId: `${REG_ID}-art12-1`,
  regulationId: REG_ID,
  sectionRef: "Article 12(1)",
  title: "Automatic logging of events",
  description:
    "High-risk AI systems shall technically allow for the automatic recording of events (logs) over the lifetime of the system. The logging capabilities shall conform to recognised standards or common specifications.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: "high",
  requiredFields: [
    "entryId",
    "chainId",
    "timestamp",
    "entryType",
    "entryHash",
    "previousHash",
  ],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const recordKeepingTraceability: RegulatoryRequirement = {
  requirementId: `${REG_ID}-art12-2`,
  regulationId: REG_ID,
  sectionRef: "Article 12(2)",
  title: "Traceability of AI system functioning",
  description:
    "Logging capabilities shall ensure a level of traceability of the AI system's functioning throughout its lifecycle that is appropriate to the intended purpose of the system.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: "high",
  requiredFields: [
    "sequenceNumber",
    "previousHash",
    "modelId",
    "modelProvider",
    "sessionId",
  ],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

const recordKeepingInputOutput: RegulatoryRequirement = {
  requirementId: `${REG_ID}-art12-3`,
  regulationId: REG_ID,
  sectionRef: "Article 12(3)",
  title: "Recording of input and output data",
  description:
    "Logging capabilities shall include the recording of data about the input data and output of the AI system, especially where the system is used for decisions affecting natural persons.",
  applicableSectors: [],
  applicableDecisionTypes: [
    "classification",
    "recommendation",
    "routing",
  ],
  applicableDataTypes: ["personal", "sensitive", "health", "biometric"],
  applicableAuthorityLevels: ["autonomous", "human_in_the_loop"],
  minimumRiskLevel: "high",
  requiredFields: [
    "inputHash",
    "outputHash",
    "inputTokenCount",
    "outputTokenCount",
  ],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const recordKeepingPeriod: RegulatoryRequirement = {
  requirementId: `${REG_ID}-art12-4`,
  regulationId: REG_ID,
  sectionRef: "Article 12(4)",
  title: "Log retention for appropriate period",
  description:
    "The logs referred to in paragraph 1 shall be kept for a period that is appropriate in the light of the intended purpose of the high-risk AI system and applicable legal obligations.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: "high",
  requiredFields: ["timestamp", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

/* ---------- Article 13: Transparency ---------- */

const transparencyDesign: RegulatoryRequirement = {
  requirementId: `${REG_ID}-art13-1`,
  regulationId: REG_ID,
  sectionRef: "Article 13(1)",
  title: "Transparency by design",
  description:
    "High-risk AI systems shall be designed and developed in such a way as to ensure that their operation is sufficiently transparent to enable deployers to interpret a system's output and use it appropriately.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: "high",
  requiredFields: ["decisionType", "confidenceScore"],
  requiresReasoningCertificate: true,
  requiresProvenance: false,
};

const transparencyInstructions: RegulatoryRequirement = {
  requirementId: `${REG_ID}-art13-2`,
  regulationId: REG_ID,
  sectionRef: "Article 13(2)",
  title: "Instructions for use",
  description:
    "High-risk AI systems shall be accompanied by instructions for use in an appropriate digital format or otherwise, including: the identity of the provider, system characteristics and capabilities, intended purpose, foreseeable misuse, human oversight measures, and expected levels of accuracy, robustness, and cybersecurity.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: "high",
  requiredFields: ["modelId", "modelProvider", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

/* ---------- Article 14: Human oversight ---------- */

const humanOversight: RegulatoryRequirement = {
  requirementId: `${REG_ID}-art14-1`,
  regulationId: REG_ID,
  sectionRef: "Article 14(1)",
  title: "Human oversight measures",
  description:
    "High-risk AI systems shall be designed and developed in such a way, including with appropriate human-machine interface tools, that they can be effectively overseen by natural persons during the period in which they are in use.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: ["personal", "sensitive", "health", "biometric"],
  applicableAuthorityLevels: ["autonomous", "human_in_the_loop", "human_on_the_loop"],
  minimumRiskLevel: "high",
  requiredFields: ["actorId", "annotation", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

/* ---------- Article 15: Accuracy, robustness, cybersecurity ---------- */

const accuracyRobustness: RegulatoryRequirement = {
  requirementId: `${REG_ID}-art15-1`,
  regulationId: REG_ID,
  sectionRef: "Article 15(1)",
  title: "Accuracy, robustness, and cybersecurity",
  description:
    "High-risk AI systems shall be designed and developed in such a way that they achieve an appropriate level of accuracy, robustness, and cybersecurity, and that they perform consistently in those respects throughout their lifecycle.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: "high",
  requiredFields: ["confidenceScore", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

export const EU_AI_ACT_REQUIREMENTS: ReadonlyArray<RegulatoryRequirement> = [
  recordKeepingAutoLog,
  recordKeepingTraceability,
  recordKeepingInputOutput,
  recordKeepingPeriod,
  transparencyDesign,
  transparencyInstructions,
  humanOversight,
  accuracyRobustness,
];

export const euAiAct: Regulation = {
  regulationId: REG_ID,
  name: "EU Artificial Intelligence Act",
  jurisdiction: "European Union",
  version: "2024-08-01",
  description:
    "The EU AI Act establishes harmonized rules for AI systems in the European Union. Article 12 mandates automatic logging and record-keeping for high-risk AI systems. Article 13 requires transparency in design and instructions for use. Article 14 mandates human oversight measures. Article 15 requires appropriate levels of accuracy, robustness, and cybersecurity.",
  requirements: EU_AI_ACT_REQUIREMENTS,
};
