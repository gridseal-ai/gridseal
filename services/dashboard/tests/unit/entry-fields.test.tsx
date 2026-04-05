import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntryFieldsView } from "../../src/components/entry-fields.js";
import type { ProofChainEntry } from "../../src/api.js";

function makeEntry(overrides?: Partial<ProofChainEntry>): ProofChainEntry {
  return {
    entryId: "e1-uuid",
    chainId: "chain-1",
    sequenceNumber: 0,
    timestamp: "2026-01-01T00:00:00.000Z",
    entryType: "ai_decision",
    entryHash: "abc123hash",
    previousHash: null,
    parentEntryId: null,
    modelId: "gpt-4",
    modelProvider: "openai",
    inputHash: "inputhash",
    outputHash: "outputhash",
    inputTokenCount: 100,
    outputTokenCount: 50,
    decisionType: "classification",
    confidenceScore: 0.95,
    reasoningCertificateId: null,
    provenanceId: null,
    sessionId: "session-1",
    actorId: "agent-1",
    policyIds: [],
    tags: {},
    annotation: "Test annotation",
    complianceMetadata: {},
    ...overrides,
  };
}

describe("EntryFieldsView", () => {
  it("renders all tier 1 fields", () => {
    render(<EntryFieldsView entry={makeEntry()} />);
    expect(screen.getByText("e1-uuid")).toBeInTheDocument();
    expect(screen.getByText("chain-1")).toBeInTheDocument();
    expect(screen.getByText("ai_decision")).toBeInTheDocument();
    expect(screen.getByText("abc123hash")).toBeInTheDocument();
  });

  it("renders tier 2 AI decision fields", () => {
    render(<EntryFieldsView entry={makeEntry()} />);
    expect(screen.getAllByText("gpt-4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("openai").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("classification").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("0.95")).toBeInTheDocument();
  });

  it("renders tier 3 metadata fields", () => {
    render(<EntryFieldsView entry={makeEntry()} />);
    expect(screen.getAllByText("session-1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("agent-1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Test annotation")).toBeInTheDocument();
  });

  it("renders tags when present", () => {
    render(<EntryFieldsView entry={makeEntry({ tags: { role: "admin", env: "prod" } })} />);
    expect(screen.getByText("role: admin")).toBeInTheDocument();
    expect(screen.getByText("env: prod")).toBeInTheDocument();
  });

  it("renders dash for null fields", () => {
    const entry = makeEntry({ modelId: null, actorId: null, annotation: null });
    render(<EntryFieldsView entry={entry} />);
    const dashes = screen.getAllByText("-");
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });

  it("renders policy IDs when present", () => {
    render(<EntryFieldsView entry={makeEntry({ policyIds: ["pol-1", "pol-2"] })} />);
    expect(screen.getByText("pol-1, pol-2")).toBeInTheDocument();
  });
});
