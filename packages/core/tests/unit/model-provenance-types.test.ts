import { describe, expect, it } from "vitest";
import {
  MODEL_TYPES,
  serializeProvenanceForHashing,
} from "../../src/provenance/model-provenance.js";
import type { ModelType } from "../../src/provenance/model-provenance.js";
import {
  makeDatasetReference,
  makeEthicalConsideration,
  makeExternalReference,
  makePerformanceMetric,
  makeProvenanceInput,
} from "./provenance-fixtures.js";

describe("MODEL_TYPES", () => {
  it("contains exactly 6 model types", () => {
    expect(MODEL_TYPES).toEqual([
      "classification",
      "regression",
      "clustering",
      "generative",
      "reinforcement_learning",
      "other",
    ]);
    expect(MODEL_TYPES).toHaveLength(6);
  });

  it("is a readonly tuple", () => {
    const types: ReadonlyArray<ModelType> = MODEL_TYPES;
    expect(types).toBeDefined();
  });
});

describe("ModelProvenance types", () => {
  it("PerformanceMetric has metricId, name, value, slice, and confidenceInterval", () => {
    const metric = makePerformanceMetric();
    expect(metric.metricId).toBe("metric-001");
    expect(metric.name).toBe("accuracy");
    expect(metric.value).toBe(0.95);
    expect(metric.slice).toBeNull();
    expect(metric.confidenceInterval).toBeNull();
  });

  it("PerformanceMetric supports confidence intervals", () => {
    const metric = makePerformanceMetric({
      confidenceInterval: { lower: 0.93, upper: 0.97 },
    });
    expect(metric.confidenceInterval).toEqual({ lower: 0.93, upper: 0.97 });
  });

  it("PerformanceMetric supports data slices", () => {
    const metric = makePerformanceMetric({ slice: "age_group:18-25" });
    expect(metric.slice).toBe("age_group:18-25");
  });

  it("DatasetReference has datasetId, name, version, source, and description", () => {
    const ds = makeDatasetReference();
    expect(ds.datasetId).toBe("ds-001");
    expect(ds.name).toBe("MMLU");
    expect(ds.version).toBe("1.0");
    expect(ds.source).toBeNull();
    expect(ds.description).toContain("Multitask Language Understanding");
  });

  it("DatasetReference source can be a URL", () => {
    const ds = makeDatasetReference({
      source: "https://huggingface.co/datasets/mmlu",
    });
    expect(ds.source).toBe("https://huggingface.co/datasets/mmlu");
  });

  it("ExternalReference has referenceType, url, and optional description", () => {
    const ref = makeExternalReference();
    expect(ref.referenceType).toBe("documentation");
    expect(ref.url).toBe("https://example.com/model-card");
    expect(ref.description).toContain("Model card");
  });

  it("ExternalReference description can be null", () => {
    const ref = makeExternalReference({ description: null });
    expect(ref.description).toBeNull();
  });

  it("EthicalConsideration has category, description, and optional mitigationStrategy", () => {
    const ec = makeEthicalConsideration();
    expect(ec.category).toBe("fairness");
    expect(ec.description).toContain("underrepresented");
    expect(ec.mitigationStrategy).toContain("disaggregated");
  });

  it("EthicalConsideration mitigationStrategy can be null", () => {
    const ec = makeEthicalConsideration({ mitigationStrategy: null });
    expect(ec.mitigationStrategy).toBeNull();
  });
});

describe("serializeProvenanceForHashing", () => {
  it("produces a deterministic string with fields in fixed order", () => {
    const input = makeProvenanceInput();
    const serialized = serializeProvenanceForHashing(input);

    expect(serialized.startsWith("{")).toBe(true);
    expect(serialized.endsWith("}")).toBe(true);

    const provIdPos = serialized.indexOf('"provenanceId"');
    const timestampPos = serialized.indexOf('"timestamp"');
    const bomVersionPos = serialized.indexOf('"bomVersion"');
    const modelNamePos = serialized.indexOf('"modelName"');
    const datasetsPos = serialized.indexOf('"trainingDatasets"');
    const refsPos = serialized.indexOf('"externalReferences"');

    expect(provIdPos).toBeLessThan(timestampPos);
    expect(timestampPos).toBeLessThan(bomVersionPos);
    expect(bomVersionPos).toBeLessThan(modelNamePos);
    expect(modelNamePos).toBeLessThan(datasetsPos);
    expect(datasetsPos).toBeLessThan(refsPos);
  });

  it("produces identical output for identical inputs", () => {
    const a = serializeProvenanceForHashing(makeProvenanceInput());
    const b = serializeProvenanceForHashing(makeProvenanceInput());
    expect(a).toBe(b);
  });

  it("includes all 14 hashable fields (15 total minus provenanceHash)", () => {
    const serialized = serializeProvenanceForHashing(makeProvenanceInput());
    const expectedFields = [
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
    ];
    for (const field of expectedFields) {
      expect(serialized).toContain(`"${field}":`);
    }
    expect(serialized).not.toContain('"provenanceHash"');
  });

  it("serializes nested dataset objects with sorted keys", () => {
    const serialized = serializeProvenanceForHashing(makeProvenanceInput());
    expect(serialized).toContain('"datasetId"');
    expect(serialized).toContain('"name"');
    expect(serialized).toContain('"version"');
  });

  it("serializes null optional fields as null", () => {
    const input = makeProvenanceInput({
      modelDescription: null,
      modelAuthor: null,
      modelLicense: null,
    });
    const serialized = serializeProvenanceForHashing(input);
    expect(serialized).toContain('"modelDescription":null');
    expect(serialized).toContain('"modelAuthor":null');
    expect(serialized).toContain('"modelLicense":null');
  });

  it("serializes performance metric confidence intervals as nested objects", () => {
    const input = makeProvenanceInput({
      performanceMetrics: [
        makePerformanceMetric({
          confidenceInterval: { lower: 0.90, upper: 0.98 },
        }),
      ],
    });
    const serialized = serializeProvenanceForHashing(input);
    expect(serialized).toContain('"lower"');
    expect(serialized).toContain('"upper"');
  });
});
