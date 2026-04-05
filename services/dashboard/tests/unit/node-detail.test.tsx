import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { NodeDetail } from "../../src/components/node-detail.js";
import type { ProofChainEntry } from "../../src/api.js";

function makeEntry(overrides?: Partial<ProofChainEntry>): ProofChainEntry {
  return {
    entryId: "entry-uuid-12345",
    chainId: "chain-1",
    sequenceNumber: 3,
    timestamp: "2026-01-01T00:00:00.000Z",
    entryType: "ai_decision",
    entryHash: "hash123",
    previousHash: null,
    parentEntryId: "parent-uuid",
    modelId: "gpt-4",
    modelProvider: "openai",
    inputHash: null,
    outputHash: null,
    inputTokenCount: null,
    outputTokenCount: null,
    decisionType: "classification",
    confidenceScore: 0.92,
    reasoningCertificateId: null,
    provenanceId: null,
    sessionId: "session-1",
    actorId: "agent-1",
    policyIds: [],
    tags: { agent_role: "analyst" },
    annotation: "Test note",
    complianceMetadata: {},
    ...overrides,
  };
}

describe("NodeDetail", () => {
  it("renders entry details", () => {
    render(
      <MemoryRouter>
        <NodeDetail entry={makeEntry()} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("analyst")).toBeInTheDocument();
    expect(screen.getByText("entry-uuid-12345")).toBeInTheDocument();
    expect(screen.getByText("gpt-4")).toBeInTheDocument();
    expect(screen.getByText("classification")).toBeInTheDocument();
    expect(screen.getByText("0.92")).toBeInTheDocument();
    expect(screen.getByText("Test note")).toBeInTheDocument();
  });

  it("shows parent entry ID", () => {
    render(
      <MemoryRouter>
        <NodeDetail entry={makeEntry()} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/parent-uuid/)).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <NodeDetail entry={makeEntry()} onClose={onClose} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Close detail panel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows full detail link", () => {
    render(
      <MemoryRouter>
        <NodeDetail entry={makeEntry()} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Full detail")).toBeInTheDocument();
  });

  it("uses actorId when no agent_role tag", () => {
    render(
      <MemoryRouter>
        <NodeDetail entry={makeEntry({ tags: {} })} onClose={vi.fn()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("agent-1")).toBeInTheDocument();
  });
});
