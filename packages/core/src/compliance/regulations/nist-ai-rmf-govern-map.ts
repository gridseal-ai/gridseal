import type { RegulatoryRequirement } from "../types.js";

const REG_ID = "nist-ai-rmf";

/* ---------- GOVERN function ---------- */

const governPolicies: RegulatoryRequirement = {
  requirementId: `${REG_ID}-govern-1`,
  regulationId: REG_ID,
  sectionRef: "GOVERN 1",
  title: "Policies to guide AI risk management",
  description:
    "Policies, processes, procedures, and practices across the organization related to the mapping, measuring, and managing of AI risks are in place, transparent, and implemented effectively.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["policyIds"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const governAccountability: RegulatoryRequirement = {
  requirementId: `${REG_ID}-govern-2`,
  regulationId: REG_ID,
  sectionRef: "GOVERN 2",
  title: "Accountability structures for AI risk",
  description:
    "Accountability structures are in place so that the appropriate teams and individuals are empowered, responsible, and trained for mapping, measuring, and managing AI risks.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["actorId", "policyIds"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const governWorkforceDiversity: RegulatoryRequirement = {
  requirementId: `${REG_ID}-govern-3`,
  regulationId: REG_ID,
  sectionRef: "GOVERN 3",
  title: "Workforce diversity and AI expertise",
  description:
    "Workforce diversity, equity, inclusion, and accessibility processes are prioritized in the mapping, measuring, and managing of AI risks throughout the lifecycle.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const governOrgContext: RegulatoryRequirement = {
  requirementId: `${REG_ID}-govern-4`,
  regulationId: REG_ID,
  sectionRef: "GOVERN 4",
  title: "Organizational context for AI risk management",
  description:
    "Organizational teams are committed to a culture that considers and communicates AI risk.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const governEngagement: RegulatoryRequirement = {
  requirementId: `${REG_ID}-govern-5`,
  regulationId: REG_ID,
  sectionRef: "GOVERN 5",
  title: "Stakeholder engagement",
  description:
    "Processes are in place for robust engagement with relevant AI actors. Engagement is consistent with applicable regulations.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["actorId"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const governProcurement: RegulatoryRequirement = {
  requirementId: `${REG_ID}-govern-6`,
  regulationId: REG_ID,
  sectionRef: "GOVERN 6",
  title: "Third-party AI risk management",
  description:
    "Policies and procedures are in place to address AI risks and benefits arising from third-party software and data and other supply chain issues.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

/* ---------- MAP function ---------- */

const mapContext: RegulatoryRequirement = {
  requirementId: `${REG_ID}-map-1`,
  regulationId: REG_ID,
  sectionRef: "MAP 1",
  title: "Intended context of use and purpose",
  description:
    "Context is established and understood. The intended purpose, potentially beneficial uses, context of use, and the AI system's limitations are documented.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["decisionType", "tags", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

const mapRiskCategories: RegulatoryRequirement = {
  requirementId: `${REG_ID}-map-2`,
  regulationId: REG_ID,
  sectionRef: "MAP 2",
  title: "Categorize and classify AI risks",
  description:
    "Categorization of the AI system is performed. Categories related to the specific AI system and its context of use are identified.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: ["personal", "sensitive", "health", "financial", "biometric"],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["decisionType", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const mapBenefitsHarms: RegulatoryRequirement = {
  requirementId: `${REG_ID}-map-3`,
  regulationId: REG_ID,
  sectionRef: "MAP 3",
  title: "Assess potential benefits and harms",
  description:
    "AI system potential benefits and costs compared with appropriate benchmarks are understood. Potential positive and negative impacts on individuals, groups, communities, organizations, and society are identified.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: ["autonomous", "human_in_the_loop"],
  minimumRiskLevel: null,
  requiredFields: ["complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const mapRiskTolerance: RegulatoryRequirement = {
  requirementId: `${REG_ID}-map-4`,
  regulationId: REG_ID,
  sectionRef: "MAP 4",
  title: "Risk tolerance determination",
  description:
    "Risks and benefits are mapped for all components of the AI system including third-party software and data.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: true,
};

const mapImpactAssessment: RegulatoryRequirement = {
  requirementId: `${REG_ID}-map-5`,
  regulationId: REG_ID,
  sectionRef: "MAP 5",
  title: "Impact assessment across the lifecycle",
  description:
    "Likelihood and magnitude of each identified impact is characterized or estimated, including the impact of errors, misuse, or inadequate or adversarial data.",
  applicableSectors: [],
  applicableDecisionTypes: [],
  applicableDataTypes: [],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

export const NIST_GOVERN_REQUIREMENTS: ReadonlyArray<RegulatoryRequirement> = [
  governPolicies,
  governAccountability,
  governWorkforceDiversity,
  governOrgContext,
  governEngagement,
  governProcurement,
];

export const NIST_MAP_REQUIREMENTS: ReadonlyArray<RegulatoryRequirement> = [
  mapContext,
  mapRiskCategories,
  mapBenefitsHarms,
  mapRiskTolerance,
  mapImpactAssessment,
];
