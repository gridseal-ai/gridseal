import type { ProofChainEntry } from "../api.js";

export const NODE_W = 220;
export const NODE_H = 80;
export const LEVEL_GAP = 60;
export const SIBLING_GAP = 24;
export const PADDING = 40;

export type TreeNode = {
  readonly entry: ProofChainEntry;
  readonly children: TreeNode[];
  x: number;
  y: number;
  prelim: number;
  mod: number;
};

export type Edge = {
  readonly parent: TreeNode;
  readonly child: TreeNode;
};

export function buildForest(entries: ReadonlyArray<ProofChainEntry>): TreeNode[] {
  const map = new Map<string, TreeNode>();
  for (const e of entries) {
    map.set(e.entryId, { entry: e, children: [], x: 0, y: 0, prelim: 0, mod: 0 });
  }
  const roots: TreeNode[] = [];
  for (const node of map.values()) {
    const parentId = node.entry.parentEntryId;
    const parent = parentId ? map.get(parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  for (const node of map.values()) {
    node.children.sort((a, b) => a.entry.sequenceNumber - b.entry.sequenceNumber);
  }
  return roots;
}

export function subtreeWidth(node: TreeNode): number {
  if (node.children.length === 0) return NODE_W;
  let w = 0;
  for (let i = 0; i < node.children.length; i++) {
    if (i > 0) w += SIBLING_GAP;
    w += subtreeWidth(node.children[i]!);
  }
  return Math.max(NODE_W, w);
}

function layoutNode(node: TreeNode, centerX: number, depth: number): void {
  node.x = centerX - NODE_W / 2;
  node.y = depth * (NODE_H + LEVEL_GAP);
  if (node.children.length === 0) return;

  const widths = node.children.map(subtreeWidth);
  let totalW = 0;
  for (let i = 0; i < widths.length; i++) {
    totalW += widths[i]!;
    if (i > 0) totalW += SIBLING_GAP;
  }

  let cursor = centerX - totalW / 2;
  for (let i = 0; i < node.children.length; i++) {
    const w = widths[i]!;
    layoutNode(node.children[i]!, cursor + w / 2, depth + 1);
    cursor += w + SIBLING_GAP;
  }
}

export function layoutForest(roots: TreeNode[]): { width: number; height: number } {
  if (roots.length === 0) return { width: 0, height: 0 };

  const widths = roots.map(subtreeWidth);
  let totalW = 0;
  for (let i = 0; i < widths.length; i++) {
    totalW += widths[i]!;
    if (i > 0) totalW += SIBLING_GAP;
  }

  let cursor = 0;
  for (let i = 0; i < roots.length; i++) {
    const w = widths[i]!;
    layoutNode(roots[i]!, cursor + w / 2, 0);
    cursor += w + SIBLING_GAP;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let maxY = 0;
  function measure(n: TreeNode) {
    if (n.x < minX) minX = n.x;
    if (n.x + NODE_W > maxX) maxX = n.x + NODE_W;
    if (n.y + NODE_H > maxY) maxY = n.y + NODE_H;
    for (const c of n.children) measure(c);
  }
  for (const r of roots) measure(r);

  const offsetX = -minX;
  function shift(n: TreeNode) {
    n.x += offsetX;
    for (const c of n.children) shift(c);
  }
  for (const r of roots) shift(r);

  return { width: maxX - minX, height: maxY };
}

export function flattenNodes(roots: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  function walk(n: TreeNode) {
    result.push(n);
    for (const c of n.children) walk(c);
  }
  for (const r of roots) walk(r);
  return result;
}

export function collectEdges(roots: TreeNode[]): Edge[] {
  const result: Edge[] = [];
  function walk(n: TreeNode) {
    for (const c of n.children) {
      result.push({ parent: n, child: c });
      walk(c);
    }
  }
  for (const r of roots) walk(r);
  return result;
}
