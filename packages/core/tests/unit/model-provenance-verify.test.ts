import { describe, expect, it } from "vitest";
import {
  computeProvenanceHash,
  createProvenance,
  verifyProvenance,
} from "../../src/provenance/model-provenance.js";
import type { ModelProvenance } from "../../src/provenance/model-provenance.js";
import {
  makeDatasetReference,
  makeEthicalConsideration,
  makeExternalReference,
  makePerformanceMetric,
  makeProvenanceInput,
} from "./provenance-fixtures.js";

describe("createProvenance", () => {
  it("returns a provenance record with all input fields preserved", () => {
    const input = makeProvenanceInput();
    const prov = createProvenance(input);

    expect(prov.provenanceId).toBe(input.provenanceId);
    expect(prov.timestamp).toBe(input.timestamp);
    expect(prov.bomVersion).toBe(input.bomVersion);
    expect(prov.modelName).toBe(input.modelName);
    expect(prov.modelVersion).toBe(input.modelVersion);
    expect(prov.modelType).toBe(input.modelType);
    expect(prov.modelProvider).toBe(input.modelProvider);
    expect(prov.modelDescription).toBe(input.modelDescription);
    expect(prov.modelAuthor).toBe(input.modelAuthor);
    expect(prov.modelLicense).toBe(input.modelLicense);
    expect(prov.trainingDatasets).toEqual(input.trainingDatasets);
    expect(prov.performanceMetrics).toEqual(input.performanceMetrics);
    expect(prov.ethicalConsiderations).toEqual(input.ethicalConsiderations);
    expect(prov.externalReferences).toEqual(input.externalReferences);
  });

  it("computes and attaches the provenanceHash", () => {
    const input = makeProvenanceInput();
    const prov = createProvenance(input);

    expect(prov.provenanceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(prov.provenanceHash).toBe(computeProvenanceHash(input));
  });

  it("produces identical records for identical inputs", () => {
    const a = createProvenance(makeProvenanceInput());
    const b = createProvenance(makeProvenanceInput());
    expect(a).toEqual(b);
    expect(a.provenanceHash).toBe(b.provenanceHash);
  });

  it("produces different hashes for different inputs", () => {
    const a = createProvenance(makeProvenanceInput());
    const b = createProvenance(
      makeProvenanceInput({ provenanceId: "prov-different" })
    );
    expect(a.provenanceHash).not.toBe(b.provenanceHash);
  });
});

describe("verifyProvenance", () => {
  it("returns true for an unmodified provenance record", () => {
    const prov = createProvenance(makeProvenanceInput());
    expect(verifyProvenance(prov)).toBe(true);
  });

  it("returns false when provenanceId is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = { ...prov, provenanceId: "prov-tampered" };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when timestamp is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = {
      ...prov,
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when bomVersion is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = { ...prov, bomVersion: "1.0" };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when modelName is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = { ...prov, modelName: "tampered-model" };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when modelVersion is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = { ...prov, modelVersion: "9.9.9" };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when modelType is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = { ...prov, modelType: "generative" };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when modelProvider is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = { ...prov, modelProvider: "tampered-co" };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when modelDescription is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = {
      ...prov,
      modelDescription: "Tampered description.",
    };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when modelAuthor is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = { ...prov, modelAuthor: "Tampered Author" };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when modelLicense is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = { ...prov, modelLicense: "GPL-3.0" };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when training datasets are tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = {
      ...prov,
      trainingDatasets: [makeDatasetReference({ name: "Tampered Dataset" })],
    };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when performance metrics are tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = {
      ...prov,
      performanceMetrics: [makePerformanceMetric({ value: 0.01 })],
    };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when ethical considerations are tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = {
      ...prov,
      ethicalConsiderations: [
        makeEthicalConsideration({ description: "Tampered." }),
      ],
    };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when external references are tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = {
      ...prov,
      externalReferences: [
        makeExternalReference({ url: "https://tampered.example.com" }),
      ],
    };
    expect(verifyProvenance(tampered)).toBe(false);
  });

  it("returns false when only the hash is tampered", () => {
    const prov = createProvenance(makeProvenanceInput());
    const tampered: ModelProvenance = {
      ...prov,
      provenanceHash: "0".repeat(64),
    };
    expect(verifyProvenance(tampered)).toBe(false);
  });
});

