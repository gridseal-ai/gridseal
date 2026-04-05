import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TreeNodeDetail } from "./tree-node-detail.js";
import type { ProofChainEntry } from "../types.js";

function makeEntry(overrides: Partial<ProofChainEntry> = {}): ProofChainEntry {
  return {
    entryId: "entry-detail-001",
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
    actorId: "user-42",
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
    ...overrides,
  };
}

afterEach(cleanup);

describe("TreeNodeDetail", () => {
  it("renders the detail panel with entry ID", () => {
    const entry = makeEntry({ entryId: "abc123456789abcdef" });
    render(
      <MemoryRouter>
        <TreeNodeDetail entry={entry} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("tree-node-detail")).toBeInTheDocument();
    expect(screen.getByText("abc123456789...")).toBeInTheDocument();
  });

  it("shows a link to the full entry detail page", () => {
    const entry = makeEntry({ entryId: "e1", chainId: "c1" });
    render(
      <MemoryRouter>
        <TreeNodeDetail entry={entry} onClose={() => {}} />
      </MemoryRouter>,
    );
    const link = screen.getByText("Full detail");
    expect(link).toHaveAttribute("href", "/chains/c1/entries/e1");
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const entry = makeEntry();
    render(
      <MemoryRouter>
        <TreeNodeDetail entry={entry} onClose={onClose} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByLabelText("Close detail panel"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("renders EntryFields with the entry data", () => {
    const entry = makeEntry({ modelId: "claude-sonnet-4-20250514" });
    render(
      <MemoryRouter>
        <TreeNodeDetail entry={entry} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText("claude-sonnet-4-20250514")).toBeInTheDocument();
    expect(screen.getByText("Tier 1: Chain Integrity")).toBeInTheDocument();
  });
});
