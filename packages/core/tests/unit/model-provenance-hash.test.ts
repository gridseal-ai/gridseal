import { describe, expect, it } from "vitest";
import {
  computeProvenanceHash,
  createProvenance,
  serializeProvenanceForHashing,
} from "../../src/provenance/model-provenance.js";
import { sha256 } from "../../src/chain/hash.js";
import {
  makeDatasetReference,
  makeEthicalConsideration,
  makeExternalReference,
  makePerformanceMetric,
  makeProvenanceInput,
} from "./provenance-fixtures.js";

describe("computeProvenanceHash", () => {
  it("returns a 64-character lowercase hex string", () => {
    const hash = computeProvenanceHash(makeProvenanceInput());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const input = makeProvenanceInput();
    expect(computeProvenanceHash(input)).toBe(computeProvenanceHash(input));
  });

  it("equals SHA-256 of the serialized provenance", () => {
    const input = makeProvenanceInput();
    const serialized = serializeProvenanceForHashing(input);
    expect(computeProvenanceHash(input)).toBe(sha256(serialized));
  });

  it("produces different hashes for different provenanceIds", () => {
    const a = makeProvenanceInput({ provenanceId: "prov-aaa" });
    const b = makeProvenanceInput({ provenanceId: "prov-bbb" });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes for different timestamps", () => {
    const a = makeProvenanceInput({ timestamp: "2026-04-04T12:00:00.000Z" });
    const b = makeProvenanceInput({ timestamp: "2026-04-04T13:00:00.000Z" });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes for different bomVersions", () => {
    const a = makeProvenanceInput({ bomVersion: "1.7" });
    const b = makeProvenanceInput({ bomVersion: "1.6" });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes for different model names", () => {
    const baseline = computeProvenanceHash(makeProvenanceInput());
    expect(
      computeProvenanceHash(makeProvenanceInput({ modelName: "other-model" }))
    ).not.toBe(baseline);
  });

  it("produces different hashes for different model versions", () => {
    const baseline = computeProvenanceHash(makeProvenanceInput());
    expect(
      computeProvenanceHash(makeProvenanceInput({ modelVersion: "3.0.0" }))
    ).not.toBe(baseline);
  });

  it("produces different hashes for different model types", () => {
    const a = makeProvenanceInput({ modelType: "classification" });
    const b = makeProvenanceInput({ modelType: "generative" });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes for different model providers", () => {
    const baseline = computeProvenanceHash(makeProvenanceInput());
    expect(
      computeProvenanceHash(makeProvenanceInput({ modelProvider: "other-co" }))
    ).not.toBe(baseline);
  });

  it("produces different hashes for different model descriptions", () => {
    const a = makeProvenanceInput({ modelDescription: "Description A." });
    const b = makeProvenanceInput({ modelDescription: "Description B." });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes for different model authors", () => {
    const a = makeProvenanceInput({ modelAuthor: "Author A" });
    const b = makeProvenanceInput({ modelAuthor: "Author B" });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes for different model licenses", () => {
    const a = makeProvenanceInput({ modelLicense: "Apache-2.0" });
    const b = makeProvenanceInput({ modelLicense: "MIT" });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes when training datasets change", () => {
    const a = makeProvenanceInput();
    const b = makeProvenanceInput({
      trainingDatasets: [makeDatasetReference({ name: "Different Dataset" })],
    });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes when performance metrics change", () => {
    const a = makeProvenanceInput();
    const b = makeProvenanceInput({
      performanceMetrics: [makePerformanceMetric({ value: 0.50 })],
    });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes when ethical considerations change", () => {
    const a = makeProvenanceInput();
    const b = makeProvenanceInput({
      ethicalConsiderations: [
        makeEthicalConsideration({ category: "privacy" }),
      ],
    });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("produces different hashes when external references change", () => {
    const a = makeProvenanceInput();
    const b = makeProvenanceInput({
      externalReferences: [
        makeExternalReference({ url: "https://example.com/other" }),
      ],
    });
    expect(computeProvenanceHash(a)).not.toBe(computeProvenanceHash(b));
  });

  it("distinguishes null from string for optional fields", () => {
    const withNull = makeProvenanceInput({ modelDescription: null });
    const withString = makeProvenanceInput({ modelDescription: "" });
    expect(computeProvenanceHash(withNull)).not.toBe(
      computeProvenanceHash(withString)
    );
  });
});

describe("provenance hash uses SHA-256 (NIST verification)", () => {
  it("provenance hash matches manual SHA-256 of serialized content", () => {
    const input = makeProvenanceInput();
    const serialized = serializeProvenanceForHashing(input);
    const manualHash = sha256(serialized);
    const prov = createProvenance(input);
    expect(prov.provenanceHash).toBe(manualHash);
  });
});
