import { describe, expect, it } from "vitest";
import {
  generateComplianceReport,
  exportReportAsJson,
} from "../../src/export/compliance-report.js";
import type {
  ComplianceReport,
} from "../../src/export/compliance-report.js";
import type { EntryMetadata } from "../../src/compliance/auto-tagger.js";
import { createChain, appendEntry } from "../../src/chain/proof-chain.js";
import type { ChainState, AppendEntryInput } from "../../src/chain/proof-chain.js";
import type { EntryType, DecisionType } from "../../src/schema/entry-types.js";

function makeMetadata(overrides: Partial<EntryMetadata> = {}): EntryMetadata {
  return {
    sectors: [],
    dataTypes: [],
    authorityLevel: null,
    riskLevel: null,
    ...overrides,
  };
}

function buildChainFromInputs(
  chainId: string,
  count: number,
  inputFn: (i: number) => Partial<AppendEntryInput> & { entryId: string },
): ChainState {
  let chain = createChain(chainId);
  for (let i = 0; i < count; i++) {
    const input = inputFn(i);
    const result = appendEntry(chain, {
      timestamp: "2026-04-05T00:00:00Z",
      entryType: "ai_decision" as EntryType,
      ...input,
    });
    if (!result.ok) throw new Error(`Failed at entry ${i}: ${result.error.type}`);
    chain = result.value.chain;
  }
  return chain;
}

describe("generateComplianceReport boundary: large chains", () => {
  it("generates report for chain with 500 entries", () => {
    const chain = buildChainFromInputs("chain-500", 500, (i) => ({
      entryId: `entry-${i}`,
      decisionType: "classification" as DecisionType,
      modelId: `model-${i % 5}`,
    }));

    const report = generateComplianceReport({
      reportId: "rpt-large-001",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
    });

    expect(report.chainIntegrity.valid).toBe(true);
    expect(report.chainIntegrity.totalEntries).toBe(500);
    expect(report.statistics.totalEntries).toBe(500);
  });

  it("generates report for chain with all 8 entry types", () => {
    const entryTypes: ReadonlyArray<EntryType> = [
      "ai_decision", "human_override", "system_event", "policy_check",
      "data_access", "model_deployment", "feedback", "correction",
    ];
    const chain = buildChainFromInputs("chain-types", 8, (i) => ({
      entryId: `entry-${i}`,
      entryType: entryTypes[i],
    }));

    const report = generateComplianceReport({
      reportId: "rpt-types",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["general"],
        riskLevel: "minimal",
      }),
    });

    expect(report.chainIntegrity.valid).toBe(true);
    expect(report.statistics.totalEntries).toBe(8);
  });

  it("generates report for chain with entries containing unicode fields", () => {
    const chain = buildChainFromInputs("chain-unicode", 3, (i) => ({
      entryId: `entry-\u4f60\u597d-${i}`,
      annotation: `\u4f60\u597d\u4e16\u754c annotation ${i}`,
      tags: { "\u00fc": `value-${i}` },
    }));

    const report = generateComplianceReport({
      reportId: "rpt-unicode",
      chain,
      defaultMetadata: makeMetadata(),
    });

    expect(report.chainIntegrity.valid).toBe(true);
    expect(report.statistics.totalEntries).toBe(3);
  });
});

describe("exportReportAsJson boundary", () => {
  it("handles report with unicode content in JSON export", () => {
    const chain = buildChainFromInputs("chain-json-unicode", 1, () => ({
      entryId: "entry-\u4f60\u597d",
      annotation: "\u4f60\u597d\u4e16\u754c",
    }));

    const report = generateComplianceReport({
      reportId: "rpt-json-unicode",
      chain,
      defaultMetadata: makeMetadata(),
    });

    const json = exportReportAsJson(report);
    const parsed = JSON.parse(json) as ComplianceReport;
    expect(parsed.reportId).toBe("rpt-json-unicode");
    expect(parsed.chainIntegrity.valid).toBe(true);
  });

  it("produces valid JSON for large reports (500 entries)", () => {
    const chain = buildChainFromInputs("chain-json-large", 500, (i) => ({
      entryId: `entry-${i}`,
      decisionType: "classification" as DecisionType,
    }));

    const report = generateComplianceReport({
      reportId: "rpt-json-large",
      chain,
      defaultMetadata: makeMetadata({
        sectors: ["healthcare"],
        dataTypes: ["health"],
        authorityLevel: "autonomous",
        riskLevel: "high",
      }),
    });

    const json = exportReportAsJson(report);
    expect(() => JSON.parse(json)).not.toThrow();
    const parsed = JSON.parse(json) as ComplianceReport;
    expect(parsed.statistics.totalEntries).toBe(500);
  });
});
