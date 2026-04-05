import type { Regulation, RegulatoryRequirement } from "../types.js";

const REG_ID = "hipaa-164-312-b";

const auditControlMechanism: RegulatoryRequirement = {
  requirementId: `${REG_ID}-1`,
  regulationId: REG_ID,
  sectionRef: "164.312(b) Standard",
  title: "Audit controls implementation",
  description:
    "Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information (ePHI).",
  applicableSectors: ["healthcare"],
  applicableDecisionTypes: [],
  applicableDataTypes: ["health", "personal", "sensitive"],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: [
    "entryId",
    "chainId",
    "timestamp",
    "entryType",
    "entryHash",
    "previousHash",
    "actorId",
  ],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const auditTrailIntegrity: RegulatoryRequirement = {
  requirementId: `${REG_ID}-2`,
  regulationId: REG_ID,
  sectionRef: "164.312(b) / 164.312(c)(1)",
  title: "Audit trail integrity protection",
  description:
    "Audit records must be protected against unauthorized alteration or destruction. Electronic mechanisms must be implemented to corroborate that ePHI has not been altered or destroyed in an unauthorized manner.",
  applicableSectors: ["healthcare"],
  applicableDecisionTypes: [],
  applicableDataTypes: ["health", "personal"],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: [
    "entryHash",
    "previousHash",
    "sequenceNumber",
  ],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const auditUserIdentification: RegulatoryRequirement = {
  requirementId: `${REG_ID}-3`,
  regulationId: REG_ID,
  sectionRef: "164.312(b) / 164.312(d)",
  title: "User identification in audit records",
  description:
    "Audit records must capture the identity of the person or entity accessing ePHI. This implements the person or entity authentication requirement of the Security Rule.",
  applicableSectors: ["healthcare"],
  applicableDecisionTypes: [],
  applicableDataTypes: ["health", "personal", "sensitive"],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["actorId", "sessionId"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const auditAccessTracking: RegulatoryRequirement = {
  requirementId: `${REG_ID}-4`,
  regulationId: REG_ID,
  sectionRef: "164.312(b) / 164.312(a)(1)",
  title: "Access tracking for ePHI systems",
  description:
    "Audit logs must track access to information systems containing ePHI, including what data was accessed, by whom, and what actions were performed.",
  applicableSectors: ["healthcare"],
  applicableDecisionTypes: [],
  applicableDataTypes: ["health"],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: [
    "actorId",
    "inputHash",
    "outputHash",
    "timestamp",
    "tags",
  ],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

const auditAiDecisionRecord: RegulatoryRequirement = {
  requirementId: `${REG_ID}-5`,
  regulationId: REG_ID,
  sectionRef: "164.312(b) / 164.530(j)",
  title: "AI-assisted clinical decision documentation",
  description:
    "When AI systems assist in clinical decisions involving ePHI, audit records must capture sufficient detail about the AI model, its inputs, outputs, and confidence to support accountability and patient safety reviews.",
  applicableSectors: ["healthcare"],
  applicableDecisionTypes: [
    "classification",
    "recommendation",
    "extraction",
    "summarization",
  ],
  applicableDataTypes: ["health", "personal"],
  applicableAuthorityLevels: ["autonomous", "human_in_the_loop", "human_on_the_loop"],
  minimumRiskLevel: null,
  requiredFields: [
    "modelId",
    "modelProvider",
    "inputHash",
    "outputHash",
    "decisionType",
    "confidenceScore",
  ],
  requiresReasoningCertificate: true,
  requiresProvenance: true,
};

const auditRetention: RegulatoryRequirement = {
  requirementId: `${REG_ID}-6`,
  regulationId: REG_ID,
  sectionRef: "164.312(b) / 164.530(j)(2)",
  title: "Audit record retention (6 years)",
  description:
    "Audit records related to ePHI must be retained for a minimum of six years from the date of creation or the date when it was last in effect, whichever is later.",
  applicableSectors: ["healthcare"],
  applicableDecisionTypes: [],
  applicableDataTypes: ["health"],
  applicableAuthorityLevels: [],
  minimumRiskLevel: null,
  requiredFields: ["timestamp", "complianceMetadata"],
  requiresReasoningCertificate: false,
  requiresProvenance: false,
};

export const HIPAA_AUDIT_REQUIREMENTS: ReadonlyArray<RegulatoryRequirement> = [
  auditControlMechanism,
  auditTrailIntegrity,
  auditUserIdentification,
  auditAccessTracking,
  auditAiDecisionRecord,
  auditRetention,
];

export const hipaaAudit: Regulation = {
  regulationId: REG_ID,
  name: "HIPAA Security Rule - Audit Controls",
  jurisdiction: "United States (Federal)",
  version: "2013-01-25",
  description:
    "HIPAA Security Rule Section 164.312(b) requires covered entities and business associates to implement audit controls: hardware, software, and procedural mechanisms that record and examine activity in information systems containing electronic protected health information (ePHI). This includes requirements for audit trail integrity, user identification, access tracking, and six-year retention.",
  requirements: HIPAA_AUDIT_REQUIREMENTS,
};
