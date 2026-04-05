import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { EntryFields } from "./entry-fields.js";
import type { ProofChainEntry } from "../types.js";

function makeEntry(overrides: Partial<ProofChainEntry> = {}): ProofChainEntry {
  return {
    entryId: "entry-001",
    chainId: "chain-1",
    sequenceNumber: 0,
    timestamp: "2026-04-01T12:00:00.000Z",
    entryType: "ai_decision",
    entryHash: "a".repeat(64),
    previousHash: null,
    parentEntryId: null,
    modelId: "gpt-4o",
    modelProvider: "openai",
    inputHash: "b".repeat(64),
    outputHash: "c".repeat(64),
    inputTokenCount: 100,
    outputTokenCount: 50,
    decisionType: "generation",
    confidenceScore: 0.95,
    reasoningCertificateId: null,
    provenanceId: null,
    sessionId: "sess-1",
    actorId: "actor-1",
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
    ...overrides,
  };
}

afterEach(cleanup);

describe("EntryFields", () => {
  it("renders all three tier sections", () => {
    render(<EntryFields entry={makeEntry()} />);

    expect(screen.getByText("Tier 1: Chain Integrity")).toBeInTheDocument();
    expect(screen.getByText("Tier 2: AI Decision Context")).toBeInTheDocument();
    expect(screen.getByText("Tier 3: Compliance & Metadata")).toBeInTheDocument();
  });

  it("renders entry field labels and values", () => {
    render(<EntryFields entry={makeEntry()} />);

    expect(screen.getByText("Entry ID")).toBeInTheDocument();
    expect(screen.getByText("entry-001")).toBeInTheDocument();
    expect(screen.getByText("Model ID")).toBeInTheDocument();
    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
    expect(screen.getByText("Session ID")).toBeInTheDocument();
    expect(screen.getByText("sess-1")).toBeInTheDocument();
  });

  it("renders null for unset fields", () => {
    render(<EntryFields entry={makeEntry({ modelId: null })} />);

    const nullSpans = screen.getAllByText("null");
    expect(nullSpans.length).toBeGreaterThan(0);
  });

  it("renders object fields as JSON when they have content", () => {
    const entry = makeEntry({
      tags: { env: "production", team: "ml" },
    });

    render(<EntryFields entry={entry} />);

    expect(screen.getByText(/"env": "production"/)).toBeInTheDocument();
  });
});
