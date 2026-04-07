import type {
  UnsupportedClaim,
  Assumption,
  Limitation,
} from "./reasoning-certificate.js";
import type { DecisionType } from "../schema/entry-types.js";

/**
 * A premise that grounds an AI decision - an observed fact or input condition
 * that the model relied on to reach its conclusion.
 */
export type Premise = {
  readonly id: string;
  readonly statement: string;
  readonly source: string | null;
  readonly required: boolean;
};

/**
 * A single step in the execution trace showing how the model
 * moved from premises to conclusion.
 */
export type TraceStep = {
  readonly stepId: string;
  readonly description: string;
  readonly inputRefs: ReadonlyArray<string>;
  readonly outputRef: string | null;
};

/**
 * The formal conclusion reached by the AI decision.
 */
export type Conclusion = {
  readonly statement: string;
  readonly supportingPremiseIds: ReadonlyArray<string>;
  readonly supportingTraceStepIds: ReadonlyArray<string>;
};

/**
 * Full decision context provided to the certificate engine.
 * Contains all the raw material needed to produce a reasoning certificate.
 */
export type DecisionContext = {
  readonly certificateId: string;
  readonly timestamp: string;
  readonly modelId: string;
  readonly modelProvider: string;
  readonly decisionType: DecisionType;
  readonly premises: ReadonlyArray<Premise>;
  readonly executionTrace: ReadonlyArray<TraceStep>;
  readonly conclusion: Conclusion;
  readonly unsupportedClaims: ReadonlyArray<UnsupportedClaim>;
  readonly assumptions: ReadonlyArray<Assumption>;
  readonly limitations: ReadonlyArray<Limitation>;
  readonly confidenceScore: number;
};

/**
 * Defines which premises and trace steps a certificate template requires
 * for a given decision type.
 */
export type CertificateTemplate = {
  readonly decisionType: DecisionType;
  readonly name: string;
  readonly description: string;
  readonly requiredPremiseCategories: ReadonlyArray<string>;
  readonly requiredTraceCategories: ReadonlyArray<string>;
  readonly minimumPremises: number;
  readonly minimumTraceSteps: number;
  readonly requiresConfidenceAbove: number;
};

/**
 * Result of validating a decision context against a template.
 */
export type TemplateValidationResult = {
  readonly valid: boolean;
  readonly missingPremiseCategories: ReadonlyArray<string>;
  readonly missingTraceCategories: ReadonlyArray<string>;
  readonly errors: ReadonlyArray<string>;
};

/** Template for classification decisions (e.g., spam detection, content moderation). */
export const CLASSIFICATION_TEMPLATE: CertificateTemplate = {
  decisionType: "classification",
  name: "Classification Certificate",
  description: "Certificate for AI classification decisions where input is assigned to one or more categories.",
  requiredPremiseCategories: ["input_data", "classification_criteria"],
  requiredTraceCategories: ["feature_analysis", "category_assignment"],
  minimumPremises: 2,
  minimumTraceSteps: 2,
  requiresConfidenceAbove: 0,
};

/** Template for recommendation decisions (e.g., product recommendations, treatment suggestions). */
export const RECOMMENDATION_TEMPLATE: CertificateTemplate = {
  decisionType: "recommendation",
  name: "Recommendation Certificate",
  description: "Certificate for AI recommendation decisions where options are evaluated and ranked.",
  requiredPremiseCategories: ["user_context", "available_options", "ranking_criteria"],
  requiredTraceCategories: ["option_evaluation", "ranking"],
  minimumPremises: 3,
  minimumTraceSteps: 2,
  requiresConfidenceAbove: 0,
};

/** Template for approval/denial decisions (e.g., loan approval, access control). */
export const APPROVAL_DENIAL_TEMPLATE: CertificateTemplate = {
  decisionType: "classification",
  name: "Approval/Denial Certificate",
  description: "Certificate for binary approval or denial decisions with clear accept/reject criteria.",
  requiredPremiseCategories: ["applicant_data", "eligibility_criteria", "threshold_values"],
  requiredTraceCategories: ["criteria_evaluation", "threshold_comparison", "decision_determination"],
  minimumPremises: 3,
  minimumTraceSteps: 3,
  requiresConfidenceAbove: 0.5,
};

/** Template for risk scoring decisions (e.g., credit scoring, fraud detection). */
export const RISK_SCORING_TEMPLATE: CertificateTemplate = {
  decisionType: "classification",
  name: "Risk Scoring Certificate",
  description: "Certificate for risk assessment decisions that produce a numeric risk score.",
  requiredPremiseCategories: ["subject_data", "risk_factors", "scoring_model"],
  requiredTraceCategories: ["factor_analysis", "score_computation", "risk_level_assignment"],
  minimumPremises: 3,
  minimumTraceSteps: 3,
  requiresConfidenceAbove: 0.3,
};

/**
 * All built-in templates indexed by a logical template name.
 */
export const CERTIFICATE_TEMPLATES: Readonly<Record<string, CertificateTemplate>> = {
  classification: CLASSIFICATION_TEMPLATE,
  recommendation: RECOMMENDATION_TEMPLATE,
  approval_denial: APPROVAL_DENIAL_TEMPLATE,
  risk_scoring: RISK_SCORING_TEMPLATE,
} as const;
