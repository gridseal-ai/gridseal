import { describe, it, expect } from "vitest";
import { parsePolicy } from "../../src/compliance/authority/policy-parser.js";
import { enforcePolicy, enforcementToTags } from "../../src/compliance/authority/enforcement.js";
import type {
  AuthorityPolicy,
  ActionRequest,
  ActionRule,
} from "../../src/compliance/authority/types.js";

const VALID_POLICY_YAML = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify_document
    conditions:
      riskLevels:
        - minimal
        - limited
      sectors:
        - general
  - actionType: summarize_text
  - actionType: translate_content
    conditions:
      dataTypes:
        - public
        - anonymized
gated:
  - actionType: approve_loan
    conditions:
      riskLevels:
        - high
      sectors:
        - finance
  - actionType: medical_diagnosis
    conditions:
      sectors:
        - healthcare
      dataTypes:
        - health
        - sensitive
  - actionType: classify_document
    conditions:
      riskLevels:
        - high
        - unacceptable
escalated:
  - actionType: deny_benefits
    conditions:
      riskLevels:
        - high
        - unacceptable
      sectors:
        - government
        - insurance
  - actionType: criminal_risk_score
    conditions:
      sectors:
        - criminal_justice
  - actionType: approve_loan
    conditions:
      riskLevels:
        - unacceptable
`;

function makePolicy(overrides?: Partial<AuthorityPolicy>): AuthorityPolicy {
  return {
    version: "1.0",
    defaultDecision: "deny",
    autonomous: [
      { actionType: "classify_document", conditions: { riskLevels: ["minimal", "limited"], sectors: ["general"] } },
      { actionType: "summarize_text" },
    ],
    gated: [
      { actionType: "approve_loan", conditions: { riskLevels: ["high"], sectors: ["finance"] } },
    ],
    escalated: [
      { actionType: "deny_benefits", conditions: { riskLevels: ["high", "unacceptable"], sectors: ["government"] } },
    ],
    ...overrides,
  };
}

function makeRequest(overrides?: Partial<ActionRequest>): ActionRequest {
  return {
    actionType: "classify_document",
    sector: "general",
    riskLevel: "minimal",
    ...overrides,
  };
}

describe("parsePolicy", () => {
  it("parses a valid YAML policy with all categories", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.version).toBe("1.0");
    expect(result.value.defaultDecision).toBe("deny");
    expect(result.value.autonomous).toHaveLength(3);
    expect(result.value.gated).toHaveLength(3);
    expect(result.value.escalated).toHaveLength(3);
  });

  it("parses autonomous rules with conditions correctly", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const classifyRule = result.value.autonomous[0];
    expect(classifyRule).toBeDefined();
    expect(classifyRule?.actionType).toBe("classify_document");
    expect(classifyRule?.conditions?.riskLevels).toEqual(["minimal", "limited"]);
    expect(classifyRule?.conditions?.sectors).toEqual(["general"]);
  });

  it("parses rules without conditions", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const summarizeRule = result.value.autonomous[1];
    expect(summarizeRule).toBeDefined();
    expect(summarizeRule?.actionType).toBe("summarize_text");
    expect(summarizeRule?.conditions).toBeUndefined();
  });

  it("accepts a policy with empty rule categories", () => {
    const yaml = `
version: "1.0"
defaultDecision: allow
autonomous: []
gated: []
escalated: []
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.autonomous).toHaveLength(0);
    expect(result.value.gated).toHaveLength(0);
    expect(result.value.escalated).toHaveLength(0);
  });

  it("treats missing rule categories as empty arrays", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.autonomous).toHaveLength(0);
    expect(result.value.gated).toHaveLength(0);
    expect(result.value.escalated).toHaveLength(0);
  });

  it("rejects malformed YAML", () => {
    const result = parsePolicy("{{{{not yaml at all::::}}}");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("INVALID_YAML");
    expect(result.error.message).toContain("Failed to parse YAML");
  });

  it("rejects a non-object YAML document", () => {
    const result = parsePolicy("just a string");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.type).toBe("VALIDATION_ERROR");
    expect(result.error.message).toBe("Policy must be a YAML object");
  });

  it("rejects missing version field", () => {
    const yaml = `
defaultDecision: deny
autonomous: []
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("version");
  });

  it("rejects empty version string", () => {
    const yaml = `
version: ""
defaultDecision: deny
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("version");
  });

  it("rejects invalid defaultDecision value", () => {
    const yaml = `
version: "1.0"
defaultDecision: invalid_decision
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("defaultDecision");
  });

  it("rejects missing defaultDecision", () => {
    const yaml = `
version: "1.0"
autonomous: []
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("defaultDecision");
  });

  it("rejects a rule without actionType", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - conditions:
      sectors:
        - general
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("actionType");
  });

  it("rejects a rule with empty actionType", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
gated:
  - actionType: ""
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("actionType");
  });

  it("rejects invalid sector in conditions", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions:
      sectors:
        - made_up_sector
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("invalid sector");
    expect(result.error.message).toContain("made_up_sector");
  });

  it("rejects invalid riskLevel in conditions", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions:
      riskLevels:
        - extreme
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("invalid risk level");
  });

  it("rejects invalid dataType in conditions", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
gated:
  - actionType: process
    conditions:
      dataTypes:
        - secret_data
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("invalid data type");
  });

  it("rejects minConfidenceScore out of range", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions:
      minConfidenceScore: 1.5
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("minConfidenceScore");
  });

  it("rejects negative maxConfidenceScore", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions:
      maxConfidenceScore: -0.1
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("maxConfidenceScore");
  });

  it("rejects non-numeric minConfidenceScore", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions:
      minConfidenceScore: "high"
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("minConfidenceScore");
  });

  it("rejects non-array sectors in conditions", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions:
      sectors: general
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("sectors: must be an array");
  });

  it("rejects non-object conditions", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions: "not an object"
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("conditions must be an object");
  });

  it("rejects non-array rule list", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous: "not an array"
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("must be an array");
  });

  it("rejects non-object rule in list", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
gated:
  - "just a string"
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("must be an object");
  });

  it("parses all four defaultDecision values", () => {
    for (const decision of ["allow", "gate", "escalate", "deny"]) {
      const yaml = `
version: "1.0"
defaultDecision: ${decision}
`;
      const result = parsePolicy(yaml);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.defaultDecision).toBe(decision);
    }
  });

  it("parses confidence score conditions", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: low_confidence_review
    conditions:
      minConfidenceScore: 0.3
      maxConfidenceScore: 0.7
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const rule = result.value.autonomous[0];
    expect(rule?.conditions?.minConfidenceScore).toBe(0.3);
    expect(rule?.conditions?.maxConfidenceScore).toBe(0.7);
  });

  it("rejects non-array riskLevels in conditions", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions:
      riskLevels: high
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("riskLevels: must be an array");
  });

  it("rejects non-array dataTypes in conditions", () => {
    const yaml = `
version: "1.0"
defaultDecision: deny
autonomous:
  - actionType: classify
    conditions:
      dataTypes: personal
`;
    const result = parsePolicy(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("dataTypes: must be an array");
  });
});

describe("enforcePolicy", () => {
  describe("autonomous actions", () => {
    it("allows an action matching an autonomous rule with matching conditions", () => {
      const policy = makePolicy();
      const request = makeRequest();
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("allow");
      expect(result.category).toBe("autonomous");
      expect(result.matchedRule).not.toBeNull();
      expect(result.matchedRule?.actionType).toBe("classify_document");
    });

    it("allows an action matching an autonomous rule without conditions", () => {
      const policy = makePolicy();
      const request = makeRequest({ actionType: "summarize_text" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("allow");
      expect(result.category).toBe("autonomous");
    });

    it("does not match autonomous rule when sector condition fails", () => {
      const policy = makePolicy();
      const request = makeRequest({ sector: "healthcare" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
      expect(result.category).toBe("default");
    });

    it("does not match autonomous rule when riskLevel condition fails", () => {
      const policy = makePolicy();
      const request = makeRequest({ riskLevel: "high" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
      expect(result.category).toBe("default");
    });
  });

  describe("gated actions", () => {
    it("gates an action matching a gated rule", () => {
      const policy = makePolicy();
      const request = makeRequest({ actionType: "approve_loan", sector: "finance", riskLevel: "high" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("gate");
      expect(result.category).toBe("gated");
      expect(result.matchedRule?.actionType).toBe("approve_loan");
    });

    it("does not gate when conditions do not match", () => {
      const policy = makePolicy();
      const request = makeRequest({ actionType: "approve_loan", sector: "healthcare", riskLevel: "high" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
      expect(result.category).toBe("default");
    });
  });

  describe("escalated actions", () => {
    it("escalates an action matching an escalated rule", () => {
      const policy = makePolicy();
      const request = makeRequest({ actionType: "deny_benefits", sector: "government", riskLevel: "high" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("escalate");
      expect(result.category).toBe("escalated");
    });

    it("does not escalate when sector condition fails", () => {
      const policy = makePolicy();
      const request = makeRequest({ actionType: "deny_benefits", sector: "finance", riskLevel: "high" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
      expect(result.category).toBe("default");
    });
  });

  describe("priority ordering", () => {
    it("escalated rules take priority over gated rules for the same action", () => {
      const policy = makePolicy({
        gated: [{ actionType: "review_case", conditions: { sectors: ["government"] } }],
        escalated: [{ actionType: "review_case", conditions: { sectors: ["government"], riskLevels: ["high"] } }],
      });
      const request = makeRequest({ actionType: "review_case", sector: "government", riskLevel: "high" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("escalate");
      expect(result.category).toBe("escalated");
    });

    it("gated rules take priority over autonomous rules for the same action", () => {
      const policy = makePolicy({
        autonomous: [{ actionType: "assess_risk" }],
        gated: [{ actionType: "assess_risk", conditions: { riskLevels: ["high"] } }],
      });
      const request = makeRequest({ actionType: "assess_risk", riskLevel: "high" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("gate");
      expect(result.category).toBe("gated");
    });

    it("escalated takes priority over autonomous", () => {
      const policy = makePolicy({
        autonomous: [{ actionType: "score_applicant" }],
        escalated: [{ actionType: "score_applicant", conditions: { sectors: ["criminal_justice"] } }],
      });
      const request = makeRequest({ actionType: "score_applicant", sector: "criminal_justice" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("escalate");
      expect(result.category).toBe("escalated");
    });

    it("falls through to autonomous when escalated and gated conditions do not match", () => {
      const policy = makePolicy({
        autonomous: [{ actionType: "assess_risk" }],
        gated: [{ actionType: "assess_risk", conditions: { riskLevels: ["high"] } }],
        escalated: [{ actionType: "assess_risk", conditions: { riskLevels: ["unacceptable"] } }],
      });
      const request = makeRequest({ actionType: "assess_risk", riskLevel: "minimal" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("allow");
      expect(result.category).toBe("autonomous");
    });
  });

  describe("default decision", () => {
    it("applies default deny when no rules match", () => {
      const policy = makePolicy({ defaultDecision: "deny" });
      const request = makeRequest({ actionType: "unknown_action" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
      expect(result.category).toBe("default");
      expect(result.matchedRule).toBeNull();
      expect(result.reason).toContain("unknown_action");
      expect(result.reason).toContain("deny");
    });

    it("applies default allow when configured and no rules match", () => {
      const policy = makePolicy({ defaultDecision: "allow" });
      const request = makeRequest({ actionType: "unknown_action" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("allow");
      expect(result.category).toBe("default");
    });

    it("applies default gate when configured and no rules match", () => {
      const policy = makePolicy({ defaultDecision: "gate" });
      const request = makeRequest({ actionType: "unknown_action" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("gate");
    });

    it("applies default escalate when configured and no rules match", () => {
      const policy = makePolicy({ defaultDecision: "escalate" });
      const request = makeRequest({ actionType: "unknown_action" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("escalate");
    });
  });

  describe("confidence score conditions", () => {
    it("allows action when confidence score is within range", () => {
      const policy = makePolicy({
        autonomous: [{
          actionType: "auto_classify",
          conditions: { minConfidenceScore: 0.8, maxConfidenceScore: 1.0 },
        }],
      });
      const request = makeRequest({ actionType: "auto_classify", confidenceScore: 0.9 });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("allow");
      expect(result.category).toBe("autonomous");
    });

    it("does not match when confidence score is below minimum", () => {
      const policy = makePolicy({
        autonomous: [{
          actionType: "auto_classify",
          conditions: { minConfidenceScore: 0.8 },
        }],
      });
      const request = makeRequest({ actionType: "auto_classify", confidenceScore: 0.5 });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
      expect(result.category).toBe("default");
    });

    it("does not match when confidence score is above maximum", () => {
      const policy = makePolicy({
        autonomous: [{
          actionType: "auto_classify",
          conditions: { maxConfidenceScore: 0.5 },
        }],
      });
      const request = makeRequest({ actionType: "auto_classify", confidenceScore: 0.7 });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
    });

    it("does not match when confidence score is required but not provided", () => {
      const policy = makePolicy({
        autonomous: [{
          actionType: "auto_classify",
          conditions: { minConfidenceScore: 0.5 },
        }],
      });
      const request = makeRequest({ actionType: "auto_classify" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
    });

    it("matches exact boundary confidence scores", () => {
      const policy = makePolicy({
        autonomous: [{
          actionType: "auto_classify",
          conditions: { minConfidenceScore: 0.5, maxConfidenceScore: 0.8 },
        }],
      });
      const requestMin = makeRequest({ actionType: "auto_classify", confidenceScore: 0.5 });
      expect(enforcePolicy(policy, requestMin).decision).toBe("allow");

      const requestMax = makeRequest({ actionType: "auto_classify", confidenceScore: 0.8 });
      expect(enforcePolicy(policy, requestMax).decision).toBe("allow");
    });
  });

  describe("data type conditions", () => {
    it("matches when data type is in the allowed list", () => {
      const policy = makePolicy({
        gated: [{
          actionType: "process_data",
          conditions: { dataTypes: ["health", "sensitive"] },
        }],
      });
      const request = makeRequest({ actionType: "process_data", dataType: "health" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("gate");
    });

    it("does not match when data type is not in the list", () => {
      const policy = makePolicy({
        gated: [{
          actionType: "process_data",
          conditions: { dataTypes: ["health"] },
        }],
      });
      const request = makeRequest({ actionType: "process_data", dataType: "public" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
    });

    it("does not match when data type condition exists but request has no data type", () => {
      const policy = makePolicy({
        gated: [{
          actionType: "process_data",
          conditions: { dataTypes: ["health"] },
        }],
      });
      const request = makeRequest({ actionType: "process_data" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
    });
  });

  describe("edge cases", () => {
    it("handles empty policy (no rules at all)", () => {
      const policy = makePolicy({
        autonomous: [],
        gated: [],
        escalated: [],
        defaultDecision: "deny",
      });
      const request = makeRequest();
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("deny");
      expect(result.category).toBe("default");
    });

    it("handles request with no optional fields", () => {
      const policy = makePolicy({
        autonomous: [{ actionType: "simple_action" }],
      });
      const request: ActionRequest = { actionType: "simple_action" };
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("allow");
    });

    it("matches first rule in category when multiple rules match", () => {
      const policy = makePolicy({
        autonomous: [
          { actionType: "classify", conditions: { sectors: ["general"] } },
          { actionType: "classify", conditions: { sectors: ["general", "finance"] } },
        ],
      });
      const request = makeRequest({ actionType: "classify", sector: "general" });
      const result = enforcePolicy(policy, request);
      expect(result.decision).toBe("allow");
      expect(result.matchedRule?.conditions?.sectors).toEqual(["general"]);
    });

    it("produces a valid ISO timestamp", () => {
      const policy = makePolicy();
      const request = makeRequest();
      const result = enforcePolicy(policy, request);
      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("includes action type in reason for default decisions", () => {
      const policy = makePolicy();
      const request = makeRequest({ actionType: "rare_action_xyz" });
      const result = enforcePolicy(policy, request);
      expect(result.reason).toContain("rare_action_xyz");
    });
  });
});

describe("enforcementToTags", () => {
  it("converts an enforcement result to a tags record", () => {
    const policy = makePolicy();
    const request = makeRequest();
    const result = enforcePolicy(policy, request);
    const tags = enforcementToTags(result);

    expect(tags["authority.decision"]).toBe("allow");
    expect(tags["authority.category"]).toBe("autonomous");
    expect(tags["authority.reason"]).toContain("classify_document");
    expect(tags["authority.timestamp"]).toBeDefined();
    expect(tags["authority.matchedAction"]).toBe("classify_document");
  });

  it("omits matchedAction tag when no rule matched", () => {
    const policy = makePolicy();
    const request = makeRequest({ actionType: "unknown" });
    const result = enforcePolicy(policy, request);
    const tags = enforcementToTags(result);

    expect(tags["authority.decision"]).toBe("deny");
    expect(tags["authority.category"]).toBe("default");
    expect(tags["authority.matchedAction"]).toBeUndefined();
  });

  it("includes gate category for gated actions", () => {
    const policy = makePolicy();
    const request = makeRequest({ actionType: "approve_loan", sector: "finance", riskLevel: "high" });
    const result = enforcePolicy(policy, request);
    const tags = enforcementToTags(result);

    expect(tags["authority.decision"]).toBe("gate");
    expect(tags["authority.category"]).toBe("gated");
    expect(tags["authority.matchedAction"]).toBe("approve_loan");
  });

  it("includes escalate category for escalated actions", () => {
    const policy = makePolicy();
    const request = makeRequest({ actionType: "deny_benefits", sector: "government", riskLevel: "high" });
    const result = enforcePolicy(policy, request);
    const tags = enforcementToTags(result);

    expect(tags["authority.decision"]).toBe("escalate");
    expect(tags["authority.category"]).toBe("escalated");
  });
});

describe("parsePolicy + enforcePolicy integration", () => {
  it("parses YAML and enforces an autonomous action end-to-end", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const enforcement = enforcePolicy(result.value, {
      actionType: "classify_document",
      sector: "general",
      riskLevel: "minimal",
    });
    expect(enforcement.decision).toBe("allow");
    expect(enforcement.category).toBe("autonomous");
  });

  it("parses YAML and escalates a high-risk government action", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const enforcement = enforcePolicy(result.value, {
      actionType: "deny_benefits",
      sector: "government",
      riskLevel: "unacceptable",
    });
    expect(enforcement.decision).toBe("escalate");
    expect(enforcement.category).toBe("escalated");
  });

  it("parses YAML and gates a healthcare diagnosis", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const enforcement = enforcePolicy(result.value, {
      actionType: "medical_diagnosis",
      sector: "healthcare",
      dataType: "health",
    });
    expect(enforcement.decision).toBe("gate");
    expect(enforcement.category).toBe("gated");
  });

  it("parses YAML and denies an unknown action type", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const enforcement = enforcePolicy(result.value, {
      actionType: "completely_unknown",
    });
    expect(enforcement.decision).toBe("deny");
    expect(enforcement.category).toBe("default");
  });

  it("escalated rule for approve_loan overrides gated rule when risk is unacceptable", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const enforcement = enforcePolicy(result.value, {
      actionType: "approve_loan",
      sector: "finance",
      riskLevel: "unacceptable",
    });
    expect(enforcement.decision).toBe("escalate");
    expect(enforcement.category).toBe("escalated");
  });

  it("classify_document is gated at high risk but autonomous at minimal risk", () => {
    const result = parsePolicy(VALID_POLICY_YAML);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const highRisk = enforcePolicy(result.value, {
      actionType: "classify_document",
      sector: "general",
      riskLevel: "high",
    });
    expect(highRisk.decision).toBe("gate");
    expect(highRisk.category).toBe("gated");

    const minimalRisk = enforcePolicy(result.value, {
      actionType: "classify_document",
      sector: "general",
      riskLevel: "minimal",
    });
    expect(minimalRisk.decision).toBe("allow");
    expect(minimalRisk.category).toBe("autonomous");
  });
});
