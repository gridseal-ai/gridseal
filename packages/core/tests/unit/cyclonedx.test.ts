import { describe, expect, it } from "vitest";
import {
  generateCycloneDxBom,
  exportBomAsJson,
  exportBomAsCleanJson,
  stripNulls,
} from "../../src/provenance/cyclonedx.js";
import type {
  CycloneDxBom,
  GenerateBomInput,
} from "../../src/provenance/cyclonedx.js";
import { createProvenance } from "../../src/provenance/model-provenance.js";
import type { ModelProvenance } from "../../src/provenance/model-provenance.js";
import {
  makeProvenanceInput,
  makePerformanceMetric,
  makeDatasetReference,
  makeExternalReference,
  makeEthicalConsideration,
} from "./provenance-fixtures.js";

function makeValidInput(
  overrides?: Partial<GenerateBomInput>
): GenerateBomInput {
  const provenance = createProvenance(makeProvenanceInput());
  return {
    provenance,
    serialNumber: "urn:uuid:550e8400-e29b-41d4-a716-446655440000",
    toolVersion: "0.1.0",
    ...overrides,
  };
}

describe("generateCycloneDxBom", () => {
  it("produces a valid CycloneDX 1.7 BOM structure from a ModelProvenance record", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const bom = result.value;
    expect(bom.$schema).toBe(
      "http://cyclonedx.org/schema/bom-1.7.schema.json"
    );
    expect(bom.bomFormat).toBe("CycloneDX");
    expect(bom.specVersion).toBe("1.7");
    expect(bom.serialNumber).toBe(
      "urn:uuid:550e8400-e29b-41d4-a716-446655440000"
    );
    expect(bom.version).toBe(1);
  });

  it("includes gridseal as the generating tool in metadata", () => {
    const input = makeValidInput({ toolVersion: "2.0.0" });
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { metadata } = result.value;
    expect(metadata.timestamp).toBe("2026-04-04T12:00:00.000Z");
    expect(metadata.tools.components).toEqual([
      { type: "application", name: "gridseal", version: "2.0.0" },
    ]);
  });

  it("maps ModelProvenance fields to CycloneDX component fields", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const component = result.value.components[0];
    expect(component.type).toBe("machine-learning-model");
    expect(component.name).toBe("text-classifier-v2");
    expect(component.version).toBe("2.1.0");
    expect(component["bom-ref"]).toBe(
      "prov-019505f0-0000-7000-8000-000000000001"
    );
    expect(component.description).toBe(
      "Multi-label text classification model."
    );
  });

  it("sets supplier from modelProvider", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const component = result.value.components[0];
    expect(component.supplier).toEqual({ name: "acme-ai", url: [] });
  });

  it("sets authors from modelAuthor when present", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.components[0].authors).toEqual([
      { name: "ACME AI Research" },
    ]);
  });

  it("returns empty authors array when modelAuthor is null", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ modelAuthor: null })
    );
    const input = makeValidInput({ provenance });
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.components[0].authors).toEqual([]);
  });

  it("maps SPDX license to CycloneDX license format", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.components[0].licenses).toEqual([
      { license: { id: "Apache-2.0" } },
    ]);
  });

  it("returns empty licenses array when modelLicense is null", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ modelLicense: null })
    );
    const input = makeValidInput({ provenance });
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.components[0].licenses).toEqual([]);
  });

  it("includes provenanceHash as SHA-256 hash on the component", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { hashes } = result.value.components[0];
    expect(hashes).toHaveLength(1);
    expect(hashes[0].alg).toBe("SHA-256");
    expect(hashes[0].content).toBe(input.provenance.provenanceHash);
    expect(hashes[0].content).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("generateCycloneDxBom model type mapping", () => {
  it("maps classification to supervised approach", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ modelType: "classification" })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { modelCard } = result.value.components[0];
    expect(modelCard.modelParameters.approach).toEqual({
      type: "supervised",
    });
    expect(modelCard.modelParameters.task).toBe("classification");
  });

  it("maps regression to supervised approach", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ modelType: "regression" })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].modelCard.modelParameters.approach
    ).toEqual({ type: "supervised" });
  });

  it("maps clustering to unsupervised approach", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ modelType: "clustering" })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].modelCard.modelParameters.approach
    ).toEqual({ type: "unsupervised" });
  });

  it("maps reinforcement_learning to reinforcement-learning approach", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ modelType: "reinforcement_learning" })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].modelCard.modelParameters.approach
    ).toEqual({ type: "reinforcement-learning" });
  });

  it("maps generative to self-supervised approach", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ modelType: "generative" })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].modelCard.modelParameters.approach
    ).toEqual({ type: "self-supervised" });
  });

  it("sets approach to null for other model type", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ modelType: "other" })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].modelCard.modelParameters.approach
    ).toBeNull();
  });
});

describe("generateCycloneDxBom dataset conversion", () => {
  it("converts training datasets to CycloneDX dataset format", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const datasets =
      result.value.components[0].modelCard.modelParameters.datasets;
    expect(datasets).toHaveLength(1);
    expect(datasets[0]).toEqual({
      type: "dataset",
      name: "MMLU",
      description:
        "Massive Multitask Language Understanding benchmark.",
      "bom-ref": "ds-001",
    });
  });

  it("handles multiple datasets", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        trainingDatasets: [
          makeDatasetReference({ datasetId: "ds-001", name: "MMLU" }),
          makeDatasetReference({
            datasetId: "ds-002",
            name: "HellaSwag",
            description: "Commonsense reasoning benchmark.",
          }),
          makeDatasetReference({
            datasetId: "ds-003",
            name: "TruthfulQA",
            description: null,
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const datasets =
      result.value.components[0].modelCard.modelParameters.datasets;
    expect(datasets).toHaveLength(3);
    expect(datasets[0].name).toBe("MMLU");
    expect(datasets[1].name).toBe("HellaSwag");
    expect(datasets[2].name).toBe("TruthfulQA");
    expect(datasets[2].description).toBeNull();
  });

  it("returns empty datasets array when no training datasets exist", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ trainingDatasets: [] })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].modelCard.modelParameters.datasets
    ).toEqual([]);
  });
});

describe("generateCycloneDxBom performance metric conversion", () => {
  it("converts metrics with string values per CycloneDX spec", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const metrics =
      result.value.components[0].modelCard.quantitativeAnalysis
        .performanceMetrics;
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toEqual({
      type: "accuracy",
      value: "0.95",
      slice: null,
      confidenceInterval: null,
    });
  });

  it("converts confidence intervals with string bounds", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        performanceMetrics: [
          makePerformanceMetric({
            metricId: "metric-ci",
            name: "f1_score",
            value: 0.88,
            slice: "english-subset",
            confidenceInterval: { lower: 0.85, upper: 0.91 },
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const metric =
      result.value.components[0].modelCard.quantitativeAnalysis
        .performanceMetrics[0];
    expect(metric.type).toBe("f1_score");
    expect(metric.value).toBe("0.88");
    expect(metric.slice).toBe("english-subset");
    expect(metric.confidenceInterval).toEqual({
      lowerBound: "0.85",
      upperBound: "0.91",
    });
  });

  it("handles multiple metrics", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        performanceMetrics: [
          makePerformanceMetric({ metricId: "m1", name: "accuracy", value: 0.95 }),
          makePerformanceMetric({ metricId: "m2", name: "precision", value: 0.92 }),
          makePerformanceMetric({ metricId: "m3", name: "recall", value: 0.89 }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const metrics =
      result.value.components[0].modelCard.quantitativeAnalysis
        .performanceMetrics;
    expect(metrics).toHaveLength(3);
    expect(metrics.map((m) => m.type)).toEqual([
      "accuracy",
      "precision",
      "recall",
    ]);
  });

  it("returns empty metrics array when no performance metrics exist", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ performanceMetrics: [] })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].modelCard.quantitativeAnalysis
        .performanceMetrics
    ).toEqual([]);
  });
});

describe("generateCycloneDxBom external reference conversion", () => {
  it("maps documentation reference type correctly", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        externalReferences: [
          makeExternalReference({ referenceType: "documentation" }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].externalReferences[0].type
    ).toBe("documentation");
  });

  it("maps model_card reference type to model-card", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        externalReferences: [
          makeExternalReference({
            referenceType: "model_card",
            url: "https://example.com/card",
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].externalReferences[0].type
    ).toBe("model-card");
  });

  it("maps license reference type correctly", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        externalReferences: [
          makeExternalReference({
            referenceType: "license",
            url: "https://example.com/license",
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].externalReferences[0].type
    ).toBe("license");
  });

  it("maps website reference type correctly", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        externalReferences: [
          makeExternalReference({
            referenceType: "website",
            url: "https://example.com",
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].externalReferences[0].type
    ).toBe("website");
  });

  it("maps paper reference type to citation", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        externalReferences: [
          makeExternalReference({
            referenceType: "paper",
            url: "https://arxiv.org/abs/1234",
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].externalReferences[0].type
    ).toBe("citation");
  });

  it("maps unknown reference types to other", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        externalReferences: [
          makeExternalReference({
            referenceType: "custom-type",
            url: "https://example.com/custom",
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].externalReferences[0].type
    ).toBe("other");
  });

  it("preserves description as comment field", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        externalReferences: [
          makeExternalReference({
            description: "Full API documentation",
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].externalReferences[0].comment
    ).toBe("Full API documentation");
  });

  it("sets comment to null when description is null", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        externalReferences: [
          makeExternalReference({ description: null }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].externalReferences[0].comment
    ).toBeNull();
  });
});

describe("generateCycloneDxBom ethical consideration conversion", () => {
  it("combines category and description into a name field", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ethics =
      result.value.components[0].modelCard.considerations
        .ethicalConsiderations;
    expect(ethics).toHaveLength(1);
    expect(ethics[0].name).toBe(
      "fairness: Model may underperform on underrepresented demographics."
    );
    expect(ethics[0].mitigationStrategy).toBe(
      "Evaluate on disaggregated subgroups before deployment."
    );
  });

  it("handles multiple ethical considerations", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        ethicalConsiderations: [
          makeEthicalConsideration({
            category: "fairness",
            description: "Bias in outputs.",
          }),
          makeEthicalConsideration({
            category: "privacy",
            description: "May memorize training data.",
            mitigationStrategy: "Differential privacy applied.",
          }),
          makeEthicalConsideration({
            category: "safety",
            description: "Can generate harmful content.",
            mitigationStrategy: null,
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ethics =
      result.value.components[0].modelCard.considerations
        .ethicalConsiderations;
    expect(ethics).toHaveLength(3);
    expect(ethics[1].mitigationStrategy).toBe(
      "Differential privacy applied."
    );
    expect(ethics[2].mitigationStrategy).toBeNull();
  });

  it("returns empty ethical considerations when none exist", () => {
    const provenance = createProvenance(
      makeProvenanceInput({ ethicalConsiderations: [] })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(
      result.value.components[0].modelCard.considerations
        .ethicalConsiderations
    ).toEqual([]);
  });
});

describe("generateCycloneDxBom validation", () => {
  it("rejects invalid serial number format", () => {
    const input = makeValidInput({
      serialNumber: "not-a-valid-urn",
    });
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_SERIAL_NUMBER");
    expect(result.error.message).toContain("urn:uuid");
  });

  it("rejects serial number with uppercase hex digits", () => {
    const input = makeValidInput({
      serialNumber:
        "urn:uuid:550E8400-E29B-41D4-A716-446655440000",
    });
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_SERIAL_NUMBER");
  });

  it("rejects serial number without urn:uuid: prefix", () => {
    const input = makeValidInput({
      serialNumber: "550e8400-e29b-41d4-a716-446655440000",
    });
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error.code).toBe("INVALID_SERIAL_NUMBER");
  });
});

describe("generateCycloneDxBom with minimal provenance", () => {
  it("generates valid BOM from provenance with no optional fields", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        modelDescription: null,
        modelAuthor: null,
        modelLicense: null,
        trainingDatasets: [],
        performanceMetrics: [],
        ethicalConsiderations: [],
        externalReferences: [],
      })
    );
    const input = makeValidInput({ provenance });
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const component = result.value.components[0];
    expect(component.description).toBeNull();
    expect(component.authors).toEqual([]);
    expect(component.licenses).toEqual([]);
    expect(component.externalReferences).toEqual([]);
    expect(
      component.modelCard.modelParameters.datasets
    ).toEqual([]);
    expect(
      component.modelCard.quantitativeAnalysis.performanceMetrics
    ).toEqual([]);
    expect(
      component.modelCard.considerations.ethicalConsiderations
    ).toEqual([]);
  });
});

describe("exportBomAsJson", () => {
  it("produces valid JSON string with 2-space indentation", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const json = exportBomAsJson(result.value);
    const parsed = JSON.parse(json) as CycloneDxBom;

    expect(parsed.bomFormat).toBe("CycloneDX");
    expect(parsed.specVersion).toBe("1.7");
    expect(json).toContain("  "); // 2-space indent
  });

  it("round-trips through JSON parse without data loss", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const json = exportBomAsJson(result.value);
    const parsed = JSON.parse(json) as CycloneDxBom;

    expect(parsed).toEqual(result.value);
  });
});

describe("exportBomAsCleanJson", () => {
  it("removes null fields from output", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        modelDescription: null,
        modelAuthor: null,
        modelLicense: null,
      })
    );
    const input = makeValidInput({ provenance });
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const json = exportBomAsCleanJson(result.value);
    expect(json).not.toContain(": null");
    expect(json).not.toContain(":null");

    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.bomFormat).toBe("CycloneDX");
  });

  it("preserves non-null values after stripping", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const json = exportBomAsCleanJson(result.value);
    const parsed = JSON.parse(json) as CycloneDxBom;

    expect(parsed.bomFormat).toBe("CycloneDX");
    expect(parsed.components[0].name).toBe("text-classifier-v2");
    expect(parsed.components[0].description).toBe(
      "Multi-label text classification model."
    );
  });
});

describe("stripNulls", () => {
  it("removes null values from objects", () => {
    expect(stripNulls({ a: 1, b: null, c: "x" })).toEqual({
      a: 1,
      c: "x",
    });
  });

  it("removes undefined values from objects", () => {
    expect(stripNulls({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it("recursively strips nulls from nested objects", () => {
    expect(
      stripNulls({ a: { b: null, c: { d: null, e: 1 } } })
    ).toEqual({ a: { c: { e: 1 } } });
  });

  it("strips nulls from arrays", () => {
    expect(stripNulls([1, null, 3])).toEqual([1, undefined, 3]);
  });

  it("strips nulls from objects within arrays", () => {
    expect(
      stripNulls([{ a: 1, b: null }, { c: null }])
    ).toEqual([{ a: 1 }, {}]);
  });

  it("returns primitives unchanged", () => {
    expect(stripNulls(42)).toBe(42);
    expect(stripNulls("hello")).toBe("hello");
    expect(stripNulls(true)).toBe(true);
  });

  it("returns undefined for null input", () => {
    expect(stripNulls(null)).toBeUndefined();
  });

  it("handles empty objects and arrays", () => {
    expect(stripNulls({})).toEqual({});
    expect(stripNulls([])).toEqual([]);
  });
});

describe("CycloneDX BOM determinism", () => {
  it("produces identical BOM output for the same input", () => {
    const input = makeValidInput();
    const result1 = generateCycloneDxBom(input);
    const result2 = generateCycloneDxBom(input);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;

    const json1 = exportBomAsJson(result1.value);
    const json2 = exportBomAsJson(result2.value);
    expect(json1).toBe(json2);
  });

  it("produces different BOM output for different provenance records", () => {
    const prov1 = createProvenance(
      makeProvenanceInput({ modelName: "model-a" })
    );
    const prov2 = createProvenance(
      makeProvenanceInput({ modelName: "model-b" })
    );

    const result1 = generateCycloneDxBom(
      makeValidInput({ provenance: prov1 })
    );
    const result2 = generateCycloneDxBom(
      makeValidInput({ provenance: prov2 })
    );

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (!result1.ok || !result2.ok) return;

    expect(exportBomAsJson(result1.value)).not.toBe(
      exportBomAsJson(result2.value)
    );
  });
});

describe("CycloneDX BOM schema conformance", () => {
  it("has exactly one component per provenance record", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.components).toHaveLength(1);
  });

  it("uses machine-learning-model as the component type", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.components[0].type).toBe(
      "machine-learning-model"
    );
  });

  it("contains all required top-level BOM fields", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const bom = result.value;
    expect(bom).toHaveProperty("$schema");
    expect(bom).toHaveProperty("bomFormat");
    expect(bom).toHaveProperty("specVersion");
    expect(bom).toHaveProperty("serialNumber");
    expect(bom).toHaveProperty("version");
    expect(bom).toHaveProperty("metadata");
    expect(bom).toHaveProperty("components");
  });

  it("contains all required component fields", () => {
    const input = makeValidInput();
    const result = generateCycloneDxBom(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const component = result.value.components[0];
    expect(component).toHaveProperty("type");
    expect(component).toHaveProperty("name");
    expect(component).toHaveProperty("version");
    expect(component).toHaveProperty("bom-ref");
    expect(component).toHaveProperty("modelCard");
  });

  it("metric values are strings, not numbers, per CycloneDX spec", () => {
    const provenance = createProvenance(
      makeProvenanceInput({
        performanceMetrics: [
          makePerformanceMetric({
            value: 0.123456789,
            confidenceInterval: { lower: 0.1, upper: 0.15 },
          }),
        ],
      })
    );
    const result = generateCycloneDxBom(makeValidInput({ provenance }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const metric =
      result.value.components[0].modelCard.quantitativeAnalysis
        .performanceMetrics[0];
    expect(typeof metric.value).toBe("string");
    expect(typeof metric.confidenceInterval?.lowerBound).toBe("string");
    expect(typeof metric.confidenceInterval?.upperBound).toBe("string");
  });
});
