import { describe, expect, it } from "vitest";
import {
  extractComplianceContext,
  matchRequirement,
  tagEntry,
  tagEntryForRegulation,
} from "../../src/compliance/auto-tagger.js";
import type { EntryMetadata } from "../../src/compliance/auto-tagger.js";
import type { ProofChainEntry } from "../../src/schema/proof-chain-entry.js";
import type { RegulatoryRequirement } from "../../src/compliance/types.js";
import {
  TIER_2_DEFAULTS,
  TIER_3_DEFAULTS,
} from "../../src/schema/proof-chain-entry.js";

/** Builds a minimal valid ProofChainEntry with overrides. */
function makeEntry(overrides: Partial<ProofChainEntry> = {}): ProofChainEntry {
  return {
    entryId: "entry-001",
    chainId: "chain-001",
    sequenceNumber: 0,
    timestamp: "2026-04-05T00:00:00Z",
    entryType: "ai_decision",
    entryHash: "abc123",
    previousHash: null,
    parentEntryId: null,
    ...TIER_2_DEFAULTS,
    ...TIER_3_DEFAULTS,
    ...overrides,
  };
}

/** Builds minimal entry metadata with overrides. */
function makeMetadata(overrides: Partial<EntryMetadata> = {}): EntryMetadata {
  return {
    sectors: [],
    dataTypes: [],
    authorityLevel: null,
    riskLevel: null,
    ...overrides,
  };
}

/** Builds a requirement with sensible defaults and overrides. */
function makeRequirement(
  overrides: Partial<RegulatoryRequirement> = {},
): RegulatoryRequirement {
  return {
    requirementId: "test-req-1",
    regulationId: "test-reg",
    sectionRef: "Section 1",
    title: "Test requirement",
    description: "A test requirement for unit testing the auto-tagger matching logic.",
    applicableSectors: [],
    applicableDecisionTypes: [],
    applicableDataTypes: [],
    applicableAuthorityLevels: [],
    minimumRiskLevel: null,
    requiredFields: ["entryId"],
    requiresReasoningCertificate: false,
    requiresProvenance: false,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/*  extractComplianceContext                                           */
/* ------------------------------------------------------------------ */

describe("extractComplianceContext", () => {
  it("populates context from entry and metadata", () => {
    const entry = makeEntry({
      decisionType: "classification",
      reasoningCertificateId: "cert-1",
      provenanceId: "prov-1",
      modelId: "gpt-4o",
    });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["health"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });
    const ctx = extractComplianceContext(entry, metadata);

    expect(ctx.sectors).toEqual(["healthcare"]);
    expect(ctx.dataTypes).toEqual(["health"]);
    expect(ctx.decisionType).toBe("classification");
    expect(ctx.authorityLevel).toBe("autonomous");
    expect(ctx.riskLevel).toBe("high");
    expect(ctx.hasReasoningCertificate).toBe(true);
    expect(ctx.hasProvenance).toBe(true);
    expect(ctx.populatedFields).toContain("modelId");
    expect(ctx.populatedFields).toContain("entryId");
  });

  it("detects missing reasoning certificate and provenance", () => {
    const entry = makeEntry();
    const metadata = makeMetadata();
    const ctx = extractComplianceContext(entry, metadata);

    expect(ctx.hasReasoningCertificate).toBe(false);
    expect(ctx.hasProvenance).toBe(false);
  });

  it("excludes null fields from populatedFields", () => {
    const entry = makeEntry({ modelId: null, modelProvider: null });
    const metadata = makeMetadata();
    const ctx = extractComplianceContext(entry, metadata);

    expect(ctx.populatedFields).not.toContain("modelId");
    expect(ctx.populatedFields).not.toContain("modelProvider");
  });

  it("excludes empty arrays and objects from populatedFields", () => {
    const entry = makeEntry({ policyIds: [], tags: {}, complianceMetadata: {} });
    const metadata = makeMetadata();
    const ctx = extractComplianceContext(entry, metadata);

    expect(ctx.populatedFields).not.toContain("policyIds");
    expect(ctx.populatedFields).not.toContain("tags");
    expect(ctx.populatedFields).not.toContain("complianceMetadata");
  });

  it("includes non-empty arrays and objects in populatedFields", () => {
    const entry = makeEntry({
      policyIds: ["policy-1"],
      tags: { env: "production" },
      complianceMetadata: { region: "us" },
    });
    const metadata = makeMetadata();
    const ctx = extractComplianceContext(entry, metadata);

    expect(ctx.populatedFields).toContain("policyIds");
    expect(ctx.populatedFields).toContain("tags");
    expect(ctx.populatedFields).toContain("complianceMetadata");
  });
});

/* ------------------------------------------------------------------ */
/*  matchRequirement                                                   */
/* ------------------------------------------------------------------ */

describe("matchRequirement", () => {
  it("returns null when sector does not match", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ sectors: ["finance"] }),
    );
    const req = makeRequirement({ applicableSectors: ["healthcare"] });
    expect(matchRequirement(ctx, req)).toBeNull();
  });

  it("matches when requirement has empty sectors (applies to all)", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ sectors: ["finance"] }),
    );
    const req = makeRequirement({ applicableSectors: [] });
    expect(matchRequirement(ctx, req)).not.toBeNull();
  });

  it("returns null when data type does not match", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ dataTypes: ["public"] }),
    );
    const req = makeRequirement({ applicableDataTypes: ["health"] });
    expect(matchRequirement(ctx, req)).toBeNull();
  });

  it("matches when data types overlap", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ dataTypes: ["health", "public"] }),
    );
    const req = makeRequirement({ applicableDataTypes: ["health", "personal"] });
    expect(matchRequirement(ctx, req)).not.toBeNull();
  });

  it("returns null when decision type does not match", () => {
    const ctx = extractComplianceContext(
      makeEntry({ decisionType: "generation" }),
      makeMetadata(),
    );
    const req = makeRequirement({
      applicableDecisionTypes: ["classification", "recommendation"],
    });
    expect(matchRequirement(ctx, req)).toBeNull();
  });

  it("matches when decision type is in the requirement list", () => {
    const ctx = extractComplianceContext(
      makeEntry({ decisionType: "classification" }),
      makeMetadata(),
    );
    const req = makeRequirement({
      applicableDecisionTypes: ["classification", "recommendation"],
    });
    expect(matchRequirement(ctx, req)).not.toBeNull();
  });

  it("returns null when entry has no decision type but requirement requires one", () => {
    const ctx = extractComplianceContext(
      makeEntry({ decisionType: null }),
      makeMetadata(),
    );
    const req = makeRequirement({
      applicableDecisionTypes: ["classification"],
    });
    expect(matchRequirement(ctx, req)).toBeNull();
  });

  it("returns null when authority level does not match", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ authorityLevel: "advisory" }),
    );
    const req = makeRequirement({
      applicableAuthorityLevels: ["autonomous"],
    });
    expect(matchRequirement(ctx, req)).toBeNull();
  });

  it("returns null when entry has no authority level but requirement requires one", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ authorityLevel: null }),
    );
    const req = makeRequirement({
      applicableAuthorityLevels: ["autonomous"],
    });
    expect(matchRequirement(ctx, req)).toBeNull();
  });

  it("returns null when risk level is below minimum", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ riskLevel: "limited" }),
    );
    const req = makeRequirement({ minimumRiskLevel: "high" });
    expect(matchRequirement(ctx, req)).toBeNull();
  });

  it("returns null when risk level is null but minimum is required", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ riskLevel: null }),
    );
    const req = makeRequirement({ minimumRiskLevel: "high" });
    expect(matchRequirement(ctx, req)).toBeNull();
  });

  it("matches when risk level meets minimum exactly", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ riskLevel: "high" }),
    );
    const req = makeRequirement({ minimumRiskLevel: "high" });
    expect(matchRequirement(ctx, req)).not.toBeNull();
  });

  it("matches when risk level exceeds minimum", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ riskLevel: "unacceptable" }),
    );
    const req = makeRequirement({ minimumRiskLevel: "high" });
    expect(matchRequirement(ctx, req)).not.toBeNull();
  });

  it("matches any risk level when minimumRiskLevel is null", () => {
    const ctx = extractComplianceContext(
      makeEntry(),
      makeMetadata({ riskLevel: "minimal" }),
    );
    const req = makeRequirement({ minimumRiskLevel: null });
    expect(matchRequirement(ctx, req)).not.toBeNull();
  });

  it("reports satisfied when all required fields are populated", () => {
    const entry = makeEntry({ modelId: "gpt-4o", modelProvider: "openai" });
    const ctx = extractComplianceContext(entry, makeMetadata());
    const req = makeRequirement({
      requiredFields: ["entryId", "modelId"],
      requiresReasoningCertificate: false,
      requiresProvenance: false,
    });
    const match = matchRequirement(ctx, req);

    expect(match).not.toBeNull();
    expect(match!.satisfied).toBe(true);
    expect(match!.missingFields).toEqual([]);
    expect(match!.gaps).toEqual([]);
  });

  it("reports unsatisfied with missing fields listed", () => {
    const entry = makeEntry({ modelId: null, confidenceScore: null });
    const ctx = extractComplianceContext(entry, makeMetadata());
    const req = makeRequirement({
      requiredFields: ["entryId", "modelId", "confidenceScore"],
    });
    const match = matchRequirement(ctx, req);

    expect(match).not.toBeNull();
    expect(match!.satisfied).toBe(false);
    expect(match!.missingFields).toContain("modelId");
    expect(match!.missingFields).toContain("confidenceScore");
  });

  it("reports gap when reasoning certificate is required but missing", () => {
    const entry = makeEntry({ reasoningCertificateId: null });
    const ctx = extractComplianceContext(entry, makeMetadata());
    const req = makeRequirement({
      requiredFields: ["entryId"],
      requiresReasoningCertificate: true,
    });
    const match = matchRequirement(ctx, req);

    expect(match).not.toBeNull();
    expect(match!.satisfied).toBe(false);
    expect(match!.gaps).toContain("Missing reasoning certificate");
  });

  it("reports gap when provenance is required but missing", () => {
    const entry = makeEntry({ provenanceId: null });
    const ctx = extractComplianceContext(entry, makeMetadata());
    const req = makeRequirement({
      requiredFields: ["entryId"],
      requiresProvenance: true,
    });
    const match = matchRequirement(ctx, req);

    expect(match).not.toBeNull();
    expect(match!.satisfied).toBe(false);
    expect(match!.gaps).toContain("Missing model provenance");
  });

  it("reports satisfied when reasoning certificate and provenance are present", () => {
    const entry = makeEntry({
      reasoningCertificateId: "cert-1",
      provenanceId: "prov-1",
    });
    const ctx = extractComplianceContext(entry, makeMetadata());
    const req = makeRequirement({
      requiredFields: ["entryId"],
      requiresReasoningCertificate: true,
      requiresProvenance: true,
    });
    const match = matchRequirement(ctx, req);

    expect(match).not.toBeNull();
    expect(match!.satisfied).toBe(true);
    expect(match!.gaps).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/*  tagEntry — Colorado SB 205                                        */
/* ------------------------------------------------------------------ */

describe("tagEntry against Colorado SB 205", () => {
  it("matches impact assessment for high-risk autonomous classification in healthcare", () => {
    const entry = makeEntry({
      decisionType: "classification",
      modelId: "gpt-4o",
      modelProvider: "openai",
      complianceMetadata: { purpose: "clinical triage" },
    });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["health"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "colorado-sb205");

    expect(result.regulationIds).toContain("colorado-sb205");
    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("colorado-sb205-6-1-1703-3");
  });

  it("does not match Colorado requirements for minimal risk entries", () => {
    const entry = makeEntry({ decisionType: "classification" });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["health"],
      authorityLevel: "autonomous",
      riskLevel: "minimal",
    });
    const result = tagEntryForRegulation(entry, metadata, "colorado-sb205");

    expect(result.matches).toHaveLength(0);
  });

  it("matches explanation requirement for high-risk classification with personal data", () => {
    const entry = makeEntry({
      decisionType: "classification",
      inputHash: "aaa",
      outputHash: "bbb",
      confidenceScore: 0.95,
      reasoningCertificateId: "cert-1",
    });
    const metadata = makeMetadata({
      sectors: ["finance"],
      dataTypes: ["personal"],
      authorityLevel: "human_in_the_loop",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "colorado-sb205");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("colorado-sb205-6-1-1703-4b");
    const explanationMatch = result.matches.find(
      (m) => m.requirement.requirementId === "colorado-sb205-6-1-1703-4b",
    );
    expect(explanationMatch!.satisfied).toBe(true);
  });

  it("identifies gaps when explanation requirement fields are missing", () => {
    const entry = makeEntry({
      decisionType: "classification",
      inputHash: null,
      outputHash: null,
      confidenceScore: null,
      reasoningCertificateId: null,
    });
    const metadata = makeMetadata({
      sectors: ["finance"],
      dataTypes: ["personal"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "colorado-sb205");

    const explanationMatch = result.matches.find(
      (m) => m.requirement.requirementId === "colorado-sb205-6-1-1703-4b",
    );
    expect(explanationMatch).toBeDefined();
    expect(explanationMatch!.satisfied).toBe(false);
    expect(explanationMatch!.missingFields).toContain("inputHash");
    expect(explanationMatch!.missingFields).toContain("outputHash");
    expect(explanationMatch!.missingFields).toContain("confidenceScore");
    expect(explanationMatch!.missingFields).toContain("reasoningCertificateId");
    expect(explanationMatch!.gaps).toContain("Missing reasoning certificate");
  });

  it("matches appeal process only for autonomous authority", () => {
    const entry = makeEntry({
      decisionType: "classification",
      actorId: "user-1",
      annotation: "claim denied",
    });
    const metadata = makeMetadata({
      sectors: ["insurance"],
      dataTypes: ["personal"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "colorado-sb205");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("colorado-sb205-6-1-1703-4b-appeal");
  });

  it("does not match appeal process for human_in_the_loop authority", () => {
    const entry = makeEntry({ decisionType: "classification" });
    const metadata = makeMetadata({
      sectors: ["insurance"],
      dataTypes: ["personal"],
      authorityLevel: "human_in_the_loop",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "colorado-sb205");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).not.toContain("colorado-sb205-6-1-1703-4b-appeal");
  });

  it("matches data governance for biometric data at high risk", () => {
    const entry = makeEntry({
      inputHash: "abc",
      complianceMetadata: { dataset: "biometric-v2" },
    });
    const metadata = makeMetadata({
      sectors: ["government"],
      dataTypes: ["biometric"],
      authorityLevel: null,
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "colorado-sb205");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("colorado-sb205-6-1-1703-3-data");
  });
});

/* ------------------------------------------------------------------ */
/*  tagEntry — NIST AI RMF                                            */
/* ------------------------------------------------------------------ */

describe("tagEntry against NIST AI RMF", () => {
  it("matches GOVERN policies requirement for any entry with policyIds", () => {
    const entry = makeEntry({ policyIds: ["pol-1"] });
    const metadata = makeMetadata();
    const result = tagEntryForRegulation(entry, metadata, "nist-ai-rmf");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("nist-ai-rmf-govern-1");
  });

  it("matches many NIST requirements for a well-populated entry", () => {
    const entry = makeEntry({
      decisionType: "classification",
      modelId: "gpt-4o",
      modelProvider: "openai",
      inputHash: "aaa",
      outputHash: "bbb",
      confidenceScore: 0.9,
      reasoningCertificateId: "cert-1",
      provenanceId: "prov-1",
      sessionId: "sess-1",
      actorId: "user-1",
      policyIds: ["pol-1"],
      tags: { env: "prod" },
      annotation: "approved",
      complianceMetadata: { framework: "nist" },
    });
    const metadata = makeMetadata({
      sectors: ["finance"],
      dataTypes: ["financial"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "nist-ai-rmf");

    expect(result.matches.length).toBeGreaterThanOrEqual(10);
    const satisfied = result.matches.filter((m) => m.satisfied);
    expect(satisfied.length).toBeGreaterThanOrEqual(10);
  });

  it("matches MAP risk categories for personal data entries", () => {
    const entry = makeEntry({
      decisionType: "recommendation",
      complianceMetadata: { category: "risk-assessment" },
    });
    const metadata = makeMetadata({
      dataTypes: ["personal"],
    });
    const result = tagEntryForRegulation(entry, metadata, "nist-ai-rmf");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("nist-ai-rmf-map-2");
  });

  it("matches MAP benefits/harms only for autonomous or human_in_the_loop", () => {
    const entry = makeEntry({
      complianceMetadata: { impact: "assessed" },
    });
    const advisoryMeta = makeMetadata({ authorityLevel: "advisory" });
    const advisoryResult = tagEntryForRegulation(entry, advisoryMeta, "nist-ai-rmf");
    const advisoryReqIds = advisoryResult.matches.map((m) => m.requirement.requirementId);
    expect(advisoryReqIds).not.toContain("nist-ai-rmf-map-3");

    const autonomousMeta = makeMetadata({ authorityLevel: "autonomous" });
    const autoResult = tagEntryForRegulation(entry, autonomousMeta, "nist-ai-rmf");
    const autoReqIds = autoResult.matches.map((m) => m.requirement.requirementId);
    expect(autoReqIds).toContain("nist-ai-rmf-map-3");
  });

  it("identifies provenance gap for GOVERN procurement requirement", () => {
    const entry = makeEntry({
      complianceMetadata: { vendor: "acme" },
      provenanceId: null,
    });
    const metadata = makeMetadata();
    const result = tagEntryForRegulation(entry, metadata, "nist-ai-rmf");

    const procurementMatch = result.matches.find(
      (m) => m.requirement.requirementId === "nist-ai-rmf-govern-6",
    );
    expect(procurementMatch).toBeDefined();
    expect(procurementMatch!.satisfied).toBe(false);
    expect(procurementMatch!.gaps).toContain("Missing model provenance");
  });

  it("matches MANAGE risk mitigation for autonomous with reasoning cert", () => {
    const entry = makeEntry({
      policyIds: ["pol-1"],
      annotation: "risk mitigated",
      complianceMetadata: { action: "mitigation" },
      reasoningCertificateId: "cert-1",
    });
    const metadata = makeMetadata({ authorityLevel: "autonomous" });
    const result = tagEntryForRegulation(entry, metadata, "nist-ai-rmf");

    const match = result.matches.find(
      (m) => m.requirement.requirementId === "nist-ai-rmf-manage-2",
    );
    expect(match).toBeDefined();
    expect(match!.satisfied).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  tagEntry — EU AI Act                                              */
/* ------------------------------------------------------------------ */

describe("tagEntry against EU AI Act", () => {
  it("matches Article 12 auto-logging for any high-risk entry", () => {
    const entry = makeEntry();
    const metadata = makeMetadata({ riskLevel: "high" });
    const result = tagEntryForRegulation(entry, metadata, "eu-ai-act");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("eu-ai-act-art12-1");
  });

  it("does not match EU AI Act requirements for limited risk entries", () => {
    const entry = makeEntry();
    const metadata = makeMetadata({ riskLevel: "limited" });
    const result = tagEntryForRegulation(entry, metadata, "eu-ai-act");

    expect(result.matches).toHaveLength(0);
  });

  it("matches Article 12 input/output recording for classification with personal data", () => {
    const entry = makeEntry({
      decisionType: "classification",
      inputHash: "aaa",
      outputHash: "bbb",
      inputTokenCount: 100,
      outputTokenCount: 50,
    });
    const metadata = makeMetadata({
      dataTypes: ["personal"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "eu-ai-act");

    const match = result.matches.find(
      (m) => m.requirement.requirementId === "eu-ai-act-art12-3",
    );
    expect(match).toBeDefined();
    expect(match!.satisfied).toBe(true);
  });

  it("identifies provenance gap for Article 12 traceability", () => {
    const entry = makeEntry({
      modelId: "claude",
      modelProvider: "anthropic",
      sessionId: "sess-1",
      provenanceId: null,
    });
    const metadata = makeMetadata({ riskLevel: "high" });
    const result = tagEntryForRegulation(entry, metadata, "eu-ai-act");

    const match = result.matches.find(
      (m) => m.requirement.requirementId === "eu-ai-act-art12-2",
    );
    expect(match).toBeDefined();
    expect(match!.satisfied).toBe(false);
    expect(match!.gaps).toContain("Missing model provenance");
  });

  it("matches Article 13 transparency design with reasoning certificate", () => {
    const entry = makeEntry({
      decisionType: "recommendation",
      confidenceScore: 0.85,
      reasoningCertificateId: "cert-1",
    });
    const metadata = makeMetadata({ riskLevel: "high" });
    const result = tagEntryForRegulation(entry, metadata, "eu-ai-act");

    const match = result.matches.find(
      (m) => m.requirement.requirementId === "eu-ai-act-art13-1",
    );
    expect(match).toBeDefined();
    expect(match!.satisfied).toBe(true);
  });

  it("matches Article 14 human oversight for autonomous personal data", () => {
    const entry = makeEntry({
      actorId: "reviewer-1",
      annotation: "reviewed and approved",
      complianceMetadata: { oversight: "manual review" },
    });
    const metadata = makeMetadata({
      dataTypes: ["personal"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "eu-ai-act");

    const match = result.matches.find(
      (m) => m.requirement.requirementId === "eu-ai-act-art14-1",
    );
    expect(match).toBeDefined();
    expect(match!.satisfied).toBe(true);
  });

  it("matches all 8 EU requirements for fully-populated high-risk entry", () => {
    const entry = makeEntry({
      sequenceNumber: 5,
      previousHash: "prev-hash-abc",
      decisionType: "classification",
      modelId: "gpt-4o",
      modelProvider: "openai",
      inputHash: "aaa",
      outputHash: "bbb",
      inputTokenCount: 100,
      outputTokenCount: 50,
      confidenceScore: 0.9,
      reasoningCertificateId: "cert-1",
      provenanceId: "prov-1",
      sessionId: "sess-1",
      actorId: "user-1",
      policyIds: ["pol-1"],
      tags: { env: "prod" },
      annotation: "complete",
      complianceMetadata: { retention: "10y" },
    });
    const metadata = makeMetadata({
      dataTypes: ["personal"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });
    const result = tagEntryForRegulation(entry, metadata, "eu-ai-act");

    expect(result.matches).toHaveLength(8);
    const allSatisfied = result.matches.every((m) => m.satisfied);
    expect(allSatisfied).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  tagEntry — HIPAA                                                  */
/* ------------------------------------------------------------------ */

describe("tagEntry against HIPAA 164.312(b)", () => {
  it("matches audit controls for healthcare entry with health data", () => {
    const entry = makeEntry({ actorId: "nurse-1" });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["health"],
    });
    const result = tagEntryForRegulation(entry, metadata, "hipaa-164-312-b");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("hipaa-164-312-b-1");
    expect(reqIds).toContain("hipaa-164-312-b-2");
  });

  it("does not match HIPAA for non-healthcare sector", () => {
    const entry = makeEntry({ actorId: "user-1" });
    const metadata = makeMetadata({
      sectors: ["finance"],
      dataTypes: ["health"],
    });
    const result = tagEntryForRegulation(entry, metadata, "hipaa-164-312-b");

    expect(result.matches).toHaveLength(0);
  });

  it("does not match HIPAA for healthcare sector without health/personal data", () => {
    const entry = makeEntry({ actorId: "user-1" });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["public"],
    });
    const result = tagEntryForRegulation(entry, metadata, "hipaa-164-312-b");

    expect(result.matches).toHaveLength(0);
  });

  it("matches retention requirement for healthcare with health data", () => {
    const entry = makeEntry({
      complianceMetadata: { retentionYears: 6 },
    });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["health"],
    });
    const result = tagEntryForRegulation(entry, metadata, "hipaa-164-312-b");

    const reqIds = result.matches.map((m) => m.requirement.requirementId);
    expect(reqIds).toContain("hipaa-164-312-b-5");
  });

  it("matches all 5 HIPAA requirements for fully-populated healthcare entry", () => {
    const entry = makeEntry({
      sequenceNumber: 3,
      previousHash: "prev-hash-xyz",
      decisionType: "classification",
      modelId: "medpalm",
      modelProvider: "google",
      inputHash: "aaa",
      outputHash: "bbb",
      confidenceScore: 0.92,
      reasoningCertificateId: "cert-1",
      provenanceId: "prov-1",
      sessionId: "sess-1",
      actorId: "nurse-1",
      tags: { department: "radiology" },
      complianceMetadata: { retentionYears: 6 },
    });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["health", "personal", "sensitive"],
      authorityLevel: "human_in_the_loop",
    });
    const result = tagEntryForRegulation(entry, metadata, "hipaa-164-312-b");

    expect(result.matches).toHaveLength(5);
    const allSatisfied = result.matches.every((m) => m.satisfied);
    expect(allSatisfied).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  tagEntry — cross-regulation                                       */
/* ------------------------------------------------------------------ */

describe("tagEntry across all regulations", () => {
  it("matches multiple regulations for a healthcare high-risk entry", () => {
    const entry = makeEntry({
      decisionType: "classification",
      modelId: "medpalm",
      modelProvider: "google",
      inputHash: "aaa",
      outputHash: "bbb",
      inputTokenCount: 500,
      outputTokenCount: 200,
      confidenceScore: 0.95,
      reasoningCertificateId: "cert-1",
      provenanceId: "prov-1",
      sessionId: "sess-1",
      actorId: "doctor-1",
      policyIds: ["hipaa-policy"],
      tags: { department: "oncology" },
      annotation: "diagnosis confirmed",
      complianceMetadata: { retentionYears: 6, framework: "hipaa" },
    });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["health", "personal", "sensitive"],
      authorityLevel: "human_in_the_loop",
      riskLevel: "high",
    });
    const result = tagEntry(entry, metadata);

    expect(result.regulationIds).toContain("colorado-sb205");
    expect(result.regulationIds).toContain("nist-ai-rmf");
    expect(result.regulationIds).toContain("eu-ai-act");
    expect(result.regulationIds).toContain("hipaa-164-312-b");
    expect(result.matches.length).toBeGreaterThan(20);
  });

  it("returns empty matches for an entry with no applicable context", () => {
    const entry = makeEntry();
    const metadata = makeMetadata({
      sectors: [],
      dataTypes: [],
      authorityLevel: null,
      riskLevel: null,
    });
    const result = tagEntry(entry, metadata);

    // NIST requirements with no filters still match (they have empty arrays for all filters)
    // but Colorado/EU require risk level and HIPAA requires healthcare sector
    expect(result.regulationIds).not.toContain("colorado-sb205");
    expect(result.regulationIds).not.toContain("hipaa-164-312-b");
  });

  it("returns context alongside matches", () => {
    const entry = makeEntry({ decisionType: "generation" });
    const metadata = makeMetadata({
      sectors: ["finance"],
      dataTypes: ["financial"],
      authorityLevel: "advisory",
      riskLevel: "limited",
    });
    const result = tagEntry(entry, metadata);

    expect(result.context.sectors).toEqual(["finance"]);
    expect(result.context.decisionType).toBe("generation");
    expect(result.context.riskLevel).toBe("limited");
  });
});

/* ------------------------------------------------------------------ */
/*  tagEntryForRegulation                                             */
/* ------------------------------------------------------------------ */

describe("tagEntryForRegulation", () => {
  it("returns empty result for unknown regulation ID", () => {
    const entry = makeEntry();
    const metadata = makeMetadata();
    const result = tagEntryForRegulation(entry, metadata, "nonexistent-reg");

    expect(result.matches).toHaveLength(0);
    expect(result.regulationIds).toEqual([]);
  });

  it("only returns matches for the specified regulation", () => {
    const entry = makeEntry({
      actorId: "user-1",
      policyIds: ["pol-1"],
      complianceMetadata: { note: "test" },
      annotation: "ok",
      sessionId: "sess-1",
    });
    const metadata = makeMetadata({
      sectors: ["healthcare"],
      dataTypes: ["health"],
      authorityLevel: "autonomous",
      riskLevel: "high",
    });

    const nistResult = tagEntryForRegulation(entry, metadata, "nist-ai-rmf");
    const hipaaResult = tagEntryForRegulation(entry, metadata, "hipaa-164-312-b");

    for (const match of nistResult.matches) {
      expect(match.requirement.regulationId).toBe("nist-ai-rmf");
    }
    for (const match of hipaaResult.matches) {
      expect(match.requirement.regulationId).toBe("hipaa-164-312-b");
    }
  });
});
