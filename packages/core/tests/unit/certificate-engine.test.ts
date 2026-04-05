import { describe, it, expect } from "vitest";
import {
  confidenceLevelFromScore,
  validateAgainstTemplate,
  generateCertificate,
  generateCertificateWithTemplate,
  getTemplateNames,
  getTemplate,
  CLASSIFICATION_TEMPLATE,
  RECOMMENDATION_TEMPLATE,
  APPROVAL_DENIAL_TEMPLATE,
  RISK_SCORING_TEMPLATE,
  CERTIFICATE_TEMPLATES,
} from "../../src/certificate/engine.js";
import { verifyCertificate } from "../../src/certificate/reasoning-certificate.js";
import type {
  DecisionContext,
  Premise,
  TraceStep,
  Conclusion,
  CertificateTemplate,
} from "../../src/certificate/engine.js";
import type { UnsupportedClaim, Assumption, Limitation } from "../../src/certificate/reasoning-certificate.js";

function makePremise(overrides?: Partial<Premise>): Premise {
  return {
    id: "input_data_01",
    statement: "Input features have been extracted and normalized.",
    source: "input_data",
    required: true,
    ...overrides,
  };
}

function makeTraceStep(overrides?: Partial<TraceStep>): TraceStep {
  return {
    stepId: "feature_analysis_01",
    description: "Analyzed feature vector against known category centroids.",
    inputRefs: ["input_data_01"],
    outputRef: "category_scores",
    ...overrides,
  };
}

function makeConclusion(overrides?: Partial<Conclusion>): Conclusion {
  return {
    statement: "Input classified as category A with high confidence.",
    supportingPremiseIds: ["input_data_01"],
    supportingTraceStepIds: ["feature_analysis_01"],
    ...overrides,
  };
}

function makeUnsupported(overrides?: Partial<UnsupportedClaim>): UnsupportedClaim {
  return {
    statement: "Input may also belong to category B.",
    reason: "Similarity to category B was below threshold.",
    ...overrides,
  };
}

function makeAssumption(overrides?: Partial<Assumption>): Assumption {
  return {
    statement: "Input data has been preprocessed correctly.",
    criticality: "medium",
    ...overrides,
  };
}

function makeLimitation(overrides?: Partial<Limitation>): Limitation {
  return {
    description: "Model has not been evaluated on out-of-distribution data.",
    impact: "Classification may be unreliable for novel inputs.",
    ...overrides,
  };
}

function makeClassificationContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    certificateId: "cert-019505f0-0000-7000-8000-000000000001",
    timestamp: "2026-04-05T10:00:00.000Z",
    modelId: "classifier-v2",
    modelProvider: "openai",
    decisionType: "classification",
    premises: [
      makePremise({ id: "input_data_01", source: "input_data" }),
      makePremise({ id: "classification_criteria_01", statement: "Category A threshold is 0.8.", source: "classification_criteria", required: true }),
    ],
    executionTrace: [
      makeTraceStep({ stepId: "feature_analysis_01", description: "Computed similarity to category A: 0.95." }),
      makeTraceStep({ stepId: "category_assignment_01", description: "Assigned to category A (0.95 > 0.8 threshold).", inputRefs: ["feature_analysis_01"], outputRef: "final_category" }),
    ],
    conclusion: makeConclusion({
      supportingPremiseIds: ["input_data_01", "classification_criteria_01"],
      supportingTraceStepIds: ["feature_analysis_01", "category_assignment_01"],
    }),
    unsupportedClaims: [makeUnsupported()],
    assumptions: [makeAssumption()],
    limitations: [makeLimitation()],
    confidenceScore: 0.92,
    ...overrides,
  };
}

function makeRecommendationContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    certificateId: "cert-019505f0-0000-7000-8000-000000000002",
    timestamp: "2026-04-05T10:00:00.000Z",
    modelId: "recommender-v3",
    modelProvider: "anthropic",
    decisionType: "recommendation",
    premises: [
      makePremise({ id: "user_context_01", statement: "User prefers category A products.", source: "user_context" }),
      makePremise({ id: "available_options_01", statement: "3 products available in category A.", source: "available_options" }),
      makePremise({ id: "ranking_criteria_01", statement: "Rank by relevance score.", source: "ranking_criteria" }),
    ],
    executionTrace: [
      makeTraceStep({ stepId: "option_evaluation_01", description: "Scored all 3 products against user preferences." }),
      makeTraceStep({ stepId: "ranking_01", description: "Ranked products: P1 (0.95), P2 (0.82), P3 (0.71).", inputRefs: ["option_evaluation_01"], outputRef: "ranked_list" }),
    ],
    conclusion: {
      statement: "Recommend product P1 as the top match.",
      supportingPremiseIds: ["user_context_01", "available_options_01", "ranking_criteria_01"],
      supportingTraceStepIds: ["option_evaluation_01", "ranking_01"],
    },
    unsupportedClaims: [],
    assumptions: [makeAssumption({ statement: "User preferences are current.", criticality: "low" })],
    limitations: [],
    confidenceScore: 0.88,
    ...overrides,
  };
}

function makeApprovalContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    certificateId: "cert-019505f0-0000-7000-8000-000000000003",
    timestamp: "2026-04-05T10:00:00.000Z",
    modelId: "approval-model-v1",
    modelProvider: "openai",
    decisionType: "classification",
    premises: [
      makePremise({ id: "applicant_data_01", statement: "Applicant credit score: 720.", source: "applicant_data" }),
      makePremise({ id: "eligibility_criteria_01", statement: "Minimum credit score: 650.", source: "eligibility_criteria" }),
      makePremise({ id: "threshold_values_01", statement: "Auto-approve above 700.", source: "threshold_values" }),
    ],
    executionTrace: [
      makeTraceStep({ stepId: "criteria_evaluation_01", description: "Evaluated applicant against all eligibility criteria." }),
      makeTraceStep({ stepId: "threshold_comparison_01", description: "Credit score 720 exceeds threshold 700.", inputRefs: ["criteria_evaluation_01"], outputRef: "threshold_result" }),
      makeTraceStep({ stepId: "decision_determination_01", description: "Decision: APPROVED.", inputRefs: ["threshold_comparison_01"], outputRef: "final_decision" }),
    ],
    conclusion: {
      statement: "Application approved: all criteria met and score above auto-approve threshold.",
      supportingPremiseIds: ["applicant_data_01", "eligibility_criteria_01", "threshold_values_01"],
      supportingTraceStepIds: ["criteria_evaluation_01", "threshold_comparison_01", "decision_determination_01"],
    },
    unsupportedClaims: [],
    assumptions: [],
    limitations: [],
    confidenceScore: 0.97,
    ...overrides,
  };
}

function makeRiskScoringContext(overrides?: Partial<DecisionContext>): DecisionContext {
  return {
    certificateId: "cert-019505f0-0000-7000-8000-000000000004",
    timestamp: "2026-04-05T10:00:00.000Z",
    modelId: "risk-scorer-v2",
    modelProvider: "openai",
    decisionType: "classification",
    premises: [
      makePremise({ id: "subject_data_01", statement: "Transaction amount: $5,000.", source: "subject_data" }),
      makePremise({ id: "risk_factors_01", statement: "Transaction from new device and unusual location.", source: "risk_factors" }),
      makePremise({ id: "scoring_model_01", statement: "Using fraud detection model v2.", source: "scoring_model" }),
    ],
    executionTrace: [
      makeTraceStep({ stepId: "factor_analysis_01", description: "Analyzed 3 risk factors: device (new), location (unusual), amount (elevated)." }),
      makeTraceStep({ stepId: "score_computation_01", description: "Computed weighted risk score: 0.78.", inputRefs: ["factor_analysis_01"], outputRef: "raw_score" }),
      makeTraceStep({ stepId: "risk_level_assignment_01", description: "Risk level: HIGH (score > 0.7).", inputRefs: ["score_computation_01"], outputRef: "risk_level" }),
    ],
    conclusion: {
      statement: "Transaction flagged as high risk (score: 0.78) due to device and location anomalies.",
      supportingPremiseIds: ["subject_data_01", "risk_factors_01", "scoring_model_01"],
      supportingTraceStepIds: ["factor_analysis_01", "score_computation_01", "risk_level_assignment_01"],
    },
    unsupportedClaims: [{ statement: "Transaction may be legitimate travel.", reason: "No travel history available." }],
    assumptions: [{ statement: "Device fingerprinting is accurate.", criticality: "high" }],
    limitations: [{ description: "Model trained on US transactions only.", impact: "May over-flag international travel." }],
    confidenceScore: 0.75,
    ...overrides,
  };
}

describe("confidenceLevelFromScore", () => {
  it("maps scores in [0, 0.2) to very_low", () => {
    expect(confidenceLevelFromScore(0)).toBe("very_low");
    expect(confidenceLevelFromScore(0.1)).toBe("very_low");
    expect(confidenceLevelFromScore(0.19)).toBe("very_low");
  });

  it("maps scores in [0.2, 0.4) to low", () => {
    expect(confidenceLevelFromScore(0.2)).toBe("low");
    expect(confidenceLevelFromScore(0.3)).toBe("low");
    expect(confidenceLevelFromScore(0.39)).toBe("low");
  });

  it("maps scores in [0.4, 0.6) to medium", () => {
    expect(confidenceLevelFromScore(0.4)).toBe("medium");
    expect(confidenceLevelFromScore(0.5)).toBe("medium");
    expect(confidenceLevelFromScore(0.59)).toBe("medium");
  });

  it("maps scores in [0.6, 0.8) to high", () => {
    expect(confidenceLevelFromScore(0.6)).toBe("high");
    expect(confidenceLevelFromScore(0.7)).toBe("high");
    expect(confidenceLevelFromScore(0.79)).toBe("high");
  });

  it("maps scores in [0.8, 1.0] to very_high", () => {
    expect(confidenceLevelFromScore(0.8)).toBe("very_high");
    expect(confidenceLevelFromScore(0.9)).toBe("very_high");
    expect(confidenceLevelFromScore(1.0)).toBe("very_high");
  });

  it("throws for scores below 0", () => {
    expect(() => confidenceLevelFromScore(-0.1)).toThrow("Confidence score must be in [0, 1]");
  });

  it("throws for scores above 1", () => {
    expect(() => confidenceLevelFromScore(1.1)).toThrow("Confidence score must be in [0, 1]");
  });
});

describe("CertificateTemplates", () => {
  it("provides four built-in templates", () => {
    expect(getTemplateNames()).toEqual(["classification", "recommendation", "approval_denial", "risk_scoring"]);
  });

  it("retrieves templates by name", () => {
    expect(getTemplate("classification")).toBe(CLASSIFICATION_TEMPLATE);
    expect(getTemplate("recommendation")).toBe(RECOMMENDATION_TEMPLATE);
    expect(getTemplate("approval_denial")).toBe(APPROVAL_DENIAL_TEMPLATE);
    expect(getTemplate("risk_scoring")).toBe(RISK_SCORING_TEMPLATE);
  });

  it("returns null for unknown template names", () => {
    expect(getTemplate("nonexistent")).toBeNull();
  });

  it("classification template requires input_data and classification_criteria premises", () => {
    expect(CLASSIFICATION_TEMPLATE.requiredPremiseCategories).toEqual(["input_data", "classification_criteria"]);
    expect(CLASSIFICATION_TEMPLATE.requiredTraceCategories).toEqual(["feature_analysis", "category_assignment"]);
    expect(CLASSIFICATION_TEMPLATE.minimumPremises).toBe(2);
    expect(CLASSIFICATION_TEMPLATE.minimumTraceSteps).toBe(2);
  });

  it("recommendation template requires user_context, available_options, and ranking_criteria premises", () => {
    expect(RECOMMENDATION_TEMPLATE.requiredPremiseCategories).toEqual(["user_context", "available_options", "ranking_criteria"]);
    expect(RECOMMENDATION_TEMPLATE.requiredTraceCategories).toEqual(["option_evaluation", "ranking"]);
    expect(RECOMMENDATION_TEMPLATE.minimumPremises).toBe(3);
    expect(RECOMMENDATION_TEMPLATE.minimumTraceSteps).toBe(2);
  });

  it("approval/denial template requires applicant_data, eligibility_criteria, and threshold_values premises", () => {
    expect(APPROVAL_DENIAL_TEMPLATE.requiredPremiseCategories).toEqual(["applicant_data", "eligibility_criteria", "threshold_values"]);
    expect(APPROVAL_DENIAL_TEMPLATE.requiredTraceCategories).toEqual(["criteria_evaluation", "threshold_comparison", "decision_determination"]);
    expect(APPROVAL_DENIAL_TEMPLATE.minimumPremises).toBe(3);
    expect(APPROVAL_DENIAL_TEMPLATE.minimumTraceSteps).toBe(3);
    expect(APPROVAL_DENIAL_TEMPLATE.requiresConfidenceAbove).toBe(0.5);
  });

  it("risk scoring template requires subject_data, risk_factors, and scoring_model premises", () => {
    expect(RISK_SCORING_TEMPLATE.requiredPremiseCategories).toEqual(["subject_data", "risk_factors", "scoring_model"]);
    expect(RISK_SCORING_TEMPLATE.requiredTraceCategories).toEqual(["factor_analysis", "score_computation", "risk_level_assignment"]);
    expect(RISK_SCORING_TEMPLATE.minimumPremises).toBe(3);
    expect(RISK_SCORING_TEMPLATE.minimumTraceSteps).toBe(3);
    expect(RISK_SCORING_TEMPLATE.requiresConfidenceAbove).toBe(0.3);
  });
});

describe("validateAgainstTemplate", () => {
  it("validates a classification context against the classification template", () => {
    const context = makeClassificationContext();
    const result = validateAgainstTemplate(context, CLASSIFICATION_TEMPLATE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.missingPremiseCategories).toEqual([]);
    expect(result.missingTraceCategories).toEqual([]);
  });

  it("validates a recommendation context against the recommendation template", () => {
    const context = makeRecommendationContext();
    const result = validateAgainstTemplate(context, RECOMMENDATION_TEMPLATE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("validates an approval context against the approval/denial template", () => {
    const context = makeApprovalContext();
    const result = validateAgainstTemplate(context, APPROVAL_DENIAL_TEMPLATE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("validates a risk scoring context against the risk scoring template", () => {
    const context = makeRiskScoringContext();
    const result = validateAgainstTemplate(context, RISK_SCORING_TEMPLATE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports missing premise categories when premises lack required sources", () => {
    const context = makeClassificationContext({
      premises: [makePremise({ id: "unrelated_01", source: "unrelated" })],
    });
    const result = validateAgainstTemplate(context, CLASSIFICATION_TEMPLATE);
    expect(result.valid).toBe(false);
    expect(result.missingPremiseCategories).toContain("input_data");
    expect(result.missingPremiseCategories).toContain("classification_criteria");
  });

  it("reports missing trace categories when trace steps lack required IDs", () => {
    const context = makeClassificationContext({
      executionTrace: [makeTraceStep({ stepId: "unrelated_step" })],
    });
    const result = validateAgainstTemplate(context, CLASSIFICATION_TEMPLATE);
    expect(result.valid).toBe(false);
    expect(result.missingTraceCategories).toContain("category_assignment");
  });

  it("reports error when premise count is below minimum", () => {
    const context = makeRecommendationContext({
      premises: [makePremise({ id: "user_context_01", source: "user_context" })],
    });
    const result = validateAgainstTemplate(context, RECOMMENDATION_TEMPLATE);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least 3 premises"))).toBe(true);
  });

  it("reports error when trace step count is below minimum", () => {
    const context = makeApprovalContext({
      executionTrace: [makeTraceStep({ stepId: "criteria_evaluation_01" })],
    });
    const result = validateAgainstTemplate(context, APPROVAL_DENIAL_TEMPLATE);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at least 3 trace steps"))).toBe(true);
  });

  it("reports error when confidence is below template threshold", () => {
    const context = makeApprovalContext({ confidenceScore: 0.3 });
    const result = validateAgainstTemplate(context, APPROVAL_DENIAL_TEMPLATE);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("confidence above 0.5"))).toBe(true);
  });

  it("matches premise categories by ID prefix when source is null", () => {
    const context = makeClassificationContext({
      premises: [
        makePremise({ id: "input_data_01", source: null }),
        makePremise({ id: "classification_criteria_01", source: null }),
      ],
    });
    const result = validateAgainstTemplate(context, CLASSIFICATION_TEMPLATE);
    expect(result.valid).toBe(true);
  });

  it("collects multiple errors when multiple requirements are violated", () => {
    const context = makeApprovalContext({
      premises: [makePremise({ id: "x", source: "x" })],
      executionTrace: [makeTraceStep({ stepId: "x" })],
      confidenceScore: 0.1,
    });
    const result = validateAgainstTemplate(context, APPROVAL_DENIAL_TEMPLATE);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("generateCertificate", () => {
  it("produces a valid reasoning certificate from a classification context", () => {
    const context = makeClassificationContext();
    const cert = generateCertificate(context);

    expect(cert.certificateId).toBe(context.certificateId);
    expect(cert.timestamp).toBe(context.timestamp);
    expect(cert.modelId).toBe(context.modelId);
    expect(cert.modelProvider).toBe(context.modelProvider);
    expect(cert.certificateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("converts each premise into a claim and evidence pair", () => {
    const context = makeClassificationContext();
    const cert = generateCertificate(context);

    // 2 premises + 1 conclusion = 3 claims
    expect(cert.claims.length).toBe(3);
    // 2 premise evidence + 2 trace evidence = 4
    expect(cert.supportingEvidence.length).toBe(4);
  });

  it("creates premise evidence with type 'premise' and preserves source", () => {
    const context = makeClassificationContext();
    const cert = generateCertificate(context);

    const premiseEvidence = cert.supportingEvidence.filter((e) => e.evidenceType === "premise");
    expect(premiseEvidence.length).toBe(2);
    expect(premiseEvidence[0].source).toBe("input_data");
  });

  it("creates trace evidence with type 'execution_trace'", () => {
    const context = makeClassificationContext();
    const cert = generateCertificate(context);

    const traceEvidence = cert.supportingEvidence.filter((e) => e.evidenceType === "execution_trace");
    expect(traceEvidence.length).toBe(2);
  });

  it("links conclusion claim to both premise and trace evidence", () => {
    const context = makeClassificationContext();
    const cert = generateCertificate(context);

    const conclusionClaim = cert.claims.find((c) => c.claimId === "claim-conclusion");
    expect(conclusionClaim).toBeDefined();
    // Should reference premise evidence (ev-input_data_01, ev-classification_criteria_01)
    // and trace evidence (ev-trace-feature_analysis_01, ev-trace-category_assignment_01)
    expect(conclusionClaim?.supportingEvidenceIds.length).toBe(4);
    expect(conclusionClaim?.supportingEvidenceIds).toContain("ev-input_data_01");
    expect(conclusionClaim?.supportingEvidenceIds).toContain("ev-trace-feature_analysis_01");
  });

  it("passes through unsupported claims, assumptions, and limitations", () => {
    const context = makeClassificationContext();
    const cert = generateCertificate(context);

    expect(cert.unsupportedClaims).toEqual(context.unsupportedClaims);
    expect(cert.assumptions).toEqual(context.assumptions);
    expect(cert.limitations).toEqual(context.limitations);
  });

  it("derives confidence level from score", () => {
    const context = makeClassificationContext({ confidenceScore: 0.92 });
    const cert = generateCertificate(context);

    expect(cert.confidenceAssessment.level).toBe("very_high");
    expect(cert.confidenceAssessment.score).toBe(0.92);
  });

  it("handles empty unsupported claims, assumptions, and limitations", () => {
    const context = makeClassificationContext({
      unsupportedClaims: [],
      assumptions: [],
      limitations: [],
    });
    const cert = generateCertificate(context);

    expect(cert.unsupportedClaims).toEqual([]);
    expect(cert.assumptions).toEqual([]);
    expect(cert.limitations).toEqual([]);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("produces a tamper-evident certificate (changing any field invalidates hash)", () => {
    const context = makeClassificationContext();
    const cert = generateCertificate(context);

    const tampered = { ...cert, modelId: "tampered-model" };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("produces different hashes for different contexts", () => {
    const cert1 = generateCertificate(makeClassificationContext());
    const cert2 = generateCertificate(makeRecommendationContext());

    expect(cert1.certificateHash).not.toBe(cert2.certificateHash);
  });

  it("produces deterministic output for the same input", () => {
    const context = makeClassificationContext();
    const cert1 = generateCertificate(context);
    const cert2 = generateCertificate(context);

    expect(cert1.certificateHash).toBe(cert2.certificateHash);
  });

  it("handles context with many premises and trace steps", () => {
    const premises: Array<Premise> = [];
    const traceSteps: Array<TraceStep> = [];
    for (let i = 0; i < 20; i++) {
      premises.push(makePremise({ id: `input_data_${i}`, statement: `Premise ${i}`, source: "input_data" }));
      traceSteps.push(makeTraceStep({ stepId: `feature_analysis_${i}`, description: `Step ${i}` }));
    }

    const context = makeClassificationContext({ premises, executionTrace: traceSteps });
    const cert = generateCertificate(context);

    // 20 premises + 1 conclusion = 21 claims
    expect(cert.claims.length).toBe(21);
    // 20 premise evidence + 20 trace evidence = 40
    expect(cert.supportingEvidence.length).toBe(40);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("generates a valid recommendation certificate", () => {
    const context = makeRecommendationContext();
    const cert = generateCertificate(context);

    expect(cert.modelProvider).toBe("anthropic");
    expect(cert.claims.length).toBe(4); // 3 premises + 1 conclusion
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("generates a valid approval/denial certificate", () => {
    const context = makeApprovalContext();
    const cert = generateCertificate(context);

    expect(cert.claims.length).toBe(4); // 3 premises + 1 conclusion
    expect(cert.supportingEvidence.length).toBe(6); // 3 premise + 3 trace
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("generates a valid risk scoring certificate", () => {
    const context = makeRiskScoringContext();
    const cert = generateCertificate(context);

    expect(cert.claims.length).toBe(4); // 3 premises + 1 conclusion
    expect(cert.unsupportedClaims.length).toBe(1);
    expect(cert.assumptions.length).toBe(1);
    expect(cert.limitations.length).toBe(1);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("includes confidence rationale with decision type and counts", () => {
    const context = makeClassificationContext();
    const cert = generateCertificate(context);

    expect(cert.confidenceAssessment.rationale).toContain("2 premises");
    expect(cert.confidenceAssessment.rationale).toContain("2 trace steps");
    expect(cert.confidenceAssessment.rationale).toContain("classification");
  });
});

describe("generateCertificateWithTemplate", () => {
  it("generates a certificate when context satisfies the classification template", () => {
    const context = makeClassificationContext();
    const result = generateCertificateWithTemplate(context, "classification");

    expect(result.validation.valid).toBe(true);
    expect(result.certificate).not.toBeNull();
    expect(verifyCertificate(result.certificate!)).toBe(true);
  });

  it("generates a certificate when context satisfies the recommendation template", () => {
    const context = makeRecommendationContext();
    const result = generateCertificateWithTemplate(context, "recommendation");

    expect(result.validation.valid).toBe(true);
    expect(result.certificate).not.toBeNull();
  });

  it("generates a certificate when context satisfies the approval/denial template", () => {
    const context = makeApprovalContext();
    const result = generateCertificateWithTemplate(context, "approval_denial");

    expect(result.validation.valid).toBe(true);
    expect(result.certificate).not.toBeNull();
  });

  it("generates a certificate when context satisfies the risk scoring template", () => {
    const context = makeRiskScoringContext();
    const result = generateCertificateWithTemplate(context, "risk_scoring");

    expect(result.validation.valid).toBe(true);
    expect(result.certificate).not.toBeNull();
  });

  it("returns null certificate and validation errors for unknown template", () => {
    const context = makeClassificationContext();
    const result = generateCertificateWithTemplate(context, "nonexistent");

    expect(result.certificate).toBeNull();
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors[0]).toContain("Unknown template");
    expect(result.validation.errors[0]).toContain("nonexistent");
  });

  it("returns null certificate when context fails validation against template", () => {
    const context = makeClassificationContext({
      premises: [],
      executionTrace: [],
    });
    const result = generateCertificateWithTemplate(context, "classification");

    expect(result.certificate).toBeNull();
    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.length).toBeGreaterThan(0);
  });

  it("returns validation details even when certificate is generated successfully", () => {
    const context = makeClassificationContext();
    const result = generateCertificateWithTemplate(context, "classification");

    expect(result.validation.valid).toBe(true);
    expect(result.validation.missingPremiseCategories).toEqual([]);
    expect(result.validation.missingTraceCategories).toEqual([]);
    expect(result.validation.errors).toEqual([]);
  });

  it("rejects recommendation context against classification template for missing categories", () => {
    const context = makeRecommendationContext();
    const result = generateCertificateWithTemplate(context, "classification");

    expect(result.certificate).toBeNull();
    expect(result.validation.valid).toBe(false);
    expect(result.validation.missingPremiseCategories).toContain("input_data");
  });

  it("rejects classification context against approval/denial template for missing categories", () => {
    const context = makeClassificationContext();
    const result = generateCertificateWithTemplate(context, "approval_denial");

    expect(result.certificate).toBeNull();
    expect(result.validation.valid).toBe(false);
    expect(result.validation.missingPremiseCategories).toContain("applicant_data");
  });
});
