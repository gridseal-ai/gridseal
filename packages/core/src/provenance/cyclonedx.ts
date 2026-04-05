import type {
  ModelProvenance,
  DatasetReference,
  PerformanceMetric,
  ExternalReference,
  EthicalConsideration,
  ModelType,
} from "./model-provenance.js";
import type { Result } from "../schema/result.js";
import { ok, err } from "../schema/result.js";
import type {
  CdxComponent,
  CdxDataset,
  CdxExternalReference,
  CdxLicense,
  CdxPerformanceMetric,
  CycloneDxBom,
  GenerateBomInput,
  BomGenerationError,
} from "./cyclonedx-types.js";

export type {
  CycloneDxBom,
  CdxComponent,
  CdxModelCard,
  CdxMetadata,
  CdxPerformanceMetric,
  CdxDataset,
  CdxExternalReference,
  CdxHash,
  CdxLicense,
  CdxOrganization,
  GenerateBomInput,
  BomGenerationError,
} from "./cyclonedx-types.js";

const SERIAL_NUMBER_PATTERN =
  /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const CDX_SCHEMA_URL =
  "http://cyclonedx.org/schema/bom-1.7.schema.json";

/**
 * Map GridSeal reference types to CycloneDX external reference types.
 */
function mapReferenceType(referenceType: string): string {
  switch (referenceType) {
    case "documentation":
      return "documentation";
    case "model_card":
      return "model-card";
    case "license":
      return "license";
    case "website":
      return "website";
    case "paper":
      return "citation";
    default:
      return "other";
  }
}

/**
 * Map GridSeal ModelType to CycloneDX approach type.
 * Returns null for types that don't have a direct CycloneDX mapping.
 */
function mapApproachType(
  modelType: ModelType
): { readonly type: string } | null {
  switch (modelType) {
    case "classification":
    case "regression":
      return { type: "supervised" };
    case "clustering":
      return { type: "unsupervised" };
    case "reinforcement_learning":
      return { type: "reinforcement-learning" };
    case "generative":
      return { type: "self-supervised" };
    case "other":
      return null;
  }
}

/** Convert a GridSeal DatasetReference to a CycloneDX dataset. */
function convertDataset(dataset: DatasetReference): CdxDataset {
  return {
    type: "dataset",
    name: dataset.name,
    description: dataset.description,
    "bom-ref": dataset.datasetId,
  };
}

/** Convert a GridSeal PerformanceMetric to a CycloneDX performance metric. */
function convertMetric(metric: PerformanceMetric): CdxPerformanceMetric {
  return {
    type: metric.name,
    value: String(metric.value),
    slice: metric.slice,
    confidenceInterval: metric.confidenceInterval
      ? {
          lowerBound: String(metric.confidenceInterval.lower),
          upperBound: String(metric.confidenceInterval.upper),
        }
      : null,
  };
}

/** Convert a GridSeal ExternalReference to a CycloneDX external reference. */
function convertExternalReference(
  ref: ExternalReference
): CdxExternalReference {
  return {
    url: ref.url,
    type: mapReferenceType(ref.referenceType),
    comment: ref.description,
  };
}

/** Convert a GridSeal EthicalConsideration to a CycloneDX ethical consideration. */
function convertEthicalConsideration(
  consideration: EthicalConsideration
): { readonly name: string; readonly mitigationStrategy: string | null } {
  return {
    name: `${consideration.category}: ${consideration.description}`,
    mitigationStrategy: consideration.mitigationStrategy,
  };
}

/** Build a CycloneDX component from a ModelProvenance record. */
function buildComponent(provenance: ModelProvenance): CdxComponent {
  const authors: ReadonlyArray<{ readonly name: string }> =
    provenance.modelAuthor ? [{ name: provenance.modelAuthor }] : [];

  const licenses: ReadonlyArray<CdxLicense> = provenance.modelLicense
    ? [{ license: { id: provenance.modelLicense } }]
    : [];

  return {
    type: "machine-learning-model",
    name: provenance.modelName,
    version: provenance.modelVersion,
    "bom-ref": provenance.provenanceId,
    description: provenance.modelDescription,
    supplier: {
      name: provenance.modelProvider,
      url: [],
    },
    authors,
    licenses,
    hashes: [
      {
        alg: "SHA-256",
        content: provenance.provenanceHash,
      },
    ],
    externalReferences: provenance.externalReferences.map(
      convertExternalReference
    ),
    modelCard: {
      modelParameters: {
        approach: mapApproachType(provenance.modelType),
        task: provenance.modelType,
        datasets: provenance.trainingDatasets.map(convertDataset),
      },
      quantitativeAnalysis: {
        performanceMetrics:
          provenance.performanceMetrics.map(convertMetric),
      },
      considerations: {
        ethicalConsiderations:
          provenance.ethicalConsiderations.map(
            convertEthicalConsideration
          ),
      },
    },
  };
}

/**
 * Generate a CycloneDX ML-BOM v1.7 document from a ModelProvenance record.
 * Returns a Result containing the BOM or an error.
 */
export function generateCycloneDxBom(
  input: GenerateBomInput
): Result<CycloneDxBom, BomGenerationError> {
  if (!SERIAL_NUMBER_PATTERN.test(input.serialNumber)) {
    return err({
      code: "INVALID_SERIAL_NUMBER",
      message: `Serial number must match urn:uuid format, got: ${input.serialNumber}`,
    });
  }

  if (!input.provenance.provenanceId) {
    return err({
      code: "INVALID_PROVENANCE",
      message: "Provenance record must have a provenanceId",
    });
  }

  const bom: CycloneDxBom = {
    $schema: CDX_SCHEMA_URL,
    bomFormat: "CycloneDX",
    specVersion: "1.7",
    serialNumber: input.serialNumber,
    version: 1,
    metadata: {
      timestamp: input.provenance.timestamp,
      tools: {
        components: [
          {
            type: "application",
            name: "gridseal",
            version: input.toolVersion,
          },
        ],
      },
    },
    components: [buildComponent(input.provenance)],
  };

  return ok(bom);
}

/**
 * Export a CycloneDX BOM as a formatted JSON string.
 */
export function exportBomAsJson(bom: CycloneDxBom): string {
  return JSON.stringify(bom, null, 2);
}

/**
 * Strip null values from a CycloneDX BOM for cleaner JSON output.
 * CycloneDX validators may reject explicit null fields.
 */
export function stripNulls(value: unknown): unknown {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(stripNulls);
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const stripped = stripNulls(v);
      if (stripped !== undefined) {
        result[k] = stripped;
      }
    }
    return result;
  }
  return value;
}

/**
 * Export a CycloneDX BOM as a clean JSON string with null fields removed.
 * Preferred format for CycloneDX schema validation.
 */
export function exportBomAsCleanJson(bom: CycloneDxBom): string {
  return JSON.stringify(stripNulls(bom), null, 2);
}
