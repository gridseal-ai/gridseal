import { describe, it, expect } from "vitest";
import type { ProofChainEntry } from "./types.js";
import {
  buildForest,
  layoutTree,
  flattenTree,
  collectEdges,
  NODE_HEIGHT,
  LEVEL_GAP,
} from "./tree-layout.js";

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
    actorId: "user-42",
    policyIds: [],
    tags: {},
    annotation: null,
    complianceMetadata: {},
    ...overrides,
  };
}

describe("buildForest", () => {
  it("returns a single root when one entry has no parent", () => {
    const entries = [makeEntry({ entryId: "root", parentEntryId: null })];
    const roots = buildForest(entries);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.entry.entryId).toBe("root");
    expect(roots[0]!.children).toHaveLength(0);
  });

  it("builds parent-child relationships from parentEntryId", () => {
    const entries = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
      makeEntry({ entryId: "child-1", sequenceNumber: 1, parentEntryId: "root" }),
      makeEntry({ entryId: "child-2", sequenceNumber: 2, parentEntryId: "root" }),
      makeEntry({ entryId: "grandchild", sequenceNumber: 3, parentEntryId: "child-1" }),
    ];
    const roots = buildForest(entries);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.children).toHaveLength(2);
    expect(roots[0]!.children[0]!.entry.entryId).toBe("child-1");
    expect(roots[0]!.children[1]!.entry.entryId).toBe("child-2");
    expect(roots[0]!.children[0]!.children).toHaveLength(1);
    expect(roots[0]!.children[0]!.children[0]!.entry.entryId).toBe("grandchild");
  });

  it("creates multiple roots when entries reference missing parents", () => {
    const entries = [
      makeEntry({ entryId: "a", parentEntryId: null }),
      makeEntry({ entryId: "b", parentEntryId: "missing-parent" }),
    ];
    const roots = buildForest(entries);
    expect(roots).toHaveLength(2);
  });

  it("sorts children by sequenceNumber", () => {
    const entries = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
      makeEntry({ entryId: "c", sequenceNumber: 5, parentEntryId: "root" }),
      makeEntry({ entryId: "a", sequenceNumber: 1, parentEntryId: "root" }),
      makeEntry({ entryId: "b", sequenceNumber: 3, parentEntryId: "root" }),
    ];
    const roots = buildForest(entries);
    const childIds = roots[0]!.children.map((c) => c.entry.entryId);
    expect(childIds).toEqual(["a", "b", "c"]);
  });

  it("handles empty input", () => {
    const roots = buildForest([]);
    expect(roots).toHaveLength(0);
  });
});

describe("layoutTree", () => {
  it("returns zero dimensions for empty forest", () => {
    const dims = layoutTree([]);
    expect(dims.width).toBe(0);
    expect(dims.height).toBe(0);
  });

  it("assigns y positions based on depth", () => {
    const entries = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
      makeEntry({ entryId: "child", sequenceNumber: 1, parentEntryId: "root" }),
    ];
    const roots = buildForest(entries);
    layoutTree(roots);

    expect(roots[0]!.y).toBe(0);
    expect(roots[0]!.children[0]!.y).toBe(NODE_HEIGHT + LEVEL_GAP);
  });

  it("places sibling nodes at different x positions", () => {
    const entries = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
      makeEntry({ entryId: "left", sequenceNumber: 1, parentEntryId: "root" }),
      makeEntry({ entryId: "right", sequenceNumber: 2, parentEntryId: "root" }),
    ];
    const roots = buildForest(entries);
    layoutTree(roots);

    const leftX = roots[0]!.children[0]!.x;
    const rightX = roots[0]!.children[1]!.x;
    expect(rightX).toBeGreaterThan(leftX);
  });

  it("returns positive dimensions for a populated tree", () => {
    const entries = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
      makeEntry({ entryId: "c1", sequenceNumber: 1, parentEntryId: "root" }),
      makeEntry({ entryId: "c2", sequenceNumber: 2, parentEntryId: "root" }),
    ];
    const roots = buildForest(entries);
    const dims = layoutTree(roots);

    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });

  it("ensures all node x positions are non-negative after normalization", () => {
    const entries = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
      makeEntry({ entryId: "a", sequenceNumber: 1, parentEntryId: "root" }),
      makeEntry({ entryId: "b", sequenceNumber: 2, parentEntryId: "root" }),
      makeEntry({ entryId: "c", sequenceNumber: 3, parentEntryId: "root" }),
    ];
    const roots = buildForest(entries);
    layoutTree(roots);
    const allNodes = flattenTree(roots);
    for (const node of allNodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("flattenTree", () => {
  it("returns all nodes in depth-first order", () => {
    const entries = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
      makeEntry({ entryId: "child-1", sequenceNumber: 1, parentEntryId: "root" }),
      makeEntry({ entryId: "child-2", sequenceNumber: 2, parentEntryId: "root" }),
      makeEntry({ entryId: "grandchild", sequenceNumber: 3, parentEntryId: "child-1" }),
    ];
    const roots = buildForest(entries);
    const flat = flattenTree(roots);
    expect(flat).toHaveLength(4);
    expect(flat[0]!.entry.entryId).toBe("root");
    expect(flat[1]!.entry.entryId).toBe("child-1");
    expect(flat[2]!.entry.entryId).toBe("grandchild");
    expect(flat[3]!.entry.entryId).toBe("child-2");
  });
});

describe("collectEdges", () => {
  it("returns all parent-child pairs", () => {
    const entries = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
      makeEntry({ entryId: "child-1", sequenceNumber: 1, parentEntryId: "root" }),
      makeEntry({ entryId: "child-2", sequenceNumber: 2, parentEntryId: "root" }),
    ];
    const roots = buildForest(entries);
    const edges = collectEdges(roots);
    expect(edges).toHaveLength(2);
    expect(edges[0]!.parent.entry.entryId).toBe("root");
    expect(edges[0]!.child.entry.entryId).toBe("child-1");
    expect(edges[1]!.parent.entry.entryId).toBe("root");
    expect(edges[1]!.child.entry.entryId).toBe("child-2");
  });

  it("returns empty array for leaf-only forest", () => {
    const entries = [makeEntry({ entryId: "lone", parentEntryId: null })];
    const roots = buildForest(entries);
    expect(collectEdges(roots)).toHaveLength(0);
  });
});

describe("performance", () => {
  it("handles 50+ nodes without error", () => {
    const entries: ProofChainEntry[] = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
    ];
    for (let i = 1; i <= 60; i++) {
      const parentIdx = Math.floor((i - 1) / 3);
      entries.push(
        makeEntry({
          entryId: `node-${i}`,
          sequenceNumber: i,
          parentEntryId: entries[parentIdx]!.entryId,
        }),
      );
    }

    const roots = buildForest(entries);
    const dims = layoutTree(roots);
    const flat = flattenTree(roots);

    expect(flat).toHaveLength(61);
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });

  it("lays out 200 nodes in under 100ms", () => {
    const entries: ProofChainEntry[] = [
      makeEntry({ entryId: "root", sequenceNumber: 0, parentEntryId: null }),
    ];
    for (let i = 1; i < 200; i++) {
      const parentIdx = Math.floor((i - 1) / 4);
      entries.push(
        makeEntry({
          entryId: `n-${i}`,
          sequenceNumber: i,
          parentEntryId: entries[parentIdx]!.entryId,
        }),
      );
    }

    const start = performance.now();
    const roots = buildForest(entries);
    layoutTree(roots);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(100);
  });
});
