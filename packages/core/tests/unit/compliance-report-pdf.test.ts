import { describe, expect, it } from "vitest";
import { exportReportAsPdf } from "../../src/export/compliance-report-pdf.js";
import { generateComplianceReport } from "../../src/export/compliance-report.js";
import type { EntryMetadata } from "../../src/compliance/auto-tagger.js";
import type { ReasoningCertificate } from "../../src/certificate/reasoning-certificate.js";
import { createChain, appendEntry } from "../../src/chain/proof-chain.js";
import type { ChainState, AppendEntryInput } from "../../src/chain/proof-chain.js";

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
    certificateId: "cert-pdf-001",
    timestamp: "2026-04-05T00:00:00Z",
    modelId: "gpt-4o",
    modelProvider: "openai",
    claims: [
      { claimId: "c1", statement: "Valid input", supportingEvidenceIds: ["e1"] },
    ],
    supportingEvidence: [
      { evidenceId: "e1", evidenceType: "data_observation", description: "Passed validation", source: null },
    ],
    unsupportedClaims: [],
    assumptions: [],
    limitations: [],
    confidenceAssessment: { level: "high", score: 0.9, rationale: "Strong" },
    certificateHash: "fakehash",
    ...overrides,
  };
}

describe("exportReportAsPdf", () => {
  it("returns a Buffer containing a valid PDF", async () => {
    const chain = createChain("chain-pdf-empty");
    const report = generateComplianceReport({
      reportId: "rpt-pdf-001",
      chain,
      defaultMetadata: makeMetadata(),
    });

    const buffer = await exportReportAsPdf(report);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates a PDF for a chain with entries and gaps", async () => {
    const chain = buildChain("chain-pdf-gaps", [
      { entryId: "e1", entryType: "ai_decision", decisionType: "classification" },
      { entryId: "e2", entryType: "ai_decision", decisionType: "recommendation" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-pdf-002",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
    });

    expect(report.gaps.length).toBeGreaterThan(0);
    const buffer = await exportReportAsPdf(report);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("includes certificate summaries in PDF output", async () => {
    const cert = makeCertificate();
    const chain = buildChain("chain-pdf-certs", [
      {
        entryId: "e1",
        entryType: "ai_decision",
        reasoningCertificateId: "cert-pdf-001",
      },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-pdf-003",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        riskLevel: "high",
        authorityLevel: "autonomous",
      }),
      certificates: new Map([["cert-pdf-001", cert]]),
    });

    expect(report.certificateSummaries.length).toBe(1);
    const buffer = await exportReportAsPdf(report);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("accepts custom title and author options", async () => {
    const chain = createChain("chain-pdf-opts");
    const report = generateComplianceReport({
      reportId: "rpt-pdf-004",
      chain,
      defaultMetadata: makeMetadata(),
    });

    const buffer = await exportReportAsPdf(report, {
      title: "Custom Report Title",
      author: "Test Author",
      pageSize: "LETTER",
    });
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("generates a PDF for a large chain with many entries", async () => {
    const inputs: Array<Omit<AppendEntryInput, "timestamp">> = [];
    for (let i = 0; i < 50; i++) {
      inputs.push({
        entryId: `e-${i}`,
        entryType: "ai_decision",
        decisionType: "classification",
      });
    }
    const chain = buildChain("chain-pdf-large", inputs);

    const report = generateComplianceReport({
      reportId: "rpt-pdf-005",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["finance"],
        dataTypes: ["financial"],
        authorityLevel: "human_in_the_loop",
        riskLevel: "high",
      }),
      regulationIds: ["colorado-sb205"],
    });

    const buffer = await exportReportAsPdf(report);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(100);
  });

  it("generates a PDF with no compliance gaps", async () => {
    const chain = buildChain("chain-pdf-clean", [
      { entryId: "e1", entryType: "system_event" },
    ]);

    const report = generateComplianceReport({
      reportId: "rpt-pdf-006",
      chain,
      defaultMetadata: makeMetadata(),
      regulationIds: ["hipaa-164-312-b"],
    });
    const buffer = await exportReportAsPdf(report);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("handles report with tampered chain integrity", async () => {
    const chain = buildChain("chain-pdf-tamper", [
      { entryId: "e1", entryType: "ai_decision" },
    ]);

    const tampered: ChainState = {
      ...chain,
      entries: chain.entries.map((e) => ({
        ...e,
        entryHash: "0".repeat(64),
      })),
    };

    const report = generateComplianceReport({
      reportId: "rpt-pdf-007",
      chain: tampered,
      defaultMetadata: makeMetadata(),
    });

    expect(report.chainIntegrity.valid).toBe(false);
    const buffer = await exportReportAsPdf(report);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
