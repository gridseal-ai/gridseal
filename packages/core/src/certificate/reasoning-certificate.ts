import { createHash } from "node:crypto";
import { canonicalize } from "../chain/hash.js";

/**
 * Confidence level for a reasoning certificate's overall assessment.
 * Uses a discriminated union of string literals instead of an enum.
 */
export const CONFIDENCE_LEVELS = [
  "very_low",
  "low",
  "medium",
  "high",
  "very_high",
] as const;

export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

/** A single claim made within a reasoning certificate. */
export type Claim = {
  /** Unique identifier for this claim within the certificate. */
  readonly claimId: string;
  /** Human-readable statement of the claim. */
  readonly statement: string;
  /** IDs of evidence items that support this claim. */
  readonly supportingEvidenceIds: ReadonlyArray<string>;
};

/** A piece of evidence that supports one or more claims. */
export type Evidence = {
  /** Unique identifier for this evidence item. */
  readonly evidenceId: string;
  /** Type of evidence (e.g., "data_observation", "model_output", "reference", "computation"). */
  readonly evidenceType: string;
  /** Human-readable description of the evidence. */
  readonly description: string;
  /** Optional reference to an external source (URL, document ID, etc.). */
  readonly source: string | null;
};

/** A claim that the model was unable to support with sufficient evidence. */
export type UnsupportedClaim = {
  /** Human-readable statement of the unsupported claim. */
  readonly statement: string;
  /** Reason the claim could not be supported. */
  readonly reason: string;
};

/** An assumption made during reasoning that may affect the conclusion. */
export type Assumption = {
  /** Human-readable statement of the assumption. */
  readonly statement: string;
  /** How critical this assumption is to the overall conclusion. */
  readonly criticality: "low" | "medium" | "high";
};

/** A known limitation of the reasoning process or its conclusion. */
export type Limitation = {
  /** Human-readable description of the limitation. */
  readonly description: string;
  /** Potential impact on the conclusion if the limitation is significant. */
  readonly impact: string;
};

/** Overall confidence assessment for the reasoning certificate. */
export type ConfidenceAssessment = {
  /** Qualitative confidence level. */
  readonly level: ConfidenceLevel;
  /** Numeric score in [0, 1] representing the model's confidence. */
  readonly score: number;
  /** Human-readable explanation of the confidence assessment. */
  readonly rationale: string;
};

/**
 * A semi-formal reasoning certificate that documents the reasoning
 * process behind an AI decision. Referenced from ProofChainEntry
 * via the reasoningCertificateId field.
 */
export type ReasoningCertificate = {
  /** Unique identifier for this certificate (UUIDv7). */
  readonly certificateId: string;
  /** ISO 8601 timestamp of when this certificate was created. */
  readonly timestamp: string;
  /** ID of the model that produced the reasoning. */
  readonly modelId: string;
  /** Provider of the model (e.g., "openai", "anthropic"). */
  readonly modelProvider: string;
  /** Claims made during the reasoning process. */
  readonly claims: ReadonlyArray<Claim>;
  /** Evidence supporting the claims. */
  readonly supportingEvidence: ReadonlyArray<Evidence>;
  /** Claims that could not be adequately supported. */
  readonly unsupportedClaims: ReadonlyArray<UnsupportedClaim>;
  /** Assumptions underlying the reasoning. */
  readonly assumptions: ReadonlyArray<Assumption>;
  /** Known limitations of the reasoning. */
  readonly limitations: ReadonlyArray<Limitation>;
  /** Overall confidence assessment. */
  readonly confidenceAssessment: ConfidenceAssessment;
  /** SHA-256 hash of the certificate's canonical content (hex-encoded). */
  readonly certificateHash: string;
};

/** Input for creating a reasoning certificate. Omits computed certificateHash. */
export type CreateCertificateInput = Omit<ReasoningCertificate, "certificateHash">;

/**
 * Ordered list of field names for deterministic certificate serialization.
 * This order MUST NOT change once certificates exist in production chains.
 */
const CERTIFICATE_FIELD_ORDER: ReadonlyArray<keyof Omit<ReasoningCertificate, "certificateHash">> = [
  "certificateId",
  "timestamp",
  "modelId",
  "modelProvider",
  "claims",
  "supportingEvidence",
  "unsupportedClaims",
  "assumptions",
  "limitations",
  "confidenceAssessment",
] as const;

/**
 * Build the canonical string representation of a certificate's hashable fields.
 * Uses a fixed field order to ensure deterministic output.
 */
export function serializeCertificateForHashing(input: CreateCertificateInput): string {
  const parts: Array<string> = [];
  for (const key of CERTIFICATE_FIELD_ORDER) {
    const value: unknown = input[key];
    parts.push(JSON.stringify(key) + ":" + canonicalize(value));
  }
  return "{" + parts.join(",") + "}";
}

/**
 * Compute the SHA-256 hash of a certificate's canonical content.
 * Returns lowercase hex-encoded hash string.
 */
export function computeCertificateHash(input: CreateCertificateInput): string {
  const serialized = serializeCertificateForHashing(input);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

/**
 * Create a reasoning certificate from input fields.
 * Computes the certificateHash from the canonical serialization.
 */
export function createCertificate(input: CreateCertificateInput): ReasoningCertificate {
  const certificateHash = computeCertificateHash(input);
  return { ...input, certificateHash };
}

/**
 * Verify that a certificate's hash matches its content.
 * Returns true if the certificate has not been tampered with.
 */
export function verifyCertificate(certificate: ReasoningCertificate): boolean {
  const input: CreateCertificateInput = {
    certificateId: certificate.certificateId,
    timestamp: certificate.timestamp,
    modelId: certificate.modelId,
    modelProvider: certificate.modelProvider,
    claims: certificate.claims,
    supportingEvidence: certificate.supportingEvidence,
    unsupportedClaims: certificate.unsupportedClaims,
    assumptions: certificate.assumptions,
    limitations: certificate.limitations,
    confidenceAssessment: certificate.confidenceAssessment,
  };
  return computeCertificateHash(input) === certificate.certificateHash;
}
