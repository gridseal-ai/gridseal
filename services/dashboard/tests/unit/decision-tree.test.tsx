import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecisionTree } from "../../src/components/decision-tree.js";
import { buildForest, layoutForest, flattenNodes, collectEdges } from "../../src/components/tree-layout.js";
import type { ProofChainEntry } from "../../src/api.js";

function makeEntry(id: string, parentId: string | null, seq: number, tags?: Record<string, string>): ProofChainEntry {
  return {
    entryId: id,
    chainId: "chain-1",
    sequenceNumber: seq,
    timestamp: "2026-01-01T00:00:00.000Z",
    entryType: "ai_decision",
    entryHash: `hash-${id}`,
    previousHash: null,
    parentEntryId: parentId,
    modelId: "gpt-4",
    modelProvider: "openai",
    inputHash: null,
    outputHash: null,
    inputTokenCount: null,
    outputTokenCount: null,
    decisionType: "routing",
    confidenceScore: 0.9,
    reasoningCertificateId: null,
    provenanceId: null,
    sessionId: "session-1",
    actorId: "agent",
    policyIds: [],
    tags: tags ?? {},
    annotation: null,
    complianceMetadata: {},
  };
}

describe("buildForest", () => {
  it("creates root nodes for entries without parents", () => {
    const entries = [makeEntry("a", null, 0), makeEntry("b", null, 1)];
    const roots = buildForest(entries);
    expect(roots).toHaveLength(2);
  });

  it("links children to parents", () => {
    const entries = [
      makeEntry("root", null, 0),
      makeEntry("child1", "root", 1),
      makeEntry("child2", "root", 2),
    ];
    const roots = buildForest(entries);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.children).toHaveLength(2);
  });

  it("sorts children by sequence number", () => {
    const entries = [
      makeEntry("root", null, 0),
      makeEntry("child2", "root", 2),
      makeEntry("child1", "root", 1),
    ];
    const roots = buildForest(entries);
    expect(roots[0]!.children[0]!.entry.entryId).toBe("child1");
    expect(roots[0]!.children[1]!.entry.entryId).toBe("child2");
  });
});

describe("layoutForest", () => {
  it("returns zero dimensions for empty forest", () => {
    const dims = layoutForest([]);
    expect(dims.width).toBe(0);
    expect(dims.height).toBe(0);
  });

  it("computes positive dimensions for non-empty forest", () => {
    const entries = [
      makeEntry("root", null, 0),
      makeEntry("child1", "root", 1),
    ];
    const roots = buildForest(entries);
    const dims = layoutForest(roots);
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });
});

describe("flattenNodes", () => {
  it("returns all nodes in the forest", () => {
    const entries = [
      makeEntry("root", null, 0),
      makeEntry("child1", "root", 1),
      makeEntry("grandchild", "child1", 2),
    ];
    const roots = buildForest(entries);
    const flat = flattenNodes(roots);
    expect(flat).toHaveLength(3);
  });
});

describe("collectEdges", () => {
  it("returns parent-child edges", () => {
    const entries = [
      makeEntry("root", null, 0),
      makeEntry("child1", "root", 1),
      makeEntry("child2", "root", 2),
    ];
    const roots = buildForest(entries);
    const edges = collectEdges(roots);
    expect(edges).toHaveLength(2);
  });
});

describe("DecisionTree component", () => {
  it("renders empty state when no entries", () => {
    render(
      <DecisionTree entries={[]} selectedEntryId={null} />,
    );
    expect(screen.getByTestId("decision-tree-empty")).toBeInTheDocument();
  });

  it("renders SVG tree for entries with parent-child relationships", () => {
    const entries = [
      makeEntry("root", null, 0, { agent_role: "orchestrator" }),
      makeEntry("child1", "root", 1, { agent_role: "analyst" }),
    ];
    render(
      <DecisionTree entries={entries} selectedEntryId={null} />,
    );
    expect(screen.getByTestId("decision-tree")).toBeInTheDocument();
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
    const rects = document.querySelectorAll("svg rect");
    expect(rects.length).toBeGreaterThanOrEqual(2);
  });

  it("shows zoom and fit controls", () => {
    const entries = [makeEntry("root", null, 0)];
    render(
      <DecisionTree entries={entries} selectedEntryId={null} />,
    );
    expect(screen.getByTitle("Zoom in")).toBeInTheDocument();
    expect(screen.getByTitle("Zoom out")).toBeInTheDocument();
    expect(screen.getByTitle("Reset view")).toBeInTheDocument();
  });

  it("calls onNodeClick callback when a tree node is clicked", () => {
    const entries = [makeEntry("root", null, 0, { agent_role: "orchestrator" })];
    const onClick = vi.fn();
    render(
      <DecisionTree entries={entries} onNodeClick={onClick} selectedEntryId={null} />,
    );
    fireEvent.click(screen.getByTestId("tree-node-root"));
    expect(onClick).toHaveBeenCalledWith(entries[0]);
  });

  it("applies review status colors for approved entries", () => {
    const entries = [makeEntry("root", null, 0, { review_status: "approved", agent_role: "reviewer" })];
    render(
      <DecisionTree entries={entries} selectedEntryId={null} />,
    );
    const rect = document.querySelector("svg rect");
    expect(rect?.getAttribute("fill")).toBe("#0A2E1A");
  });

  it("displays node and root count", () => {
    const entries = [
      makeEntry("root", null, 0),
      makeEntry("child", "root", 1),
    ];
    render(
      <DecisionTree entries={entries} selectedEntryId={null} />,
    );
    expect(screen.getByText(/2 nodes/)).toBeInTheDocument();
    expect(screen.getByText(/1 root\b/)).toBeInTheDocument();
  });
});
