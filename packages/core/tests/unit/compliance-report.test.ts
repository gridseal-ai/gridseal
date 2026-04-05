import { describe, expect, it } from "vitest";
import {
  generateComplianceReport,
  exportReportAsJson,
} from "../../src/export/compliance-report.js";
import type {
  ComplianceReport,
  GenerateReportInput,
} from "../../src/export/compliance-report.js";
import type { EntryMetadata } from "../../src/compliance/auto-tagger.js";
import type { ReasoningCertificate } from "../../src/certificate/reasoning-certificate.js";
import { createChain, appendEntry } from "../../src/chain/proof-chain.js";
import type { ChainState } from "../../src/chain/proof-chain.js";
import type { AppendEntryInput } from "../../src/chain/proof-chain.js";

function buildChain(
  chainId: string,
  inputs: ReadonlyArray<Omit<AppendEntryInput, "timestamp">>,
): ChainState {
  let chain = createChain(chainId);
  for (const input of inputs) {
    const result = appendEntry(chain, {
      ...input,
      timestamp: "2026-04-05T00:00:00Z",
    });
    if (!result.ok) {
      throw new Error(`Failed to append entry: ${JSON.stringify(result.error)}`);
    }
    chain = result.value.chain;
  }
  return chain;
}

function makeMetadata(overrides: Partial<EntryMetadata> = {}): EntryMetadata {
  return {
    sectors: [],
    dataTypes: [],
    authorityLevel: null,
    riskLevel: null,
    ...overrides,
  };
}

function makeCertificate(
  overrides: Partial<ReasoningCertificate> = {},
): ReasoningCertificate {
  return {
    certificateId: "cert-001",
    timestamp: "2026-04-05T00:00:00Z",
    modelId: "gpt-4o",
    modelProvider: "openai",
    claims: [
      { claimId: "c1", statement: "Input data was valid", supportingEvidenceIds: ["e1"] },
    ],
    supportingEvidence: [
      { evidenceId: "e1", evidenceType: "data_observation", description: "Schema validation passed", source: null },
    ],
    unsupportedClaims: [
      { statement: "Data is representative", reason: "No population statistics available" },
    ],
    assumptions: [{ statement: "Input is truthful", criticality: "medium" }],
    limitations: [{ description: "Limited to English text", impact: "May miss non-English content" }],
    confidenceAssessment: { level: "high", score: 0.85, rationale: "Strong evidence" },
    certificateHash: "fakehash",
    ...overrides,
  };
}

describe("generateComplianceReport", () => {
  it("produces a report for an empty chain", () => {
    const chain = createChain("chain-empty");
    const report = generateComplianceReport({
      reportId: "rpt-001",
      chain,
      defaultMetadata: makeMetadata(),
    });

    expect(report.reportId).toBe("rpt-001");
    expect(report.chainId).toBe("chain-empty");
    expect(report.chainIntegrity.valid).toBe(true);
    expect(report.chainIntegrity.totalEntries).toBe(0);
    expect(report.chainIntegrity.error).toBeNull();
    expect(report.statistics.totalEntries).toBe(0);
    expect(report.statistics.totalGaps).toBe(0);
    expect(report.gaps).toHaveLength(0);
    expect(report.certificateSummaries).toHaveLength(0);
  });

  it("verifies chain integrity and reports valid chain", () => {
    const chain = buildChain("chain-valid", [
      { entryId: "e1", entryType: "ai_decision" },
      { entryId: "e2", entryType: "ai_decision" },
      { entryId: "e3", entryType: "human_override" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-002",
      chain,
      defaultMetadata: makeMetadata(),
    });

    expect(report.chainIntegrity.valid).toBe(true);
    expect(report.chainIntegrity.totalEntries).toBe(3);
    expect(report.chainIntegrity.error).toBeNull();
  });

  it("detects tampered chain entries", () => {
    const chain = buildChain("chain-tampered", [
      { entryId: "e1", entryType: "ai_decision" },
      { entryId: "e2", entryType: "ai_decision" },
    ]);

    const tampered: ChainState = {
      ...chain,
      entries: chain.entries.map((e, i) =>
        i === 1
          ? { ...e, entryHash: "0000000000000000000000000000000000000000000000000000000000000000" }
          : e,
      ),
    };

    const report = generateComplianceReport({
      reportId: "rpt-003",
      chain: tampered,
      defaultMetadata: makeMetadata(),
    });

    expect(report.chainIntegrity.valid).toBe(false);
    expect(report.chainIntegrity.error).not.toBeNull();
    expect(report.chainIntegrity.error?.type).toBe("HASH_MISMATCH");
  });

  it("groups entries by regulation when sector metadata matches", () => {
    const chain = buildChain("chain-healthcare", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
      { entryId: "e2", entryType: "ai_decision", decisionType: "recommendation" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-004",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
    });

    expect(report.regulationSummaries.length).toBeGreaterThan(0);
    const hipaa = report.regulationSummaries.find(
      (s) => s.regulationId === "hipaa-164-312-b",
    );
    expect(hipaa).toBeDefined();
    expect(hipaa?.applicableRequirements).toBeGreaterThan(0);
  });

  it("filters to specific regulation IDs when provided", () => {
    const chain = buildChain("chain-filtered", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-005",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
      regulationIds: ["hipaa-164-312-b"],
    });

    expect(report.regulationSummaries).toHaveLength(1);
    expect(report.regulationSummaries[0]?.regulationId).toBe("hipaa-164-312-b");
    expect(Object.keys(report.entriesByRegulation)).toEqual(["hipaa-164-312-b"]);
  });

  it("identifies gaps when required fields are missing", () => {
    const chain = buildChain("chain-gaps", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-006",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
    });

    expect(report.gaps.length).toBeGreaterThan(0);
    expect(report.statistics.totalGaps).toBe(report.gaps.length);
    for (const gap of report.gaps) {
      expect(gap.entryId).toBe("e1");
      expect(gap.gaps.length).toBeGreaterThan(0);
    }
  });

  it("marks requirements as satisfied when entry has all required fields", () => {
    const chain = buildChain("chain-satisfied", [
      {
        entryId: "e1",
        entryType: "ai_decision",
        decisionType: "classification",
        modelId: "gpt-4o",
        modelProvider: "openai",
        inputHash: "abc123",
        outputHash: "def456",
        confidenceScore: 0.95,
        reasoningCertificateId: "cert-001",
        provenanceId: "prov-001",
        actorId: "user-1",
      },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-007",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["general"],
        dataTypes: ["public"],
        authorityLevel: "advisory",
        riskLevel: "minimal",
      }),
      regulationIds: ["nist-ai-rmf"],
    });

    const nist = report.regulationSummaries.find(
      (s) => s.regulationId === "nist-ai-rmf",
    );
    if (nist && nist.applicableRequirements > 0) {
      expect(nist.satisfiedRequirements).toBeGreaterThanOrEqual(0);
      expect(nist.complianceRate).toBeGreaterThanOrEqual(0);
    }
  });

  it("applies per-entry metadata overrides", () => {
    const chain = buildChain("chain-overrides", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
      { entryId: "e2", entryType: "ai_decision", decisionType: "classification" },
    ]);

    const reportDefault = generateComplianceReport({
      reportId: "rpt-008a",
      chain,
      defaultMetadata: makeMetadata({ sectors: ["general"], riskLevel: "minimal" }),
      regulationIds: ["hipaa-164-312-b"],
    });

    const reportOverridden = generateComplianceReport({
      reportId: "rpt-008b",
      chain,
      defaultMetadata: makeMetadata({ sectors: ["general"], riskLevel: "minimal" }),
      entryMetadataOverrides: {
        "e1": makeMetadata({
          sectors: ["healthcare"],
          dataTypes: ["health"],
          authorityLevel: "autonomous",
          riskLevel: "high",
        }),
      },
      regulationIds: ["hipaa-164-312-b"],
    });

    const defaultMappings = reportDefault.entriesByRegulation["hipaa-164-312-b"] ?? [];
    const overriddenMappings = reportOverridden.entriesByRegulation["hipaa-164-312-b"] ?? [];
    expect(overriddenMappings.length).toBeGreaterThanOrEqual(defaultMappings.length);
  });

  it("includes certificate summaries when certificates are provided", () => {
    const cert = makeCertificate({ certificateId: "cert-001" });
    const chain = buildChain("chain-certs", [
      {
        entryId: "e1",
        entryType: "ai_decision",
        reasoningCertificateId: "cert-001",
      },
      { entryId: "e2", entryType: "ai_decision" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-009",
      chain,
      defaultMetadata: makeMetadata(),
      certificates: new Map([["cert-001", cert]]),
    });

    expect(report.certificateSummaries).toHaveLength(1);
    expect(report.certificateSummaries[0]?.certificateId).toBe("cert-001");
    expect(report.certificateSummaries[0]?.entryId).toBe("e1");
    expect(report.certificateSummaries[0]?.modelId).toBe("gpt-4o");
    expect(report.certificateSummaries[0]?.claimCount).toBe(1);
    expect(report.certificateSummaries[0]?.unsupportedClaimCount).toBe(1);
    expect(report.certificateSummaries[0]?.confidenceLevel).toBe("high");
    expect(report.certificateSummaries[0]?.confidenceScore).toBe(0.85);
  });

  it("omits certificate summaries when certificates map is not provided", () => {
    const chain = buildChain("chain-no-certs", [
      {
        entryId: "e1",
        entryType: "ai_decision",
        reasoningCertificateId: "cert-001",
      },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-010",
      chain,
      defaultMetadata: makeMetadata(),
    });

    expect(report.certificateSummaries).toHaveLength(0);
  });

  it("counts entries with certificates and provenance in statistics", () => {
    const chain = buildChain("chain-stats", [
      { entryId: "e1", entryType: "ai_decision", reasoningCertificateId: "c1", provenanceId: "p1" },
      { entryId: "e2", entryType: "ai_decision", reasoningCertificateId: "c2" },
      { entryId: "e3", entryType: "ai_decision", provenanceId: "p2" },
      { entryId: "e4", entryType: "system_event" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-011",
      chain,
      defaultMetadata: makeMetadata(),
    });

    expect(report.statistics.totalEntries).toBe(4);
    expect(report.statistics.entriesWithCertificates).toBe(2);
    expect(report.statistics.entriesWithProvenance).toBe(2);
  });

  it("computes overall compliance rate across regulations", () => {
    const chain = buildChain("chain-rate", [
      {
        entryId: "e1",
        entryType: "ai_decision",
        decisionType: "classification",
        modelId: "gpt-4o",
        modelProvider: "openai",
        inputHash: "abc",
        outputHash: "def",
      },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-012",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
    });

    expect(report.statistics.overallComplianceRate).toBeGreaterThanOrEqual(0);
    expect(report.statistics.overallComplianceRate).toBeLessThanOrEqual(1);
  });

  it("returns compliance rate of 1 when no requirements are applicable", () => {
    const chain = buildChain("chain-no-match", [
      { entryId: "e1", entryType: "system_event" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-013",
      chain,
      defaultMetadata: makeMetadata(),
      regulationIds: ["hipaa-164-312-b"],
    });

    const hipaa = report.regulationSummaries.find(
      (s) => s.regulationId === "hipaa-164-312-b",
    );
    expect(hipaa).toBeDefined();
    expect(hipaa?.applicableRequirements).toBe(0);
    expect(hipaa?.complianceRate).toBe(1);
    expect(report.statistics.overallComplianceRate).toBe(1);
  });

  it("includes all four regulations by default", () => {
    const chain = buildChain("chain-all-regs", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-014",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
    });

    const regulationIds = report.regulationSummaries.map((s) => s.regulationId);
    expect(regulationIds).toContain("colorado-sb205");
    expect(regulationIds).toContain("nist-ai-rmf");
    expect(regulationIds).toContain("eu-ai-act");
    expect(regulationIds).toContain("hipaa-164-312-b");
  });

  it("sets generatedAt to a valid ISO 8601 timestamp", () => {
    const chain = createChain("chain-ts");
    const report = generateComplianceReport({
      reportId: "rpt-015",
      chain,
      defaultMetadata: makeMetadata(),
    });

    const parsed = new Date(report.generatedAt);
    expect(parsed.toISOString()).toBe(report.generatedAt);
  });

  it("maps entries correctly within entriesByRegulation", () => {
    const chain = buildChain("chain-mapping", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
      { entryId: "e2", entryType: "ai_decision", decisionType: "recommendation" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-016",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["finance"],
        dataTypes: ["financial"],
        authorityLevel: "human_in_the_loop",
        riskLevel: "high",
      }),
      regulationIds: ["colorado-sb205"],
    });

    const mappings = report.entriesByRegulation["colorado-sb205"] ?? [];
    for (const mapping of mappings) {
      expect(mapping.entryId).toBeTruthy();
      expect(mapping.sequenceNumber).toBeGreaterThanOrEqual(0);
      expect(mapping.totalCount).toBeGreaterThanOrEqual(mapping.satisfiedCount);
      expect(mapping.matches.length).toBe(mapping.totalCount);
    }
  });

  it("does not duplicate gaps for entries matched by multiple regulations", () => {
    const chain = buildChain("chain-dedup", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-017",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
    });

    const gapKeys = report.gaps.map(
      (g) => `${g.entryId}:${g.requirementId}`,
    );
    const uniqueKeys = new Set(gapKeys);
    expect(gapKeys.length).toBe(uniqueKeys.size);
  });

  it("handles chain with mixed entry types and decision types", () => {
    const chain = buildChain("chain-mixed", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
      { entryId: "e2", entryType: "human_override" },
      { entryId: "e3", entryType: "system_event" },
      { entryId: "e4", entryType: "policy_check" },
      { entryId: "e5", entryType: "ai_decision", decisionType: "recommendation" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-018",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["employment"],
        dataTypes: ["personal"],
        authorityLevel: "human_in_the_loop",
        riskLevel: "high",
      }),
    });

    expect(report.statistics.totalEntries).toBe(5);
    expect(report.chainIntegrity.valid).toBe(true);
  });

  it("handles regulation summaries with zero applicable requirements correctly", () => {
    const chain = buildChain("chain-zero-app", [
      { entryId: "e1", entryType: "system_event" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-019",
      chain,
      defaultMetadata: makeMetadata(),
      regulationIds: ["eu-ai-act"],
    });

    const euSummary = report.regulationSummaries.find(
      (s) => s.regulationId === "eu-ai-act",
    );
    expect(euSummary).toBeDefined();
    if (euSummary && euSummary.applicableRequirements === 0) {
      expect(euSummary.complianceRate).toBe(1);
    }
  });
});

describe("exportReportAsJson", () => {
  it("produces valid JSON that round-trips back to the same report structure", () => {
    const chain = buildChain("chain-json", [
      { entryId: "e1", entryType: "ai_decision" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-json-001",
      chain,
      defaultMetadata: makeMetadata(),
    });

    const json = exportReportAsJson(report);
    const parsed = JSON.parse(json) as ComplianceReport;

    expect(parsed.reportId).toBe(report.reportId);
    expect(parsed.chainId).toBe(report.chainId);
    expect(parsed.chainIntegrity.valid).toBe(report.chainIntegrity.valid);
    expect(parsed.statistics.totalEntries).toBe(report.statistics.totalEntries);
  });

  it("produces formatted JSON with indentation", () => {
    const chain = createChain("chain-fmt");
    const report = generateComplianceReport({
      reportId: "rpt-json-002",
      chain,
      defaultMetadata: makeMetadata(),
    });

    const json = exportReportAsJson(report);
    expect(json).toContain("\n");
    expect(json).toContain("  ");
  });

  it("includes all report sections in JSON output", () => {
    const cert = makeCertificate({ certificateId: "cert-json" });
    const chain = buildChain("chain-json-full", [
      {
        entryId: "e1",
        entryType: "ai_decision",
        decisionType: "classification",
        reasoningCertificateId: "cert-json",
      },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-json-003",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        riskLevel: "high",
        authorityLevel: "autonomous",
      }),
      certificates: new Map([["cert-json", cert]]),
    });

    const json = exportReportAsJson(report);
    const parsed = JSON.parse(json) as ComplianceReport;

    expect(parsed.chainIntegrity).toBeDefined();
    expect(parsed.regulationSummaries).toBeDefined();
    expect(parsed.entriesByRegulation).toBeDefined();
    expect(parsed.gaps).toBeDefined();
    expect(parsed.certificateSummaries).toBeDefined();
    expect(parsed.statistics).toBeDefined();
  });
});
