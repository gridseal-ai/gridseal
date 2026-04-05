import { describe, expect, it } from "vitest";
import {
  createCertificate,
  verifyCertificate,
  computeCertificateHash,
  serializeCertificateForHashing,
} from "../../src/certificate/reasoning-certificate.js";
import {
  confidenceLevelFromScore,
  generateCertificate,
} from "../../src/certificate/engine.js";
import type { DecisionContext, Premise, TraceStep } from "../../src/certificate/engine.js";
import {
  makeClaim,
  makeEvidence,
  makeUnsupportedClaim,
  makeAssumption,
  makeLimitation,
  makeConfidenceAssessment,
  makeCertificateInput,
} from "./reasoning-certificate-helpers.js";

describe("createCertificate boundary inputs", () => {
  it("handles certificate with unicode in all string fields", () => {
    const input = makeCertificateInput({
      certificateId: "cert-\u4f60\u597d",
      modelId: "\u00e9l\u00e8ve-model",
      modelProvider: "fournisseur-\u00e7",
      claims: [makeClaim({ statement: "\u4f60\u597d\u4e16\u754c \ud83d\ude80 decision made" })],
      supportingEvidence: [makeEvidence({ description: "\u00e9vidence avec accents" })],
      unsupportedClaims: [makeUnsupportedClaim({ statement: "\u00fc\u00f6\u00e4 unsupported" })],
      assumptions: [makeAssumption({ statement: "Donn\u00e9es normalis\u00e9es" })],
      limitations: [makeLimitation({ description: "\u00c9valuation limit\u00e9e" })],
    });
    const cert = createCertificate(input);
    expect(verifyCertificate(cert)).toBe(true);
    expect(cert.claims[0].statement).toContain("\u4f60\u597d\u4e16\u754c");
  });

  it("handles certificate with very long strings (5K characters)", () => {
    const longStr = "x".repeat(5000);
    const input = makeCertificateInput({
      claims: [makeClaim({ statement: longStr })],
      supportingEvidence: [makeEvidence({ description: longStr })],
    });
    const cert = createCertificate(input);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("handles certificate with 100 claims and 100 evidence items", () => {
    const claims = Array.from({ length: 100 }, (_, i) =>
      makeClaim({ claimId: `claim-${i}`, statement: `Claim number ${i}` }),
    );
    const evidence = Array.from({ length: 100 }, (_, i) =>
      makeEvidence({ evidenceId: `ev-${i}`, description: `Evidence number ${i}` }),
    );
    const input = makeCertificateInput({ claims, supportingEvidence: evidence });
    const cert = createCertificate(input);
    expect(cert.claims).toHaveLength(100);
    expect(cert.supportingEvidence).toHaveLength(100);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("handles certificate with empty string fields", () => {
    const input = makeCertificateInput({
      certificateId: "",
      modelId: "",
      modelProvider: "",
    });
    const cert = createCertificate(input);
    expect(verifyCertificate(cert)).toBe(true);
    expect(cert.certificateId).toBe("");
  });

  it("handles certificate with special characters in statements", () => {
    const input = makeCertificateInput({
      claims: [makeClaim({
        statement: 'Claim with "quotes", <tags>, & entities\nnewline',
      })],
    });
    const cert = createCertificate(input);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("detects single-character tampering in claim statement", () => {
    const cert = createCertificate(makeCertificateInput({
      claims: [makeClaim({ statement: "The input is category A." })],
    }));
    const tampered = {
      ...cert,
      claims: [{ ...cert.claims[0], statement: "The input is category B." }],
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("detects reordering of evidence items", () => {
    const ev1 = makeEvidence({ evidenceId: "ev-1", description: "First" });
    const ev2 = makeEvidence({ evidenceId: "ev-2", description: "Second" });
    const certAB = createCertificate(makeCertificateInput({
      supportingEvidence: [ev1, ev2],
    }));
    const certBA = createCertificate(makeCertificateInput({
      supportingEvidence: [ev2, ev1],
    }));
    expect(certAB.certificateHash).not.toBe(certBA.certificateHash);
  });

  it("distinguishes null source from empty string source in evidence", () => {
    const withNull = createCertificate(makeCertificateInput({
      supportingEvidence: [makeEvidence({ source: null })],
    }));
    const withEmpty = createCertificate(makeCertificateInput({
      supportingEvidence: [makeEvidence({ source: "" })],
    }));
    expect(withNull.certificateHash).not.toBe(withEmpty.certificateHash);
  });
});

describe("serializeCertificateForHashing determinism", () => {
  it("produces identical output across 100 identical calls", () => {
    const input = makeCertificateInput();
    const baseline = serializeCertificateForHashing(input);
    for (let i = 0; i < 100; i++) {
      expect(serializeCertificateForHashing(input)).toBe(baseline);
    }
  });

  it("produces identical hashes for certificates created from same input at different times", () => {
    const input = makeCertificateInput();
    const hash1 = computeCertificateHash(input);
    const hash2 = computeCertificateHash(input);
    expect(hash1).toBe(hash2);
  });
});

describe("confidenceLevelFromScore exact boundaries", () => {
  it("maps exactly 0.0 to very_low", () => {
    expect(confidenceLevelFromScore(0.0)).toBe("very_low");
  });

  it("maps exactly 0.2 to low (boundary)", () => {
    expect(confidenceLevelFromScore(0.2)).toBe("low");
  });

  it("maps exactly 0.4 to medium (boundary)", () => {
    expect(confidenceLevelFromScore(0.4)).toBe("medium");
  });

  it("maps exactly 0.6 to high (boundary)", () => {
    expect(confidenceLevelFromScore(0.6)).toBe("high");
  });

  it("maps exactly 0.8 to very_high (boundary)", () => {
    expect(confidenceLevelFromScore(0.8)).toBe("very_high");
  });

  it("maps exactly 1.0 to very_high", () => {
    expect(confidenceLevelFromScore(1.0)).toBe("very_high");
  });

  it("does not throw for NaN (NaN bypasses range check)", () => {
    // NaN < 0 is false, NaN > 1 is false, so the guard passes.
    // NaN < 0.2 is false, etc., so it falls through to "very_high".
    // This documents actual behavior, not ideal behavior.
    expect(confidenceLevelFromScore(NaN)).toBe("very_high");
  });
});

describe("generateCertificate boundary inputs", () => {
  function makePremise(overrides?: Partial<Premise>): Premise {
    return {
      id: "input_data_01",
      statement: "Input features extracted.",
      source: "input_data",
      required: true,
      ...overrides,
    };
  }

  function makeTraceStep(overrides?: Partial<TraceStep>): TraceStep {
    return {
      stepId: "feature_analysis_01",
      description: "Analyzed features.",
      inputRefs: ["input_data_01"],
      outputRef: "result",
      ...overrides,
    };
  }

  function makeContext(overrides?: Partial<DecisionContext>): DecisionContext {
    return {
      certificateId: "cert-boundary-test",
      timestamp: "2026-04-05T10:00:00.000Z",
      modelId: "test-model",
      modelProvider: "test-provider",
      decisionType: "classification",
      premises: [makePremise()],
      executionTrace: [makeTraceStep()],
      conclusion: {
        statement: "Test conclusion.",
        supportingPremiseIds: ["input_data_01"],
        supportingTraceStepIds: ["feature_analysis_01"],
      },
      unsupportedClaims: [],
      assumptions: [],
      limitations: [],
      confidenceScore: 0.5,
      ...overrides,
    };
  }

  it("generates valid certificate with minimum inputs (1 premise, 1 trace step)", () => {
    const cert = generateCertificate(makeContext());
    expect(verifyCertificate(cert)).toBe(true);
    expect(cert.claims.length).toBe(2); // 1 premise + 1 conclusion
  });

  it("generates valid certificate with confidence score exactly 0", () => {
    const cert = generateCertificate(makeContext({ confidenceScore: 0 }));
    expect(verifyCertificate(cert)).toBe(true);
    expect(cert.confidenceAssessment.level).toBe("very_low");
    expect(cert.confidenceAssessment.score).toBe(0);
  });

  it("generates valid certificate with confidence score exactly 1", () => {
    const cert = generateCertificate(makeContext({ confidenceScore: 1 }));
    expect(verifyCertificate(cert)).toBe(true);
    expect(cert.confidenceAssessment.level).toBe("very_high");
    expect(cert.confidenceAssessment.score).toBe(1);
  });

  it("generates deterministic certificates for identical inputs", () => {
    const context = makeContext();
    const cert1 = generateCertificate(context);
    const cert2 = generateCertificate(context);
    expect(cert1.certificateHash).toBe(cert2.certificateHash);
  });
});
