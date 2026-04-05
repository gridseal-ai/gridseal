import type { ProofChainEntry } from "./types.js";

/** A tree node wrapping a ProofChainEntry with computed layout position. */
export type TreeNode = {
  readonly entry: ProofChainEntry;
  readonly children: TreeNode[];
  x: number;
  y: number;
  /** Preliminary x used during layout computation. */
  prelim: number;
  /** Modifier shift applied to subtrees. */
  mod: number;
};

/** Dimensions for rendering. */
export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 80;
export const LEVEL_GAP = 60;
export const SIBLING_GAP = 24;

/**
 * Build a forest of TreeNodes from a flat list of entries.
 * Root nodes are entries whose parentEntryId is null or whose parent is not in the list.
 */
export function buildForest(entries: readonly ProofChainEntry[]): TreeNode[] {
  const nodeMap = new Map<string, TreeNode>();
  for (const entry of entries) {
    nodeMap.set(entry.entryId, {
      entry,
      children: [],
      x: 0,
      y: 0,
      prelim: 0,
      mod: 0,
    });
  }

  const roots: TreeNode[] = [];
  for (const node of nodeMap.values()) {
    const parentId = node.entry.parentEntryId;
    const parent = parentId ? nodeMap.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  /** Sort children by sequenceNumber for deterministic layout. */
  for (const node of nodeMap.values()) {
    node.children.sort(
      (a, b) => a.entry.sequenceNumber - b.entry.sequenceNumber,
    );
  }

  return roots;
}

/**
 * Compute x, y positions for a tree using a simplified top-down layout.
 * Based on a simplified Reingold-Tilford algorithm.
 */
export function layoutTree(roots: TreeNode[]): { width: number; height: number } {
  if (roots.length === 0) return { width: 0, height: 0 };

  /** First pass: assign preliminary x positions bottom-up. */
  function firstPass(node: TreeNode): void {
    for (const child of node.children) {
      firstPass(child);
    }

    if (node.children.length === 0) {
      node.prelim = 0;
    } else if (node.children.length === 1) {
      node.prelim = node.children[0]!.prelim;
    } else {
      const first = node.children[0]!;
      const last = node.children[node.children.length - 1]!;
      node.prelim = (first.prelim + last.prelim) / 2;
    }
  }

  /** Compute subtree width for simple spacing. */
  function subtreeWidth(node: TreeNode): number {
    if (node.children.length === 0) return NODE_WIDTH;
    let total = 0;
    for (let i = 0; i < node.children.length; i++) {
      if (i > 0) total += SIBLING_GAP;
      total += subtreeWidth(node.children[i]!);
    }
    return Math.max(NODE_WIDTH, total);
  }

  /** Assign x positions top-down given a center x and available width. */
  function assignPositions(node: TreeNode, centerX: number, depth: number): void {
    node.x = centerX - NODE_WIDTH / 2;
    node.y = depth * (NODE_HEIGHT + LEVEL_GAP);

    if (node.children.length === 0) return;

    const widths = node.children.map(subtreeWidth);
    let totalWidth = 0;
    for (let i = 0; i < widths.length; i++) {
      totalWidth += widths[i]!;
      if (i > 0) totalWidth += SIBLING_GAP;
    }

    let currentX = centerX - totalWidth / 2;
    for (let i = 0; i < node.children.length; i++) {
      const w = widths[i]!;
      assignPositions(node.children[i]!, currentX + w / 2, depth + 1);
      currentX += w + SIBLING_GAP;
    }
  }

  /** Layout each root as a separate subtree. */
  const rootWidths = roots.map(subtreeWidth);
  let totalRootWidth = 0;
  for (let i = 0; i < rootWidths.length; i++) {
    totalRootWidth += rootWidths[i]!;
    if (i > 0) totalRootWidth += SIBLING_GAP;
  }

  let currentX = 0;
  for (let i = 0; i < roots.length; i++) {
    firstPass(roots[i]!);
    const w = rootWidths[i]!;
    assignPositions(roots[i]!, currentX + w / 2, 0);
    currentX += w + SIBLING_GAP;
  }

  /** Compute bounds. */
  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;

  function collectBounds(node: TreeNode): void {
    if (node.x < minX) minX = node.x;
    if (node.x + NODE_WIDTH > maxX) maxX = node.x + NODE_WIDTH;
    if (node.y + NODE_HEIGHT > maxY) maxY = node.y + NODE_HEIGHT;
    for (const child of node.children) {
      collectBounds(child);
    }
  }
  for (const root of roots) {
    collectBounds(root);
  }

  /** Normalize: shift all nodes so minX = 0. */
  const offsetX = -minX;
  function shiftNodes(node: TreeNode): void {
    node.x += offsetX;
    for (const child of node.children) {
      shiftNodes(child);
    }
  }
  for (const root of roots) {
    shiftNodes(root);
  }

  return {
    width: maxX - minX,
    height: maxY,
  };
}

/** Flatten a forest into an array for iteration. */
export function flattenTree(roots: readonly TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(node: TreeNode): void {
    result.push(node);
    for (const child of node.children) {
      walk(child);
    }
  }
  for (const root of roots) {
    walk(root);
  }
  return result;
}

/** Collect all parent-child edges for drawing connectors. */
export function collectEdges(
  roots: readonly TreeNode[],
): Array<{ parent: TreeNode; child: TreeNode }> {
  const edges: Array<{ parent: TreeNode; child: TreeNode }> = [];
  function walk(node: TreeNode): void {
    for (const child of node.children) {
      edges.push({ parent: node, child });
      walk(child);
    }
  }
  for (const root of roots) {
    walk(root);
  }
  return edges;
}
