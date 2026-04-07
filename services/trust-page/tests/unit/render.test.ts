import { describe, it, expect } from "vitest";
import type { TrustPageData } from "../../src/aggregate.js";
import { escapeHtml, formatDuration, renderTrustPage } from "../../src/render.js";

function makeTrustPageData(
  overrides: Partial<TrustPageData> = {},
): TrustPageData {
  return {
    chainId: "test-chain-id",
    generatedAt: "2026-01-01T00:00:00.000Z",
    verification: {
      valid: true,
      entryCount: 10,
      errorType: null,
      errorEntryId: null,
      errorDetail: null,
    },
    entryTypeCounts: { ai_decision: 8, human_override: 2 },
    decisionTypeCounts: { classification: 5, generation: 3 },
    modelUsage: [
      {
        modelId: "gpt-4",
        modelProvider: "openai",
        entryCount: 8,
        totalInputTokens: 1000,
        totalOutputTokens: 500,
      },
    ],
    timeline: {
      firstEntryTimestamp: "2026-01-01T00:00:00.000Z",
      lastEntryTimestamp: "2026-01-01T01:00:00.000Z",
      durationMs: 3600000,
    },
    uniqueActors: ["alice", "bob"],
    uniqueSessions: ["session-1"],
    policyIds: ["colorado-sb205"],
    certificateCount: 1,
    provenanceCount: 1,
    certificates: [
      {
        certificateId: "cert-abcd1234-5678",
        modelId: "gpt-4",
        timestamp: "2026-01-01T00:00:00.000Z",
        claimCount: 3,
        unsupportedClaimCount: 1,
        confidenceLevel: "high",
        confidenceScore: 0.85,
      },
    ],
    provenanceRecords: [
      {
        provenanceId: "prov-1",
        modelName: "GPT-4",
        modelVersion: "1.0",
        modelProvider: "openai",
        datasetCount: 2,
        metricCount: 5,
        ethicalConsiderationCount: 3,
      },
    ],
    humanReview: {
      totalReviewed: 6,
      approved: 4,
      rejected: 2,
      pending: 1,
      reviewRate: 0.6,
    },
    complianceAvailability: [
      { regulationId: "colorado-sb205", available: true },
      { regulationId: "nist-ai-rmf", available: false },
    ],
    lastVerificationTimestamp: "2026-01-01T00:30:00.000Z",
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes all HTML special characters", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;",
    );
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#x27;s");
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("formatDuration", () => {
  it("formats milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(formatDuration(5000)).toBe("5s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90000)).toBe("1m 30s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3660000)).toBe("1h 1m");
  });

  it("formats exact hours", () => {
    expect(formatDuration(7200000)).toBe("2h");
  });

  it("formats days and hours", () => {
    expect(formatDuration(90000000)).toBe("1d 1h");
  });

  it("formats exact days", () => {
    expect(formatDuration(86400000)).toBe("1d");
  });

  it("formats exact minutes", () => {
    expect(formatDuration(60000)).toBe("1m");
  });
});

describe("renderTrustPage", () => {
  it("produces valid HTML document", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html lang=\"en\">");
    expect(html).toContain("</html>");
  });

  it("includes chain ID in the page", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("test-chain-id");
  });

  it("shows verification badge for valid chain", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("Chain Verified");
    expect(html).toContain("badge-valid");
  });

  it("shows verification badge for invalid chain", () => {
    const html = renderTrustPage(
      makeTrustPageData({
        verification: {
          valid: false,
          entryCount: 10,
          errorType: "HASH_MISMATCH",
          errorEntryId: "entry-1",
          errorDetail: "Hash mismatch detected",
        },
      }),
    );
    expect(html).toContain("Verification Failed");
    expect(html).toContain("badge-invalid");
    expect(html).toContain("HASH_MISMATCH");
    expect(html).toContain("Hash mismatch detected");
  });

  it("includes model usage table", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("gpt-4");
    expect(html).toContain("openai");
  });

  it("includes human review section", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("Human Review");
    expect(html).toContain("Review Rate");
    expect(html).toContain("60%");
    expect(html).toContain("review-approved");
    expect(html).toContain("review-rejected");
  });

  it("includes compliance availability section", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("Compliance Report Availability");
    expect(html).toContain("colorado-sb205");
    expect(html).toContain("nist-ai-rmf");
  });

  it("includes last verification timestamp in footer", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("Last verification:");
  });

  it("includes color palette in CSS", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("#0A1628");
    expect(html).toContain("#1B6B9A");
    expect(html).toContain("#4DA8DA");
  });

  it("renders entry type table", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("ai_decision");
    expect(html).toContain("human_override");
  });

  it("renders decision type table", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("classification");
    expect(html).toContain("generation");
  });

  it("renders certificate table", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("cert-abc");
    expect(html).toContain("85%");
  });

  it("renders provenance table", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("GPT-4");
  });

  it("renders policy tags", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("colorado-sb205");
  });

  it("renders timeline section", () => {
    const html = renderTrustPage(makeTrustPageData());
    expect(html).toContain("First Entry");
    expect(html).toContain("Last Entry");
    expect(html).toContain("1h");
  });

  it("handles empty data gracefully", () => {
    const html = renderTrustPage(
      makeTrustPageData({
        modelUsage: [],
        certificates: [],
        provenanceRecords: [],
        policyIds: [],
        entryTypeCounts: {},
        decisionTypeCounts: {},
        humanReview: {
          totalReviewed: 0,
          approved: 0,
          rejected: 0,
          pending: 0,
          reviewRate: 0,
        },
        complianceAvailability: [],
        timeline: {
          firstEntryTimestamp: null,
          lastEntryTimestamp: null,
          durationMs: null,
        },
      }),
    );
    expect(html).toContain("No model usage recorded");
    expect(html).toContain("No entries recorded");
    expect(html).toContain("No entries have been reviewed");
  });

  it("escapes user-controlled data to prevent XSS", () => {
    const html = renderTrustPage(
      makeTrustPageData({
        chainId: '<script>alert("xss")</script>',
      }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
