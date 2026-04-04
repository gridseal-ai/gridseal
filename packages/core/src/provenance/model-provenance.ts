import { createHash } from "node:crypto";
import { canonicalize } from "../chain/hash.js";

/**
 * Model type classification aligned with CycloneDX ML-BOM v1.7.
 */
export const MODEL_TYPES = [
  "classification",
  "regression",
  "clustering",
  "generative",
  "reinforcement_learning",
  "other",
] as const;

export type ModelType = (typeof MODEL_TYPES)[number];

/** A quantitative performance metric for a model. */
export type PerformanceMetric = {
  /** Unique identifier for this metric within the provenance record. */
  readonly metricId: string;
  /** Name of the metric (e.g., "accuracy", "f1_score", "bleu"). */
  readonly name: string;
  /** Measured value of the metric. */
  readonly value: number;
  /** Data subset the metric applies to, or null if global. */
  readonly slice: string | null;
  /** Confidence interval bounds, or null if not computed. */
  readonly confidenceInterval: {
    readonly lower: number;
    readonly upper: number;
  } | null;
};

/** A reference to a training or evaluation dataset. */
export type DatasetReference = {
  /** Unique identifier for this dataset reference. */
  readonly datasetId: string;
  /** Human-readable name of the dataset. */
  readonly name: string;
  /** Version of the dataset, or null if unversioned. */
  readonly version: string | null;
  /** URL or identifier for the dataset source. */
  readonly source: string | null;
  /** Description of the dataset's content and purpose. */
  readonly description: string | null;
};

/** A reference to an external resource (paper, documentation, model card). */
export type ExternalReference = {
  /** Type of the reference (e.g., "documentation", "paper", "model_card", "license", "website"). */
  readonly referenceType: string;
  /** URL of the external resource. */
  readonly url: string;
  /** Description of what the resource contains. */
  readonly description: string | null;
};

/** An ethical consideration about the model's use or behavior. */
export type EthicalConsideration = {
  /** Category of concern (e.g., "fairness", "privacy", "safety", "transparency"). */
  readonly category: string;
  /** Description of the ethical consideration. */
  readonly description: string;
  /** Strategy to mitigate the concern, or null if none defined. */
  readonly mitigationStrategy: string | null;
};

/**
 * An AI Bill of Materials (AIBOM) record capturing model provenance.
 * Aligns with CycloneDX ML-BOM v1.7 component and modelCard fields.
 * Referenced from ProofChainEntry via the provenanceId field.
 */
export type ModelProvenance = {
  /** Unique identifier for this provenance record (UUIDv7). */
  readonly provenanceId: string;
  /** ISO 8601 timestamp of when this record was created. */
  readonly timestamp: string;
  /** CycloneDX BOM specification version (e.g., "1.7"). */
  readonly bomVersion: string;
  /** Name of the model. */
  readonly modelName: string;
  /** Version of the model. */
  readonly modelVersion: string;
  /** Classification of the model's primary task type. */
  readonly modelType: ModelType;
  /** Provider or organization that created the model. */
  readonly modelProvider: string;
  /** Description of the model's purpose and capabilities. */
  readonly modelDescription: string | null;
  /** Author or team who created the model. */
  readonly modelAuthor: string | null;
  /** SPDX license identifier for the model (e.g., "Apache-2.0"). */
  readonly modelLicense: string | null;
  /** Training and evaluation datasets used. */
  readonly trainingDatasets: ReadonlyArray<DatasetReference>;
  /** Quantitative performance metrics. */
  readonly performanceMetrics: ReadonlyArray<PerformanceMetric>;
  /** Ethical considerations and bias assessments. */
  readonly ethicalConsiderations: ReadonlyArray<EthicalConsideration>;
  /** References to external documentation, papers, and model cards. */
  readonly externalReferences: ReadonlyArray<ExternalReference>;
  /** SHA-256 hash of the provenance record's canonical content (hex-encoded). */
  readonly provenanceHash: string;
};

/** Input for creating a model provenance record. Omits computed provenanceHash. */
export type CreateProvenanceInput = Omit<ModelProvenance, "provenanceHash">;

/**
 * Ordered list of field names for deterministic provenance serialization.
 * This order MUST NOT change once provenance records exist in production chains.
 */
const PROVENANCE_FIELD_ORDER: ReadonlyArray<
  keyof Omit<ModelProvenance, "provenanceHash">
> = [
  "provenanceId",
  "timestamp",
  "bomVersion",
  "modelName",
  "modelVersion",
  "modelType",
  "modelProvider",
  "modelDescription",
  "modelAuthor",
  "modelLicense",
  "trainingDatasets",
  "performanceMetrics",
  "ethicalConsiderations",
  "externalReferences",
] as const;

/**
 * Build the canonical string representation of a provenance record's hashable fields.
 * Uses a fixed field order to ensure deterministic output.
 */
export function serializeProvenanceForHashing(
  input: CreateProvenanceInput
): string {
  const parts: Array<string> = [];
  for (const key of PROVENANCE_FIELD_ORDER) {
    const value: unknown = input[key];
    parts.push(JSON.stringify(key) + ":" + canonicalize(value));
  }
  return "{" + parts.join(",") + "}";
}

/**
 * Compute the SHA-256 hash of a provenance record's canonical content.
 * Returns lowercase hex-encoded hash string.
 */
export function computeProvenanceHash(input: CreateProvenanceInput): string {
  const serialized = serializeProvenanceForHashing(input);
  return createHash("sha256").update(serialized, "utf8").digest("hex");
}

/**
 * Create a model provenance record from input fields.
 * Computes the provenanceHash from the canonical serialization.
 */
export function createProvenance(
  input: CreateProvenanceInput
): ModelProvenance {
  const provenanceHash = computeProvenanceHash(input);
  return { ...input, provenanceHash };
}

/**
 * Verify that a provenance record's hash matches its content.
 * Returns true if the record has not been tampered with.
 */
export function verifyProvenance(record: ModelProvenance): boolean {
  const input: CreateProvenanceInput = {
    provenanceId: record.provenanceId,
    timestamp: record.timestamp,
    bomVersion: record.bomVersion,
    modelName: record.modelName,
    modelVersion: record.modelVersion,
    modelType: record.modelType,
    modelProvider: record.modelProvider,
    modelDescription: record.modelDescription,
    modelAuthor: record.modelAuthor,
    modelLicense: record.modelLicense,
    trainingDatasets: record.trainingDatasets,
    performanceMetrics: record.performanceMetrics,
    ethicalConsiderations: record.ethicalConsiderations,
    externalReferences: record.externalReferences,
  };
  return computeProvenanceHash(input) === record.provenanceHash;
}
