import { describe, expect, it } from "vitest";
import {
  MODEL_TYPES,
  createProvenance,
  verifyProvenance,
} from "../../src/provenance/model-provenance.js";
import {
  makeDatasetReference,
  makeEthicalConsideration,
  makePerformanceMetric,
  makeProvenanceInput,
} from "./provenance-fixtures.js";

describe("createProvenance with empty arrays", () => {
  it("handles provenance with no training datasets", () => {
    const input = makeProvenanceInput({ trainingDatasets: [] });
    const prov = createProvenance(input);
    expect(prov.trainingDatasets).toEqual([]);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles provenance with no performance metrics", () => {
    const input = makeProvenanceInput({ performanceMetrics: [] });
    const prov = createProvenance(input);
    expect(prov.performanceMetrics).toEqual([]);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles provenance with no ethical considerations", () => {
    const input = makeProvenanceInput({ ethicalConsiderations: [] });
    const prov = createProvenance(input);
    expect(prov.ethicalConsiderations).toEqual([]);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles provenance with no external references", () => {
    const input = makeProvenanceInput({ externalReferences: [] });
    const prov = createProvenance(input);
    expect(prov.externalReferences).toEqual([]);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles provenance with all arrays empty and all optional fields null", () => {
    const input = makeProvenanceInput({
      modelDescription: null,
      modelAuthor: null,
      modelLicense: null,
      trainingDatasets: [],
      performanceMetrics: [],
      ethicalConsiderations: [],
      externalReferences: [],
    });
    const prov = createProvenance(input);
    expect(verifyProvenance(prov)).toBe(true);
  });
});

describe("createProvenance with multiple items", () => {
  it("handles multiple training datasets", () => {
    const input = makeProvenanceInput({
      trainingDatasets: [
        makeDatasetReference({ datasetId: "ds-001", name: "MMLU" }),
        makeDatasetReference({ datasetId: "ds-002", name: "HumanEval" }),
        makeDatasetReference({ datasetId: "ds-003", name: "GSM8K" }),
      ],
    });
    const prov = createProvenance(input);
    expect(prov.trainingDatasets).toHaveLength(3);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles multiple performance metrics with slices and intervals", () => {
    const input = makeProvenanceInput({
      performanceMetrics: [
        makePerformanceMetric({
          metricId: "metric-001",
          name: "accuracy",
          value: 0.95,
          slice: null,
          confidenceInterval: { lower: 0.93, upper: 0.97 },
        }),
        makePerformanceMetric({
          metricId: "metric-002",
          name: "f1_score",
          value: 0.91,
          slice: "english",
          confidenceInterval: null,
        }),
        makePerformanceMetric({
          metricId: "metric-003",
          name: "accuracy",
          value: 0.88,
          slice: "non_english",
          confidenceInterval: { lower: 0.85, upper: 0.91 },
        }),
      ],
    });
    const prov = createProvenance(input);
    expect(prov.performanceMetrics).toHaveLength(3);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles multiple ethical considerations", () => {
    const input = makeProvenanceInput({
      ethicalConsiderations: [
        makeEthicalConsideration({ category: "fairness" }),
        makeEthicalConsideration({
          category: "privacy",
          description: "Model may memorize training data.",
          mitigationStrategy: null,
        }),
        makeEthicalConsideration({
          category: "safety",
          description: "Model may generate harmful content.",
          mitigationStrategy: "Apply output filtering.",
        }),
      ],
    });
    const prov = createProvenance(input);
    expect(prov.ethicalConsiderations).toHaveLength(3);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("order of datasets affects the hash (arrays preserve order)", () => {
    const dsA = makeDatasetReference({ datasetId: "ds-a", name: "Dataset A" });
    const dsB = makeDatasetReference({ datasetId: "ds-b", name: "Dataset B" });

    const provAB = createProvenance(
      makeProvenanceInput({ trainingDatasets: [dsA, dsB] })
    );
    const provBA = createProvenance(
      makeProvenanceInput({ trainingDatasets: [dsB, dsA] })
    );
    expect(provAB.provenanceHash).not.toBe(provBA.provenanceHash);
  });

  it("order of metrics affects the hash (arrays preserve order)", () => {
    const mA = makePerformanceMetric({ metricId: "m-a", name: "accuracy" });
    const mB = makePerformanceMetric({ metricId: "m-b", name: "f1_score" });

    const provAB = createProvenance(
      makeProvenanceInput({ performanceMetrics: [mA, mB] })
    );
    const provBA = createProvenance(
      makeProvenanceInput({ performanceMetrics: [mB, mA] })
    );
    expect(provAB.provenanceHash).not.toBe(provBA.provenanceHash);
  });
});

describe("provenance is referenceable from ProofChainEntry", () => {
  it("provenanceId can be used as provenanceId in an entry", () => {
    const prov = createProvenance(makeProvenanceInput());
    expect(typeof prov.provenanceId).toBe("string");
    expect(prov.provenanceId.length).toBeGreaterThan(0);
  });
});

describe("all model types produce valid provenance records", () => {
  for (const modelType of MODEL_TYPES) {
    it(`creates and verifies a provenance record with modelType "${modelType}"`, () => {
      const prov = createProvenance(makeProvenanceInput({ modelType }));
      expect(prov.modelType).toBe(modelType);
      expect(verifyProvenance(prov)).toBe(true);
    });
  }
});
