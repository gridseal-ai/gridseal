import { describe, expect, it } from "vitest";
import {
  createProvenance,
  verifyProvenance,
  computeProvenanceHash,
  serializeProvenanceForHashing,
} from "../../src/provenance/model-provenance.js";
import type { ModelProvenance } from "../../src/provenance/model-provenance.js";
import {
  makeDatasetReference,
  makeEthicalConsideration,
  makeExternalReference,
  makePerformanceMetric,
  makeProvenanceInput,
} from "./provenance-fixtures.js";

describe("createProvenance boundary inputs", () => {
  it("handles provenance with unicode in all string fields", () => {
    const input = makeProvenanceInput({
      provenanceId: "prov-\u4f60\u597d",
      modelName: "\u00e9l\u00e8ve-classifier",
      modelProvider: "fournisseur-\u00e7",
      modelDescription: "\u4f60\u597d\u4e16\u754c model description",
      modelAuthor: "Auteur \u00e9tranger",
      modelLicense: "Licence-\u00fc",
    });
    const prov = createProvenance(input);
    expect(verifyProvenance(prov)).toBe(true);
    expect(prov.modelName).toBe("\u00e9l\u00e8ve-classifier");
  });

  it("handles provenance with very long descriptions (5K characters)", () => {
    const longStr = "x".repeat(5000);
    const input = makeProvenanceInput({
      modelDescription: longStr,
    });
    const prov = createProvenance(input);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles provenance with empty string fields", () => {
    const input = makeProvenanceInput({
      modelName: "",
      modelProvider: "",
      modelDescription: "",
      modelAuthor: "",
      modelLicense: "",
    });
    const prov = createProvenance(input);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles provenance with all optional arrays empty", () => {
    const input = makeProvenanceInput({
      trainingDatasets: [],
      performanceMetrics: [],
      ethicalConsiderations: [],
      externalReferences: [],
    });
    const prov = createProvenance(input);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("handles provenance with 50 datasets, metrics, considerations, and references", () => {
    const input = makeProvenanceInput({
      trainingDatasets: Array.from({ length: 50 }, (_, i) =>
        makeDatasetReference({ datasetId: `ds-${i}`, name: `Dataset ${i}` }),
      ),
      performanceMetrics: Array.from({ length: 50 }, (_, i) =>
        makePerformanceMetric({ metricId: `m-${i}`, name: `metric-${i}`, value: i / 50 }),
      ),
      ethicalConsiderations: Array.from({ length: 50 }, (_, i) =>
        makeEthicalConsideration({ description: `Consideration ${i}` }),
      ),
      externalReferences: Array.from({ length: 50 }, (_, i) =>
        makeExternalReference({ url: `https://example.com/ref-${i}` }),
      ),
    });
    const prov = createProvenance(input);
    expect(prov.trainingDatasets).toHaveLength(50);
    expect(prov.performanceMetrics).toHaveLength(50);
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("distinguishes null modelDescription from empty string", () => {
    const withNull = createProvenance(makeProvenanceInput({ modelDescription: null }));
    const withEmpty = createProvenance(makeProvenanceInput({ modelDescription: "" }));
    expect(withNull.provenanceHash).not.toBe(withEmpty.provenanceHash);
  });

  it("detects reordering of training datasets", () => {
    const ds1 = makeDatasetReference({ datasetId: "ds-1", name: "First" });
    const ds2 = makeDatasetReference({ datasetId: "ds-2", name: "Second" });
    const provAB = createProvenance(makeProvenanceInput({
      trainingDatasets: [ds1, ds2],
    }));
    const provBA = createProvenance(makeProvenanceInput({
      trainingDatasets: [ds2, ds1],
    }));
    expect(provAB.provenanceHash).not.toBe(provBA.provenanceHash);
  });

  it("detects single-field tampering in performance metric value", () => {
    const prov = createProvenance(makeProvenanceInput({
      performanceMetrics: [makePerformanceMetric({ value: 0.95 })],
    }));
    const tampered: ModelProvenance = {
      ...prov,
      performanceMetrics: [makePerformanceMetric({ value: 0.96 })],
    };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("handles metric with zero value vs null confidenceInterval", () => {
    const prov = createProvenance(makeProvenanceInput({
      performanceMetrics: [makePerformanceMetric({ value: 0, confidenceInterval: null })],
    }));
    expect(verifyProvenance(prov)).toBe(true);
  });
});

describe("serializeProvenanceForHashing determinism", () => {
  it("produces identical output across 100 identical calls", () => {
    const input = makeProvenanceInput();
    const baseline = serializeProvenanceForHashing(input);
    for (let i = 0; i < 100; i++) {
      expect(serializeProvenanceForHashing(input)).toBe(baseline);
    }
  });
});
