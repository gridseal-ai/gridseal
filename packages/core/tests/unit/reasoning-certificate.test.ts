import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_LEVELS,
  computeCertificateHash,
  serializeCertificateForHashing,
} from "../../src/certificate/reasoning-certificate.js";
import type {
  ConfidenceLevel,
} from "../../src/certificate/reasoning-certificate.js";
import { sha256 } from "../../src/chain/hash.js";
import {
  makeClaim,
  makeEvidence,
  makeUnsupportedClaim,
  makeAssumption,
  makeLimitation,
  makeConfidenceAssessment,
  makeCertificateInput,
} from "./reasoning-certificate-helpers.js";

describe("CONFIDENCE_LEVELS", () => {
  it("contains exactly 5 levels in ascending order", () => {
    expect(CONFIDENCE_LEVELS).toEqual([
      "very_low",
      "low",
      "medium",
      "high",
      "very_high",
    ]);
    expect(CONFIDENCE_LEVELS).toHaveLength(5);
  });

  it("is a readonly tuple (frozen at the type level)", () => {
    const levels: ReadonlyArray<ConfidenceLevel> = CONFIDENCE_LEVELS;
    expect(levels).toBeDefined();
  });
});

describe("ReasoningCertificate types", () => {
  it("Claim has claimId, statement, and supportingEvidenceIds", () => {
    const claim = makeClaim();
    expect(claim.claimId).toBe("claim-001");
    expect(claim.statement).toBe(
      "The input data is consistent with category A."
    );
    expect(claim.supportingEvidenceIds).toEqual(["ev-001"]);
  });

  it("Evidence has evidenceId, evidenceType, description, and optional source", () => {
    const evidence = makeEvidence();
    expect(evidence.evidenceId).toBe("ev-001");
    expect(evidence.evidenceType).toBe("data_observation");
    expect(evidence.description).toContain("Feature vector");
    expect(evidence.source).toBeNull();
  });

  it("Evidence source can reference an external URL", () => {
    const evidence = makeEvidence({
      source: "https://example.com/report.pdf",
    });
    expect(evidence.source).toBe("https://example.com/report.pdf");
  });

  it("UnsupportedClaim has statement and reason", () => {
    const unsupported = makeUnsupportedClaim();
    expect(unsupported.statement).toContain("category B");
    expect(unsupported.reason).toContain("Insufficient evidence");
  });

  it("Assumption has statement and criticality at low, medium, or high", () => {
    const low = makeAssumption({ criticality: "low" });
    const med = makeAssumption({ criticality: "medium" });
    const high = makeAssumption({ criticality: "high" });
    expect(low.criticality).toBe("low");
    expect(med.criticality).toBe("medium");
    expect(high.criticality).toBe("high");
  });

  it("Limitation has description and impact", () => {
    const limitation = makeLimitation();
    expect(limitation.description).toContain("adversarial");
    expect(limitation.impact).toContain("unreliable");
  });

  it("ConfidenceAssessment has level, score, and rationale", () => {
    const assessment = makeConfidenceAssessment();
    expect(assessment.level).toBe("high");
    expect(assessment.score).toBe(0.92);
    expect(assessment.rationale).toContain("Strong feature similarity");
  });

  it("ConfidenceAssessment score is in [0, 1] range by convention", () => {
    const low = makeConfidenceAssessment({ score: 0.0, level: "very_low" });
    const high = makeConfidenceAssessment({ score: 1.0, level: "very_high" });
    expect(low.score).toBe(0.0);
    expect(high.score).toBe(1.0);
  });
});

describe("serializeCertificateForHashing", () => {
  it("produces a deterministic string with fields in fixed order", () => {
    const input = makeCertificateInput();
    const serialized = serializeCertificateForHashing(input);

    expect(serialized.startsWith("{")).toBe(true);
    expect(serialized.endsWith("}")).toBe(true);

    const certIdPos = serialized.indexOf('"certificateId"');
    const timestampPos = serialized.indexOf('"timestamp"');
    const modelIdPos = serialized.indexOf('"modelId"');
    const claimsPos = serialized.indexOf('"claims"');
    const assessmentPos = serialized.indexOf('"confidenceAssessment"');

    expect(certIdPos).toBeLessThan(timestampPos);
    expect(timestampPos).toBeLessThan(modelIdPos);
    expect(modelIdPos).toBeLessThan(claimsPos);
    expect(claimsPos).toBeLessThan(assessmentPos);
  });

  it("produces identical output for identical inputs", () => {
    const a = serializeCertificateForHashing(makeCertificateInput());
    const b = serializeCertificateForHashing(makeCertificateInput());
    expect(a).toBe(b);
  });

  it("includes all 10 hashable fields (11 total minus certificateHash)", () => {
    const serialized = serializeCertificateForHashing(makeCertificateInput());
    const expectedFields = [
      "certificateId",
      "timestamp",
      "modelId",
      "modelProvider",
      "claims",
      "supportingEvidence",
      "unsupportedClaims",
      "assumptions",
      "limitations",
      "confidenceAssessment",
    ];
    for (const field of expectedFields) {
      expect(serialized).toContain(`"${field}":`);
    }
    expect(serialized).not.toContain('"certificateHash"');
  });

  it("serializes nested claim objects with sorted keys", () => {
    const input = makeCertificateInput();
    const serialized = serializeCertificateForHashing(input);

    expect(serialized).toContain('"claimId"');
    expect(serialized).toContain('"statement"');
    expect(serialized).toContain('"supportingEvidenceIds"');
  });

  it("serializes evidence objects with sorted keys including null source", () => {
    const input = makeCertificateInput();
    const serialized = serializeCertificateForHashing(input);
    expect(serialized).toContain('"evidenceId"');
    expect(serialized).toContain('"evidenceType"');
    expect(serialized).toContain('"source":null');
  });
});

describe("computeCertificateHash", () => {
  it("returns a 64-character lowercase hex string", () => {
    const hash = computeCertificateHash(makeCertificateInput());
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same input", () => {
    const input = makeCertificateInput();
    expect(computeCertificateHash(input)).toBe(
      computeCertificateHash(input)
    );
  });

  it("equals SHA-256 of the serialized certificate", () => {
    const input = makeCertificateInput();
    const serialized = serializeCertificateForHashing(input);
    expect(computeCertificateHash(input)).toBe(sha256(serialized));
  });

  it("produces different hashes for different certificateIds", () => {
    const a = makeCertificateInput({ certificateId: "cert-aaa" });
    const b = makeCertificateInput({ certificateId: "cert-bbb" });
    expect(computeCertificateHash(a)).not.toBe(computeCertificateHash(b));
  });

  it("produces different hashes for different timestamps", () => {
    const a = makeCertificateInput({
      timestamp: "2026-04-04T12:00:00.000Z",
    });
    const b = makeCertificateInput({
      timestamp: "2026-04-04T13:00:00.000Z",
    });
    expect(computeCertificateHash(a)).not.toBe(computeCertificateHash(b));
  });

  it("produces different hashes for different model info", () => {
    const baseline = computeCertificateHash(makeCertificateInput());
    expect(
      computeCertificateHash(makeCertificateInput({ modelId: "gpt-4o" }))
    ).not.toBe(baseline);
    expect(
      computeCertificateHash(
        makeCertificateInput({ modelProvider: "openai" })
      )
    ).not.toBe(baseline);
  });

  it("produces different hashes when claims change", () => {
    const a = makeCertificateInput();
    const b = makeCertificateInput({
      claims: [
        makeClaim({ statement: "A completely different claim." }),
      ],
    });
    expect(computeCertificateHash(a)).not.toBe(computeCertificateHash(b));
  });

  it("produces different hashes when evidence changes", () => {
    const a = makeCertificateInput();
    const b = makeCertificateInput({
      supportingEvidence: [
        makeEvidence({ description: "Different evidence." }),
      ],
    });
    expect(computeCertificateHash(a)).not.toBe(computeCertificateHash(b));
  });

  it("produces different hashes when unsupported claims change", () => {
    const a = makeCertificateInput();
    const b = makeCertificateInput({
      unsupportedClaims: [
        makeUnsupportedClaim({ reason: "Different reason." }),
      ],
    });
    expect(computeCertificateHash(a)).not.toBe(computeCertificateHash(b));
  });

  it("produces different hashes when assumptions change", () => {
    const a = makeCertificateInput();
    const b = makeCertificateInput({
      assumptions: [makeAssumption({ criticality: "high" })],
    });
    expect(computeCertificateHash(a)).not.toBe(computeCertificateHash(b));
  });

  it("produces different hashes when limitations change", () => {
    const a = makeCertificateInput();
    const b = makeCertificateInput({
      limitations: [makeLimitation({ impact: "Different impact." })],
    });
    expect(computeCertificateHash(a)).not.toBe(computeCertificateHash(b));
  });

  it("produces different hashes when confidence assessment changes", () => {
    const a = makeCertificateInput();
    const b = makeCertificateInput({
      confidenceAssessment: makeConfidenceAssessment({
        level: "low",
        score: 0.3,
      }),
    });
    expect(computeCertificateHash(a)).not.toBe(computeCertificateHash(b));
  });
});

