import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DecisionTree } from "./decision-tree.js";
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
    actorId: "orchestrator",
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
    ...overrides,
  };
}

afterEach(cleanup);

describe("DecisionTree", () => {
  it("renders empty state when no entries provided", () => {
    render(
      <MemoryRouter>
        <DecisionTree entries={[]} />
      </MemoryRouter>,
    );
    expect(screen.getByTestId("decision-tree-empty")).toBeInTheDocument();
    expect(screen.getByText("No entries to display.")).toBeInTheDocument();
  });

  it("renders the tree container with node count", () => {
    const entries = [
      makeEntry({ entryId: "root", parentEntryId: null }),
      makeEntry({ entryId: "child", parentEntryId: "root", sequenceNumber: 1 }),
    ];

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("decision-tree")).toBeInTheDocument();
    expect(screen.getByText("2 nodes | 1 root")).toBeInTheDocument();
  });

  it("renders a node for each entry", () => {
    const entries = [
      makeEntry({ entryId: "root", parentEntryId: null }),
      makeEntry({ entryId: "child-1", parentEntryId: "root", sequenceNumber: 1 }),
      makeEntry({ entryId: "child-2", parentEntryId: "root", sequenceNumber: 2 }),
    ];

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("tree-node-root")).toBeInTheDocument();
    expect(screen.getByTestId("tree-node-child-1")).toBeInTheDocument();
    expect(screen.getByTestId("tree-node-child-2")).toBeInTheDocument();
  });

  it("displays agent_role from tags when available", () => {
    const entries = [
      makeEntry({
        entryId: "root",
        parentEntryId: null,
        tags: { agent_role: "Coordinator" },
      }),
    ];

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Coordinator")).toBeInTheDocument();
  });

  it("falls back to actorId when agent_role tag is missing", () => {
    const entries = [
      makeEntry({
        entryId: "root",
        parentEntryId: null,
        actorId: "data-agent",
        tags: {},
      }),
    ];

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByText("data-agent")).toBeInTheDocument();
  });

  it("displays authority_level and review_status from tags", () => {
    const entries = [
      makeEntry({
        entryId: "root",
        parentEntryId: null,
        tags: {
          authority_level: "high",
          review_status: "approved",
        },
      }),
    ];

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Level: high | Review: approved")).toBeInTheDocument();
  });

  it("calls onNodeClick with the entry when a node is clicked", () => {
    const onNodeClick = vi.fn();
    const root = makeEntry({ entryId: "root", parentEntryId: null });

    render(
      <MemoryRouter>
        <DecisionTree entries={[root]} onNodeClick={onNodeClick} />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId("tree-node-root"));
    expect(onNodeClick).toHaveBeenCalledOnce();
    expect(onNodeClick).toHaveBeenCalledWith(root);
  });

  it("highlights the selected node", () => {
    const entries = [
      makeEntry({ entryId: "root", parentEntryId: null }),
      makeEntry({ entryId: "child", parentEntryId: "root", sequenceNumber: 1 }),
    ];

    const { container } = render(
      <MemoryRouter>
        <DecisionTree entries={entries} selectedEntryId="root" />
      </MemoryRouter>,
    );

    const rootNode = container.querySelector('[data-testid="tree-node-root"] rect');
    expect(rootNode).toHaveAttribute("stroke", "#38bdf8");
    expect(rootNode).toHaveAttribute("stroke-width", "2.5");
  });

  it("renders zoom controls", () => {
    const entries = [makeEntry({ entryId: "root", parentEntryId: null })];

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByTitle("Zoom in")).toBeInTheDocument();
    expect(screen.getByTitle("Zoom out")).toBeInTheDocument();
    expect(screen.getByTitle("Reset view")).toBeInTheDocument();
  });

  it("shows annotation as summary when available", () => {
    const entries = [
      makeEntry({
        entryId: "root",
        parentEntryId: null,
        annotation: "Classified input as spam",
      }),
    ];

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Classified input as spam")).toBeInTheDocument();
  });

  it("renders multiple roots correctly", () => {
    const entries = [
      makeEntry({ entryId: "root-a", parentEntryId: null, sequenceNumber: 0 }),
      makeEntry({ entryId: "root-b", parentEntryId: null, sequenceNumber: 1 }),
    ];

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByText("2 nodes | 2 roots")).toBeInTheDocument();
  });

  it("handles 50+ nodes without crashing", () => {
    const entries: ProofChainEntry[] = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
    ];
    for (let i = 1; i <= 55; i++) {
      const parentIdx = Math.floor((i - 1) / 3);
      entries.push(
        makeEntry({
          entryId: `node-${i}`,
          sequenceNumber: i,
          parentEntryId: entries[parentIdx]!.entryId,
        }),
      );
    }

    render(
      <MemoryRouter>
        <DecisionTree entries={entries} />
      </MemoryRouter>,
    );

    expect(screen.getByText("56 nodes | 1 root")).toBeInTheDocument();
    expect(screen.getByTestId("tree-node-root")).toBeInTheDocument();
  });
});
