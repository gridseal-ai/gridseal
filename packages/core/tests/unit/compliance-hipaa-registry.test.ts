import { describe, expect, it } from "vitest";
import {
  hipaaAudit,
  HIPAA_AUDIT_REQUIREMENTS,
} from "../../src/compliance/regulations/hipaa-audit.js";
import {
  getAllRegulations,
  getRegulationById,
  getRegulationIds,
} from "../../src/compliance/regulations/registry.js";
import { COLORADO_SB205_REQUIREMENTS } from "../../src/compliance/regulations/colorado-sb205.js";
import { NIST_AI_RMF_REQUIREMENTS } from "../../src/compliance/regulations/nist-ai-rmf.js";
import { EU_AI_ACT_REQUIREMENTS } from "../../src/compliance/regulations/eu-ai-act.js";
import type {
  Regulation,
  RegulatoryRequirement,
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

describe("HIPAA 164.312(b) Audit Controls", () => {
  it("has correct regulation metadata", () => {
    assertValidRegulation(hipaaAudit);
    expect(hipaaAudit.regulationId).toBe("hipaa-164-312-b");
    expect(hipaaAudit.jurisdiction).toContain("United States");
  });

  it("defines 6 requirements", () => {
    expect(HIPAA_AUDIT_REQUIREMENTS).toHaveLength(6);
  });

  it("has unique requirement IDs", () => {
    const ids = HIPAA_AUDIT_REQUIREMENTS.map((r) => r.requirementId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all requirements apply to healthcare sector", () => {
    for (const req of HIPAA_AUDIT_REQUIREMENTS) {
      expect(req.applicableSectors).toContain("healthcare");
    }
  });

  it("all requirements apply to health data type", () => {
    for (const req of HIPAA_AUDIT_REQUIREMENTS) {
      expect(req.applicableDataTypes.length).toBeGreaterThan(0);
      expect(
        req.applicableDataTypes.includes("health") ||
          req.applicableDataTypes.includes("personal"),
      ).toBe(true);
    }
  });

  it("does not mandate a minimum risk level (applies to all ePHI)", () => {
    for (const req of HIPAA_AUDIT_REQUIREMENTS) {
      expect(req.minimumRiskLevel).toBeNull();
    }
  });

  it("audit control mechanism requires chain integrity fields", () => {
    const req = HIPAA_AUDIT_REQUIREMENTS.find(
      (r) => r.requirementId === "hipaa-164-312-b-1",
    );
    expect(req).toBeDefined();
    expect(req!.requiredFields).toContain("entryId");
    expect(req!.requiredFields).toContain("timestamp");
    expect(req!.requiredFields).toContain("actorId");
  });

  it("audit trail integrity requires hash chain fields", () => {
    const req = HIPAA_AUDIT_REQUIREMENTS.find(
      (r) => r.requirementId === "hipaa-164-312-b-2",
    );
    expect(req).toBeDefined();
    expect(req!.requiredFields).toContain("entryHash");
    expect(req!.requiredFields).toContain("previousHash");
    expect(req!.requiredFields).toContain("sequenceNumber");
  });

  it("AI decision documentation requires certificate and provenance", () => {
    const req = HIPAA_AUDIT_REQUIREMENTS.find(
      (r) => r.requirementId === "hipaa-164-312-b-5",
    );
    expect(req).toBeDefined();
    expect(req!.requiresReasoningCertificate).toBe(true);
    expect(req!.requiresProvenance).toBe(true);
    expect(req!.requiredFields).toContain("modelId");
    expect(req!.requiredFields).toContain("confidenceScore");
  });

  it("retention requirement references compliance metadata", () => {
    const req = HIPAA_AUDIT_REQUIREMENTS.find(
      (r) => r.requirementId === "hipaa-164-312-b-6",
    );
    expect(req).toBeDefined();
    expect(req!.requiredFields).toContain("timestamp");
    expect(req!.requiredFields).toContain("complianceMetadata");
  });
});

describe("Regulation registry", () => {
  it("returns all 4 regulations", () => {
    const all = getAllRegulations();
    expect(all).toHaveLength(4);
  });

  it("returns regulations with valid structure", () => {
    for (const reg of getAllRegulations()) {
      assertValidRegulation(reg);
    }
  });

  it("looks up regulation by ID", () => {
    const co = getRegulationById("colorado-sb205");
    expect(co).toBeDefined();
    expect(co!.name).toContain("Colorado");

    const nist = getRegulationById("nist-ai-rmf");
    expect(nist).toBeDefined();
    expect(nist!.name).toContain("NIST");

    const eu = getRegulationById("eu-ai-act");
    expect(eu).toBeDefined();
    expect(eu!.name).toContain("EU");

    const hipaa = getRegulationById("hipaa-164-312-b");
    expect(hipaa).toBeDefined();
    expect(hipaa!.name).toContain("HIPAA");
  });

  it("returns undefined for unknown regulation ID", () => {
    expect(getRegulationById("nonexistent")).toBeUndefined();
  });

  it("returns all 4 regulation IDs", () => {
    const ids = getRegulationIds();
    expect(ids).toHaveLength(4);
    expect(ids).toContain("colorado-sb205");
    expect(ids).toContain("nist-ai-rmf");
    expect(ids).toContain("eu-ai-act");
    expect(ids).toContain("hipaa-164-312-b");
  });

  it("has no duplicate requirement IDs across all regulations", () => {
    const allIds = getAllRegulations().flatMap((r) =>
      r.requirements.map((req) => req.requirementId),
    );
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("total requirement count matches sum of individual regulations", () => {
    const total = getAllRegulations().reduce(
      (sum, r) => sum + r.requirements.length,
      0,
    );
    expect(total).toBe(
      COLORADO_SB205_REQUIREMENTS.length +
        NIST_AI_RMF_REQUIREMENTS.length +
        EU_AI_ACT_REQUIREMENTS.length +
        HIPAA_AUDIT_REQUIREMENTS.length,
    );
    expect(total).toBe(39);
  });
});
