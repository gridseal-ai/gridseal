import type {
  Assumption,
  Claim,
  ConfidenceAssessment,
  CreateCertificateInput,
  Evidence,
  Limitation,
  UnsupportedClaim,
} from "../../src/certificate/reasoning-certificate.js";

export function makeClaim(overrides?: Partial<Claim>): Claim {
  return {
    claimId: "claim-001",
    statement: "The input data is consistent with category A.",
    supportingEvidenceIds: ["ev-001"],
    ...overrides,
  };
}

export function makeEvidence(overrides?: Partial<Evidence>): Evidence {
  return {
    evidenceId: "ev-001",
    evidenceType: "data_observation",
    description: "Feature vector similarity exceeds 0.95 threshold.",
    source: null,
    ...overrides,
  };
}

export function makeUnsupportedClaim(
  overrides?: Partial<UnsupportedClaim>
): UnsupportedClaim {
  return {
    statement: "The data also matches category B.",
    reason: "Insufficient evidence: similarity score was 0.42, below 0.80 threshold.",
    ...overrides,
  };
}

export function makeAssumption(overrides?: Partial<Assumption>): Assumption {
  return {
    statement: "Input data has been preprocessed with standard normalization.",
    criticality: "medium",
    ...overrides,
  };
}

export function makeLimitation(overrides?: Partial<Limitation>): Limitation {
  return {
    description: "Model has not been evaluated on adversarial inputs.",
    impact: "Classification confidence may be unreliable for crafted inputs.",
    ...overrides,
  };
}

export function makeConfidenceAssessment(
  overrides?: Partial<ConfidenceAssessment>
): ConfidenceAssessment {
  return {
    level: "high",
    score: 0.92,
    rationale: "Strong feature similarity with training examples in category A.",
    ...overrides,
  };
}

export function makeCertificateInput(
  overrides?: Partial<CreateCertificateInput>
): CreateCertificateInput {
  return {
    certificateId: "cert-019505f0-0000-7000-8000-000000000001",
    timestamp: "2026-04-04T12:00:00.000Z",
    modelId: "claude-sonnet-4-20250514",
    modelProvider: "anthropic",
    claims: [makeClaim()],
    supportingEvidence: [makeEvidence()],
    unsupportedClaims: [makeUnsupportedClaim()],
    assumptions: [makeAssumption()],
    limitations: [makeLimitation()],
    confidenceAssessment: makeConfidenceAssessment(),
    ...overrides,
  };
}
