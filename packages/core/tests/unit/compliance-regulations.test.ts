import { describe, expect, it } from "vitest";
import {
  coloradoSb205,
  COLORADO_SB205_REQUIREMENTS,
} from "../../src/compliance/regulations/colorado-sb205.js";
import {
  nistAiRmf,
  NIST_AI_RMF_REQUIREMENTS,
} from "../../src/compliance/regulations/nist-ai-rmf.js";
import {
  euAiAct,
  EU_AI_ACT_REQUIREMENTS,
} from "../../src/compliance/regulations/eu-ai-act.js";
import type {
  Regulation,
  RegulatoryRequirement,
} from "../../src/compliance/types.js";
import {
  SECTORS,
  RISK_LEVELS,
  DATA_TYPES,
  AUTHORITY_LEVELS,
} from "../../src/compliance/types.js";

/** Validate structural invariants that apply to every requirement. */
function assertValidRequirement(req: RegulatoryRequirement): void {
  expect(req.requirementId).toBeTruthy();
  expect(req.regulationId).toBeTruthy();
  expect(req.sectionRef).toBeTruthy();
  expect(req.title).toBeTruthy();
  expect(req.description.length).toBeGreaterThan(20);
  expect(Array.isArray(req.applicableSectors)).toBe(true);
  expect(Array.isArray(req.applicableDecisionTypes)).toBe(true);
  expect(Array.isArray(req.applicableDataTypes)).toBe(true);
  expect(Array.isArray(req.applicableAuthorityLevels)).toBe(true);
  expect(Array.isArray(req.requiredFields)).toBe(true);
  expect(req.requiredFields.length).toBeGreaterThan(0);
  expect(typeof req.requiresReasoningCertificate).toBe("boolean");
  expect(typeof req.requiresProvenance).toBe("boolean");
}

/** Validate structural invariants for a regulation. */
function assertValidRegulation(reg: Regulation): void {
  expect(reg.regulationId).toBeTruthy();
  expect(reg.name).toBeTruthy();
  expect(reg.jurisdiction).toBeTruthy();
  expect(reg.version).toBeTruthy();
  expect(reg.description.length).toBeGreaterThan(20);
  expect(reg.requirements.length).toBeGreaterThan(0);
  for (const req of reg.requirements) {
    expect(req.regulationId).toBe(reg.regulationId);
    assertValidRequirement(req);
  }
}

describe("Compliance type constants", () => {
  it("exports sector values", () => {
    expect(SECTORS).toContain("healthcare");
    expect(SECTORS).toContain("finance");
    expect(SECTORS).toContain("general");
    expect(SECTORS.length).toBeGreaterThanOrEqual(9);
  });

  it("exports risk levels in ascending severity", () => {
    expect(RISK_LEVELS).toEqual(["minimal", "limited", "high", "unacceptable"]);
  });

  it("exports data types", () => {
    expect(DATA_TYPES).toContain("personal");
    expect(DATA_TYPES).toContain("health");
    expect(DATA_TYPES).toContain("financial");
    expect(DATA_TYPES).toContain("biometric");
  });

  it("exports authority levels", () => {
    expect(AUTHORITY_LEVELS).toEqual([
      "autonomous",
      "human_in_the_loop",
      "human_on_the_loop",
      "advisory",
    ]);
  });
});

describe("Colorado AI Act (SB 205)", () => {
  it("has correct regulation metadata", () => {
    assertValidRegulation(coloradoSb205);
    expect(coloradoSb205.regulationId).toBe("colorado-sb205");
    expect(coloradoSb205.jurisdiction).toContain("Colorado");
  });

  it("defines 6 requirements covering Section 6-1-1703", () => {
    expect(COLORADO_SB205_REQUIREMENTS).toHaveLength(6);
    for (const req of COLORADO_SB205_REQUIREMENTS) {
      expect(req.sectionRef).toMatch(/Section 6-1-1703/);
    }
  });

  it("has unique requirement IDs", () => {
    const ids = COLORADO_SB205_REQUIREMENTS.map((r) => r.requirementId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("impact assessment requires provenance and high risk", () => {
    const req = COLORADO_SB205_REQUIREMENTS.find(
      (r) => r.requirementId === "colorado-sb205-6-1-1703-a",
    );
    expect(req).toBeDefined();
    expect(req!.minimumRiskLevel).toBe("high");
    expect(req!.requiresProvenance).toBe(true);
    expect(req!.requiredFields).toContain("modelId");
  });

  it("explanation of decision requires reasoning certificate", () => {
    const req = COLORADO_SB205_REQUIREMENTS.find(
      (r) => r.requirementId === "colorado-sb205-6-1-1703-c",
    );
    expect(req).toBeDefined();
    expect(req!.requiresReasoningCertificate).toBe(true);
    expect(req!.requiredFields).toContain("reasoningCertificateId");
    expect(req!.requiredFields).toContain("confidenceScore");
  });

  it("appeal process targets autonomous decisions only", () => {
    const req = COLORADO_SB205_REQUIREMENTS.find(
      (r) => r.requirementId === "colorado-sb205-6-1-1703-d",
    );
    expect(req).toBeDefined();
    expect(req!.applicableAuthorityLevels).toEqual(["autonomous"]);
  });

  it("all requirements target high-risk minimum", () => {
    for (const req of COLORADO_SB205_REQUIREMENTS) {
      expect(req.minimumRiskLevel).toBe("high");
    }
  });
});

describe("NIST AI RMF", () => {
  it("has correct regulation metadata", () => {
    assertValidRegulation(nistAiRmf);
    expect(nistAiRmf.regulationId).toBe("nist-ai-rmf");
    expect(nistAiRmf.jurisdiction).toContain("United States");
  });

  it("defines 19 requirements across 4 functions", () => {
    expect(NIST_AI_RMF_REQUIREMENTS).toHaveLength(19);
  });

  it("has unique requirement IDs", () => {
    const ids = NIST_AI_RMF_REQUIREMENTS.map((r) => r.requirementId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers all 4 functions: Govern, Map, Measure, Manage", () => {
    const prefixes = NIST_AI_RMF_REQUIREMENTS.map((r) =>
      r.sectionRef.split(" ")[0],
    );
    const uniqueFunctions = new Set(prefixes);
    expect(uniqueFunctions).toContain("GOVERN");
    expect(uniqueFunctions).toContain("MAP");
    expect(uniqueFunctions).toContain("MEASURE");
    expect(uniqueFunctions).toContain("MANAGE");
  });

  it("Govern function has 6 subcategories", () => {
    const govern = NIST_AI_RMF_REQUIREMENTS.filter((r) =>
      r.sectionRef.startsWith("GOVERN"),
    );
    expect(govern).toHaveLength(6);
  });

  it("Map function has 5 subcategories", () => {
    const map = NIST_AI_RMF_REQUIREMENTS.filter((r) =>
      r.sectionRef.startsWith("MAP"),
    );
    expect(map).toHaveLength(5);
  });

  it("Measure function has 4 subcategories", () => {
    const measure = NIST_AI_RMF_REQUIREMENTS.filter((r) =>
      r.sectionRef.startsWith("MEASURE"),
    );
    expect(measure).toHaveLength(4);
  });

  it("Manage function has 4 subcategories", () => {
    const manage = NIST_AI_RMF_REQUIREMENTS.filter((r) =>
      r.sectionRef.startsWith("MANAGE"),
    );
    expect(manage).toHaveLength(4);
  });

  it("does not mandate a minimum risk level (voluntary framework)", () => {
    for (const req of NIST_AI_RMF_REQUIREMENTS) {
      expect(req.minimumRiskLevel).toBeNull();
    }
  });

  it("Manage 2 requires reasoning certificate for risk mitigation", () => {
    const req = NIST_AI_RMF_REQUIREMENTS.find(
      (r) => r.requirementId === "nist-ai-rmf-manage-2",
    );
    expect(req).toBeDefined();
    expect(req!.requiresReasoningCertificate).toBe(true);
  });

  it("Measure 1 requires provenance for performance metrics", () => {
    const req = NIST_AI_RMF_REQUIREMENTS.find(
      (r) => r.requirementId === "nist-ai-rmf-measure-1",
    );
    expect(req).toBeDefined();
    expect(req!.requiresProvenance).toBe(true);
    expect(req!.requiredFields).toContain("confidenceScore");
  });
});

describe("EU AI Act (Articles 12 & 13)", () => {
  it("has correct regulation metadata", () => {
    assertValidRegulation(euAiAct);
    expect(euAiAct.regulationId).toBe("eu-ai-act");
    expect(euAiAct.jurisdiction).toContain("European Union");
  });

  it("defines 8 requirements across Articles 12 and 13", () => {
    expect(EU_AI_ACT_REQUIREMENTS).toHaveLength(8);
  });

  it("has unique requirement IDs", () => {
    const ids = EU_AI_ACT_REQUIREMENTS.map((r) => r.requirementId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("Article 12 requirements focus on record-keeping", () => {
    const art12 = EU_AI_ACT_REQUIREMENTS.filter((r) =>
      r.sectionRef.startsWith("Article 12"),
    );
    expect(art12).toHaveLength(4);
    for (const req of art12) {
      expect(req.title.toLowerCase()).toMatch(
        /log|traceab|record|retention/,
      );
    }
  });

  it("Article 13 requirements focus on transparency", () => {
    const art13 = EU_AI_ACT_REQUIREMENTS.filter((r) =>
      r.sectionRef.startsWith("Article 13"),
    );
    expect(art13).toHaveLength(4);
  });

  it("all requirements mandate high-risk minimum", () => {
    for (const req of EU_AI_ACT_REQUIREMENTS) {
      expect(req.minimumRiskLevel).toBe("high");
    }
  });

  it("Article 12(1) requires core chain integrity fields", () => {
    const req = EU_AI_ACT_REQUIREMENTS.find(
      (r) => r.requirementId === "eu-ai-act-art12-1",
    );
    expect(req).toBeDefined();
    expect(req!.requiredFields).toContain("entryId");
    expect(req!.requiredFields).toContain("chainId");
    expect(req!.requiredFields).toContain("timestamp");
    expect(req!.requiredFields).toContain("entryHash");
    expect(req!.requiredFields).toContain("previousHash");
  });

  it("Article 12(3) requires input/output hashes for decisions affecting persons", () => {
    const req = EU_AI_ACT_REQUIREMENTS.find(
      (r) => r.requirementId === "eu-ai-act-art12-3",
    );
    expect(req).toBeDefined();
    expect(req!.requiredFields).toContain("inputHash");
    expect(req!.requiredFields).toContain("outputHash");
    expect(req!.applicableDataTypes).toContain("personal");
  });

  it("Article 13(1) requires reasoning certificate for transparency", () => {
    const req = EU_AI_ACT_REQUIREMENTS.find(
      (r) => r.requirementId === "eu-ai-act-art13-1",
    );
    expect(req).toBeDefined();
    expect(req!.requiresReasoningCertificate).toBe(true);
  });

  it("Article 13(2) requires provenance for model identification", () => {
    const req = EU_AI_ACT_REQUIREMENTS.find(
      (r) => r.requirementId === "eu-ai-act-art13-2",
    );
    expect(req).toBeDefined();
    expect(req!.requiresProvenance).toBe(true);
    expect(req!.requiredFields).toContain("modelId");
    expect(req!.requiredFields).toContain("modelProvider");
  });
});

