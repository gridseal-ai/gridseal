import type {
  CreateProvenanceInput,
  DatasetReference,
  EthicalConsideration,
  ExternalReference,
  PerformanceMetric,
} from "../../src/provenance/model-provenance.js";

export function makePerformanceMetric(
  overrides?: Partial<PerformanceMetric>
): PerformanceMetric {
  return {
    metricId: "metric-001",
    name: "accuracy",
    value: 0.95,
    slice: null,
    confidenceInterval: null,
    ...overrides,
  };
}

export function makeDatasetReference(
  overrides?: Partial<DatasetReference>
): DatasetReference {
  return {
    datasetId: "ds-001",
    name: "MMLU",
    version: "1.0",
    source: null,
    description: "Massive Multitask Language Understanding benchmark.",
    ...overrides,
  };
}

export function makeExternalReference(
  overrides?: Partial<ExternalReference>
): ExternalReference {
  return {
    referenceType: "documentation",
    url: "https://example.com/model-card",
    description: "Model card for the classification model.",
    ...overrides,
  };
}

export function makeEthicalConsideration(
  overrides?: Partial<EthicalConsideration>
): EthicalConsideration {
  return {
    category: "fairness",
    description: "Model may underperform on underrepresented demographics.",
    mitigationStrategy: "Evaluate on disaggregated subgroups before deployment.",
    ...overrides,
  };
}

export function makeProvenanceInput(
  overrides?: Partial<CreateProvenanceInput>
): CreateProvenanceInput {
  return {
    provenanceId: "prov-019505f0-0000-7000-8000-000000000001",
    timestamp: "2026-04-04T12:00:00.000Z",
    bomVersion: "1.7",
    modelName: "text-classifier-v2",
    modelVersion: "2.1.0",
    modelType: "classification",
    modelProvider: "acme-ai",
    modelDescription: "Multi-label text classification model.",
    modelAuthor: "ACME AI Research",
    modelLicense: "Apache-2.0",
    trainingDatasets: [makeDatasetReference()],
    performanceMetrics: [makePerformanceMetric()],
    ethicalConsiderations: [makeEthicalConsideration()],
    externalReferences: [makeExternalReference()],
    ...overrides,
  };
}
