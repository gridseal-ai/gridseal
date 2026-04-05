import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import type { ProofChainEntry } from "../api.js";
import type { TreeNode, Edge } from "./tree-layout.js";
import {
  NODE_W,
  NODE_H,
  PADDING,
  buildForest,
  layoutForest,
  flattenNodes,
  collectEdges,
} from "./tree-layout.js";

const REVIEW_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  approved: { bg: "#064e3b", text: "#6ee7b7", border: "#059669" },
  rejected: { bg: "#450a0a", text: "#fca5a5", border: "#dc2626" },
  pending: { bg: "#422006", text: "#fcd34d", border: "#d97706" },
};

const DEFAULT_COLORS = { bg: "#1e293b", text: "#94a3b8", border: "#334155" };

function nodeColors(entry: ProofChainEntry) {
  const status = entry.tags["review_status"] ?? entry.tags["reviewStatus"];
  if (status && status in REVIEW_COLORS) return REVIEW_COLORS[status]!;
  return DEFAULT_COLORS;
}

function nodeLabel(entry: ProofChainEntry): string {
  return entry.tags["agent_role"] ?? entry.tags["agentRole"] ?? entry.actorId ?? entry.entryType;
}

function nodeSummary(entry: ProofChainEntry): string {
  return entry.annotation ?? entry.tags["summary"] ?? entry.decisionType ?? entry.entryType;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}...` : s;
}

function EdgeLine({ parent, child }: Edge) {
  const x1 = parent.x + NODE_W / 2;
  const y1 = parent.y + NODE_H;
  const x2 = child.x + NODE_W / 2;
  const y2 = child.y;
  const mid = (y1 + y2) / 2;
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
      fill="none"
      stroke="#334155"
      strokeWidth={1.5}
      strokeOpacity={0.7}
    />
  );
}

function TreeNodeRect({
  node,
  isSelected,
  onClick,
}: {
  readonly node: TreeNode;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}) {
  const { entry } = node;
  const colors = nodeColors(entry);
  const label = nodeLabel(entry);
  const authority = entry.tags["authority_level"] ?? entry.tags["authorityLevel"] ?? null;
  const reviewStatus = entry.tags["review_status"] ?? entry.tags["reviewStatus"] ?? null;
  const summary = nodeSummary(entry);
  const borderColor = isSelected ? "#38bdf8" : colors.border;
  const borderWidth = isSelected ? 2.5 : 1.5;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`Tree node: ${label}`}
      data-testid={`tree-node-${entry.entryId}`}
    >
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={8}
        ry={8}
        fill={colors.bg}
        stroke={borderColor}
        strokeWidth={borderWidth}
      />
      <text x={10} y={20} fill={colors.text} fontSize={13} fontWeight={600} fontFamily="system-ui, -apple-system, sans-serif">
        {truncate(label, 26)}
      </text>
      <text x={10} y={38} fill="#94a3b8" fontSize={10} fontFamily="system-ui, -apple-system, sans-serif">
        {authority ? `Level: ${authority}` : ""}
        {authority && reviewStatus ? "  |  " : ""}
        {reviewStatus ? `Review: ${reviewStatus}` : ""}
      </text>
      <text x={10} y={58} fill="#cbd5e1" fontSize={11} fontFamily="system-ui, -apple-system, sans-serif">
        {truncate(summary, 30)}
      </text>
      <text x={NODE_W - 10} y={20} fill="#64748b" fontSize={10} textAnchor="end" fontFamily="ui-monospace, monospace">
        #{entry.sequenceNumber}
      </text>
    </g>
  );
}

export function DecisionTree({
  entries,
  onNodeClick,
  selectedEntryId,
}: {
  readonly entries: ReadonlyArray<ProofChainEntry>;
  readonly onNodeClick?: ((entry: ProofChainEntry) => void) | undefined;
  readonly selectedEntryId: string | null;
}) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { roots, nodes, edges, treeWidth, treeHeight } = useMemo(() => {
    const r = buildForest(entries);
    const dims = layoutForest(r);
    return {
      roots: r,
      nodes: flattenNodes(r),
      edges: collectEdges(r),
      treeWidth: dims.width,
      treeHeight: dims.height,
    };
  }, [entries]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || treeWidth === 0) return;
    const rect = el.getBoundingClientRect();
    const sx = (rect.width - PADDING * 2) / treeWidth;
    const sy = (rect.height - PADDING * 2) / treeHeight;
    const s = Math.min(sx, sy, 1);
    setScale(s);
    setPan({ x: (rect.width - treeWidth * s) / 2, y: PADDING });
  }, [treeWidth, treeHeight, entries]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setScale((s) => Math.max(0.1, Math.min(3, s * factor)));
    },
    [],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 0) {
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        panStart.current = { ...pan };
      }
    },
    [pan],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        setPan({
          x: panStart.current.x + (e.clientX - dragStart.current.x),
          y: panStart.current.y + (e.clientY - dragStart.current.y),
        });
      }
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const zoomIn = useCallback(() => setScale((s) => Math.min(3, s * 1.2)), []);
  const zoomOut = useCallback(() => setScale((s) => Math.max(0.1, s / 1.2)), []);
  const fitView = useCallback(() => {
    const el = containerRef.current;
    if (!el || treeWidth === 0) return;
    const rect = el.getBoundingClientRect();
    const sx = (rect.width - PADDING * 2) / treeWidth;
    const sy = (rect.height - PADDING * 2) / treeHeight;
    const s = Math.min(sx, sy, 1);
    setScale(s);
    setPan({ x: (rect.width - treeWidth * s) / 2, y: PADDING });
  }, [treeWidth, treeHeight]);

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500" data-testid="decision-tree-empty">
        No entries to display.
      </div>
    );
  }

  return (
    <div className="relative" data-testid="decision-tree">
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <button
          onClick={zoomIn}
          className="w-8 h-8 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 text-sm font-bold"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={zoomOut}
          className="w-8 h-8 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 text-sm font-bold"
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={fitView}
          className="h-8 px-2 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 text-xs"
          title="Reset view"
        >
          Fit
        </button>
      </div>

      <div className="absolute top-3 left-3 z-10 text-xs text-slate-500">
        {nodes.length} node{nodes.length !== 1 ? "s" : ""} | {roots.length} root{roots.length !== 1 ? "s" : ""}
      </div>

      <div
        ref={containerRef}
        className="w-full h-[500px] bg-slate-950 border border-slate-800 rounded-lg overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <svg width="100%" height="100%" style={{ overflow: "visible" }}>
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {edges.map(({ parent, child }) => (
              <EdgeLine
                key={`${parent.entry.entryId}-${child.entry.entryId}`}
                parent={parent}
                child={child}
              />
            ))}
            {nodes.map((n) => (
              <TreeNodeRect
                key={n.entry.entryId}
                node={n}
                isSelected={selectedEntryId === n.entry.entryId}
                onClick={() => onNodeClick?.(n.entry)}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
