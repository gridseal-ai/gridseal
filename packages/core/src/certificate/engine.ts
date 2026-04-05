import type {
  Claim,
  Evidence,
  ConfidenceAssessment,
  ConfidenceLevel,
  CreateCertificateInput,
  ReasoningCertificate,
} from "./reasoning-certificate.js";
import { createCertificate } from "./reasoning-certificate.js";
import type {
  Premise,
  TraceStep,
  Conclusion,
  DecisionContext,
  CertificateTemplate,
  TemplateValidationResult,
} from "./engine-types.js";

export type {
  Premise,
  TraceStep,
  Conclusion,
  DecisionContext,
  CertificateTemplate,
  TemplateValidationResult,
} from "./engine-types.js";

export {
  CLASSIFICATION_TEMPLATE,
  RECOMMENDATION_TEMPLATE,
  APPROVAL_DENIAL_TEMPLATE,
  RISK_SCORING_TEMPLATE,
  CERTIFICATE_TEMPLATES,
} from "./engine-types.js";

import { CERTIFICATE_TEMPLATES } from "./engine-types.js";

/**
 * Derives a confidence level from a numeric score.
 */
export function confidenceLevelFromScore(score: number): ConfidenceLevel {
  if (score < 0 || score > 1) {
    throw new Error(`Confidence score must be in [0, 1], got ${score}`);
  }
  if (score < 0.2) return "very_low";
  if (score < 0.4) return "low";
  if (score < 0.6) return "medium";
  if (score < 0.8) return "high";
  return "very_high";
}

/**
 * Converts premises into certificate claims and evidence items.
 * Each premise becomes one claim ("This premise holds") and one evidence item.
 */
function premisesToClaimsAndEvidence(
  premises: ReadonlyArray<Premise>
): { claims: ReadonlyArray<Claim>; evidence: ReadonlyArray<Evidence> } {
  const claims: Array<Claim> = [];
  const evidence: Array<Evidence> = [];

  for (const premise of premises) {
    const evidenceId = `ev-${premise.id}`;
    evidence.push({
      evidenceId,
      evidenceType: "premise",
      description: premise.statement,
      source: premise.source,
    });
    claims.push({
      claimId: `claim-${premise.id}`,
      statement: premise.statement,
      supportingEvidenceIds: [evidenceId],
    });
  }

  return { claims, evidence };
}

/**
 * Converts execution trace steps into additional evidence items
 * and a conclusion claim linking to them.
 */
function traceToEvidenceAndConclusionClaim(
  trace: ReadonlyArray<TraceStep>,
  conclusion: Conclusion
): { conclusionClaim: Claim; traceEvidence: ReadonlyArray<Evidence> } {
  const traceEvidence: Array<Evidence> = [];
  const traceEvidenceIds: Array<string> = [];

  for (const step of trace) {
    const evidenceId = `ev-trace-${step.stepId}`;
    traceEvidence.push({
      evidenceId,
      evidenceType: "execution_trace",
      description: step.description,
      source: null,
    });
    traceEvidenceIds.push(evidenceId);
  }

  const premiseEvidenceIds = conclusion.supportingPremiseIds.map(
    (pid) => `ev-${pid}`
  );

  const conclusionClaim: Claim = {
    claimId: "claim-conclusion",
    statement: conclusion.statement,
    supportingEvidenceIds: [...premiseEvidenceIds, ...traceEvidenceIds],
  };

  return { conclusionClaim, traceEvidence };
}

/**
 * Validates a decision context against a certificate template.
 * Checks that all required premise categories and trace categories are present,
 * and that minimum counts and confidence thresholds are met.
 */
export function validateAgainstTemplate(
  context: DecisionContext,
  template: CertificateTemplate
): TemplateValidationResult {
  const errors: Array<string> = [];

  const premiseSources = new Set(
    context.premises
      .filter((p) => p.source !== null)
      .map((p) => p.source as string)
  );
  const premiseIds = new Set(context.premises.map((p) => p.id));

  const missingPremiseCategories: Array<string> = [];
  for (const category of template.requiredPremiseCategories) {
    const hasCategoryInSource = premiseSources.has(category);
    const hasCategoryInId = [...premiseIds].some((id) => id.startsWith(category));
    if (!hasCategoryInSource && !hasCategoryInId) {
      missingPremiseCategories.push(category);
    }
  }

  const traceIds = new Set(context.executionTrace.map((s) => s.stepId));

  const missingTraceCategories: Array<string> = [];
  for (const category of template.requiredTraceCategories) {
    const hasCategoryInId = [...traceIds].some((id) => id.startsWith(category));
    if (!hasCategoryInId) {
      missingTraceCategories.push(category);
    }
  }

  if (missingPremiseCategories.length > 0) {
    errors.push(
      `Missing required premise categories: ${missingPremiseCategories.join(", ")}`
    );
  }

  if (missingTraceCategories.length > 0) {
    errors.push(
      `Missing required trace categories: ${missingTraceCategories.join(", ")}`
    );
  }

  if (context.premises.length < template.minimumPremises) {
    errors.push(
      `Template requires at least ${template.minimumPremises} premises, got ${context.premises.length}`
    );
  }

  if (context.executionTrace.length < template.minimumTraceSteps) {
    errors.push(
      `Template requires at least ${template.minimumTraceSteps} trace steps, got ${context.executionTrace.length}`
    );
  }

  if (context.confidenceScore <= template.requiresConfidenceAbove) {
    errors.push(
      `Template requires confidence above ${template.requiresConfidenceAbove}, got ${context.confidenceScore}`
    );
  }

  return {
    valid: errors.length === 0,
    missingPremiseCategories,
    missingTraceCategories,
    errors,
  };
}

/**
 * Produces a reasoning certificate from an AI decision context.
 * Transforms premises into claims+evidence, execution trace into
 * additional evidence, and the conclusion into the final claim.
 */
export function generateCertificate(context: DecisionContext): ReasoningCertificate {
  const { claims: premiseClaims, evidence: premiseEvidence } =
    premisesToClaimsAndEvidence(context.premises);

  const { conclusionClaim, traceEvidence } = traceToEvidenceAndConclusionClaim(
    context.executionTrace,
    context.conclusion
  );

  const allClaims = [...premiseClaims, conclusionClaim];
  const allEvidence = [...premiseEvidence, ...traceEvidence];

  const confidenceLevel = confidenceLevelFromScore(context.confidenceScore);

  const confidenceAssessment: ConfidenceAssessment = {
    level: confidenceLevel,
    score: context.confidenceScore,
    rationale: `Confidence derived from ${context.premises.length} premises and ${context.executionTrace.length} trace steps for ${context.decisionType} decision.`,
  };

  const input: CreateCertificateInput = {
    certificateId: context.certificateId,
    timestamp: context.timestamp,
    modelId: context.modelId,
    modelProvider: context.modelProvider,
    claims: allClaims,
    supportingEvidence: allEvidence,
    unsupportedClaims: context.unsupportedClaims,
    assumptions: context.assumptions,
    limitations: context.limitations,
    confidenceAssessment,
  };

  return createCertificate(input);
}

/**
 * Generates a certificate after validating the decision context against a template.
 * Returns a validation error if the context does not satisfy the template requirements.
 */
export function generateCertificateWithTemplate(
  context: DecisionContext,
  templateName: string
): { certificate: ReasoningCertificate | null; validation: TemplateValidationResult } {
  const template = CERTIFICATE_TEMPLATES[templateName];
  if (template === undefined) {
    return {
      certificate: null,
      validation: {
        valid: false,
        missingPremiseCategories: [],
        missingTraceCategories: [],
        errors: [`Unknown template: "${templateName}". Available: ${Object.keys(CERTIFICATE_TEMPLATES).join(", ")}`],
      },
    };
  }

  const validation = validateAgainstTemplate(context, template);
  if (!validation.valid) {
    return { certificate: null, validation };
  }

  const certificate = generateCertificate(context);
  return { certificate, validation };
}

/**
 * Returns the names of all available certificate templates.
 */
export function getTemplateNames(): ReadonlyArray<string> {
  return Object.keys(CERTIFICATE_TEMPLATES);
}

/**
 * Retrieves a certificate template by name, or null if not found.
 */
export function getTemplate(name: string): CertificateTemplate | null {
  return CERTIFICATE_TEMPLATES[name] ?? null;
}
