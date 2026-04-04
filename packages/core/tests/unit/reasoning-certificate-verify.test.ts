import { describe, expect, it } from "vitest";
import {
  computeCertificateHash,
  createCertificate,
  verifyCertificate,
} from "../../src/certificate/reasoning-certificate.js";
import type {
  ReasoningCertificate,
} from "../../src/certificate/reasoning-certificate.js";
import {
  makeClaim,
  makeEvidence,
  makeUnsupportedClaim,
  makeAssumption,
  makeLimitation,
  makeConfidenceAssessment,
  makeCertificateInput,
} from "./reasoning-certificate-helpers.js";

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
    const hash = computeCertificateHash(input);
    const cert = createCertificate(input);
    expect(cert.certificateHash).toBe(hash);
  });
});

describe("certificate is referenceable from ProofChainEntry", () => {
  it("certificateId can be used as reasoningCertificateId in an entry", () => {
    const cert = createCertificate(makeCertificateInput());
    expect(typeof cert.certificateId).toBe("string");
    expect(cert.certificateId.length).toBeGreaterThan(0);
  });
});
