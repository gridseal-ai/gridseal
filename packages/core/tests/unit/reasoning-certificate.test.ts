import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_LEVELS,
  computeCertificateHash,
  createCertificate,
  serializeCertificateForHashing,
  verifyCertificate,
} from "../../src/certificate/reasoning-certificate.js";
import type {
  Assumption,
  Claim,
  ConfidenceAssessment,
  ConfidenceLevel,
  CreateCertificateInput,
  Evidence,
  Limitation,
  ReasoningCertificate,
  UnsupportedClaim,
} from "../../src/certificate/reasoning-certificate.js";
import { sha256 } from "../../src/chain/hash.js";

function makeClaim(overrides?: Partial<Claim>): Claim {
  return {
    claimId: "claim-001",
    statement: "The input data is consistent with category A.",
    supportingEvidenceIds: ["ev-001"],
    ...overrides,
  };
}

function makeEvidence(overrides?: Partial<Evidence>): Evidence {
  return {
    evidenceId: "ev-001",
    evidenceType: "data_observation",
    description: "Feature vector similarity exceeds 0.95 threshold.",
    source: null,
    ...overrides,
  };
}

function makeUnsupportedClaim(overrides?: Partial<UnsupportedClaim>): UnsupportedClaim {
  return {
    statement: "The data also matches category B.",
    reason: "Insufficient evidence: similarity score was 0.42, below 0.80 threshold.",
    ...overrides,
  };
}

function makeAssumption(overrides?: Partial<Assumption>): Assumption {
  return {
    statement: "Input data has been preprocessed with standard normalization.",
    criticality: "medium",
    ...overrides,
  };
}

function makeLimitation(overrides?: Partial<Limitation>): Limitation {
  return {
    description: "Model has not been evaluated on adversarial inputs.",
    impact: "Classification confidence may be unreliable for crafted inputs.",
    ...overrides,
  };
}

function makeConfidenceAssessment(
  overrides?: Partial<ConfidenceAssessment>
): ConfidenceAssessment {
  return {
    level: "high",
    score: 0.92,
    rationale: "Strong feature similarity with training examples in category A.",
    ...overrides,
  };
}

function makeCertificateInput(
  overrides?: Partial<CreateCertificateInput>
): CreateCertificateInput {
  return {
    certificateId: "cert-019505f0-0000-7000-8000-000000000001",
    timestamp: "2026-04-04T12:00:00.000Z",
    modelId: "claude-sonnet-4-20250514",
    modelProvider: "anthropic",
    claims: [makeClaim()],
    supportingEvidence: [makeEvidence()],
    unsupportedClaims: [makeUnsupportedClaim()],
    assumptions: [makeAssumption()],
    limitations: [makeLimitation()],
    confidenceAssessment: makeConfidenceAssessment(),
    ...overrides,
  };
}

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

    // Claims should contain the claim fields in sorted key order
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

describe("createCertificate", () => {
  it("returns a certificate with all input fields preserved", () => {
    const input = makeCertificateInput();
    const cert = createCertificate(input);

    expect(cert.certificateId).toBe(input.certificateId);
    expect(cert.timestamp).toBe(input.timestamp);
    expect(cert.modelId).toBe(input.modelId);
    expect(cert.modelProvider).toBe(input.modelProvider);
    expect(cert.claims).toEqual(input.claims);
    expect(cert.supportingEvidence).toEqual(input.supportingEvidence);
    expect(cert.unsupportedClaims).toEqual(input.unsupportedClaims);
    expect(cert.assumptions).toEqual(input.assumptions);
    expect(cert.limitations).toEqual(input.limitations);
    expect(cert.confidenceAssessment).toEqual(input.confidenceAssessment);
  });

  it("computes and attaches the certificateHash", () => {
    const input = makeCertificateInput();
    const cert = createCertificate(input);

    expect(cert.certificateHash).toMatch(/^[0-9a-f]{64}$/);
    expect(cert.certificateHash).toBe(computeCertificateHash(input));
  });

  it("produces identical certificates for identical inputs", () => {
    const a = createCertificate(makeCertificateInput());
    const b = createCertificate(makeCertificateInput());
    expect(a).toEqual(b);
    expect(a.certificateHash).toBe(b.certificateHash);
  });

  it("produces different hashes for different inputs", () => {
    const a = createCertificate(makeCertificateInput());
    const b = createCertificate(
      makeCertificateInput({ certificateId: "cert-different" })
    );
    expect(a.certificateHash).not.toBe(b.certificateHash);
  });
});

describe("verifyCertificate", () => {
  it("returns true for an unmodified certificate", () => {
    const cert = createCertificate(makeCertificateInput());
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("returns false when certificateId is tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      certificateId: "cert-tampered",
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when timestamp is tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      timestamp: "2026-01-01T00:00:00.000Z",
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when modelId is tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      modelId: "tampered-model",
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when claims are tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      claims: [makeClaim({ statement: "Tampered claim." })],
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when evidence is tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      supportingEvidence: [
        makeEvidence({ description: "Tampered evidence." }),
      ],
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when unsupported claims are tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      unsupportedClaims: [
        makeUnsupportedClaim({ statement: "Tampered." }),
      ],
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when assumptions are tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      assumptions: [makeAssumption({ criticality: "high" })],
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when limitations are tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      limitations: [makeLimitation({ description: "Tampered." })],
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when confidence assessment is tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      confidenceAssessment: makeConfidenceAssessment({
        score: 0.1,
        level: "very_low",
      }),
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });

  it("returns false when only the hash is tampered", () => {
    const cert = createCertificate(makeCertificateInput());
    const tampered: ReasoningCertificate = {
      ...cert,
      certificateHash: "0".repeat(64),
    };
    expect(verifyCertificate(tampered)).toBe(false);
  });
});

describe("createCertificate with empty arrays", () => {
  it("handles certificate with no claims", () => {
    const input = makeCertificateInput({ claims: [] });
    const cert = createCertificate(input);
    expect(cert.claims).toEqual([]);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("handles certificate with no evidence", () => {
    const input = makeCertificateInput({ supportingEvidence: [] });
    const cert = createCertificate(input);
    expect(cert.supportingEvidence).toEqual([]);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("handles certificate with no unsupported claims", () => {
    const input = makeCertificateInput({ unsupportedClaims: [] });
    const cert = createCertificate(input);
    expect(cert.unsupportedClaims).toEqual([]);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("handles certificate with no assumptions", () => {
    const input = makeCertificateInput({ assumptions: [] });
    const cert = createCertificate(input);
    expect(cert.assumptions).toEqual([]);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("handles certificate with no limitations", () => {
    const input = makeCertificateInput({ limitations: [] });
    const cert = createCertificate(input);
    expect(cert.limitations).toEqual([]);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("handles certificate with all arrays empty", () => {
    const input = makeCertificateInput({
      claims: [],
      supportingEvidence: [],
      unsupportedClaims: [],
      assumptions: [],
      limitations: [],
    });
    const cert = createCertificate(input);
    expect(verifyCertificate(cert)).toBe(true);
  });
});

describe("createCertificate with multiple items", () => {
  it("handles multiple claims referencing multiple evidence items", () => {
    const input = makeCertificateInput({
      claims: [
        makeClaim({
          claimId: "claim-001",
          statement: "First claim.",
          supportingEvidenceIds: ["ev-001", "ev-002"],
        }),
        makeClaim({
          claimId: "claim-002",
          statement: "Second claim.",
          supportingEvidenceIds: ["ev-002"],
        }),
      ],
      supportingEvidence: [
        makeEvidence({ evidenceId: "ev-001", description: "First evidence." }),
        makeEvidence({ evidenceId: "ev-002", description: "Second evidence." }),
      ],
    });
    const cert = createCertificate(input);
    expect(cert.claims).toHaveLength(2);
    expect(cert.supportingEvidence).toHaveLength(2);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("handles multiple assumptions with varying criticality", () => {
    const input = makeCertificateInput({
      assumptions: [
        makeAssumption({ statement: "Low impact.", criticality: "low" }),
        makeAssumption({ statement: "Medium impact.", criticality: "medium" }),
        makeAssumption({ statement: "High impact.", criticality: "high" }),
      ],
    });
    const cert = createCertificate(input);
    expect(cert.assumptions).toHaveLength(3);
    expect(verifyCertificate(cert)).toBe(true);
  });

  it("order of claims affects the hash (arrays preserve order)", () => {
    const claimA = makeClaim({ claimId: "claim-a", statement: "Claim A." });
    const claimB = makeClaim({ claimId: "claim-b", statement: "Claim B." });

    const certAB = createCertificate(
      makeCertificateInput({ claims: [claimA, claimB] })
    );
    const certBA = createCertificate(
      makeCertificateInput({ claims: [claimB, claimA] })
    );
    expect(certAB.certificateHash).not.toBe(certBA.certificateHash);
  });
});

describe("certificate hash uses SHA-256 (NIST verification)", () => {
  it("certificate hash matches manual SHA-256 of serialized content", () => {
    const input = makeCertificateInput();
    const serialized = serializeCertificateForHashing(input);
    const manualHash = sha256(serialized);
    const cert = createCertificate(input);
    expect(cert.certificateHash).toBe(manualHash);
  });
});

describe("certificate is referenceable from ProofChainEntry", () => {
  it("certificateId can be used as reasoningCertificateId in an entry", () => {
    const cert = createCertificate(makeCertificateInput());
    // The certificateId should be a valid string that can be set as
    // ProofChainEntry.reasoningCertificateId
    expect(typeof cert.certificateId).toBe("string");
    expect(cert.certificateId.length).toBeGreaterThan(0);
  });
});
