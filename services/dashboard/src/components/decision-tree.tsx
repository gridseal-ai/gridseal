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

const STATUS_THEMES: Record<string, { fill: string; glow: string; text: string; border: string; label: string }> = {
  approved: {
    fill: "#0A2E1A",
    glow: "rgba(46, 204, 113, 0.12)",
    text: "#52D989",
    border: "#2ECC71",
    label: "VERIFIED",
  },
  rejected: {
    fill: "#1A0A0A",
    glow: "rgba(220, 38, 38, 0.12)",
    text: "#EF4444",
    border: "#DC2626",
    label: "REJECTED",
  },
  pending: {
    fill: "#1A1400",
    glow: "rgba(217, 119, 6, 0.12)",
    text: "#F59E0B",
    border: "#D97706",
    label: "PENDING",
  },
};

const DEFAULT_THEME = {
  fill: "#0F1F36",
  glow: "rgba(27, 107, 154, 0.06)",
  text: "#94A3B8",
  border: "#1B6B9A",
  label: "",
};

function getTheme(entry: ProofChainEntry) {
  const status = entry.tags["review_status"] ?? entry.tags["reviewStatus"];
  if (status && status in STATUS_THEMES) return STATUS_THEMES[status]!;
  return DEFAULT_THEME;
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

function ConstellationEdge({ parent, child }: Edge) {
  const x1 = parent.x + NODE_W / 2;
  const y1 = parent.y + NODE_H;
  const x2 = child.x + NODE_W / 2;
  const y2 = child.y;
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
        fill="none"
        stroke="url(#edge-gradient)"
        strokeWidth={1.5}
      />
      <circle cx={x1} cy={y1} r={2} fill="#4DA8DA" opacity={0.5} />
      <circle cx={x2} cy={y2} r={2} fill="#4DA8DA" opacity={0.5} />
    </g>
  );
}

function ConstellationNode({
  node,
  isSelected,
  onClick,
}: {
  readonly node: TreeNode;
  readonly isSelected: boolean;
  readonly onClick: () => void;
}) {
  const { entry } = node;
  const theme = getTheme(entry);
  const label = nodeLabel(entry);
  const summary = nodeSummary(entry);
  const borderColor = isSelected ? "#4DA8DA" : theme.border;
  const borderWidth = isSelected ? 2 : 1;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`Tree node: ${label}`}
      data-testid={`tree-node-${entry.entryId}`}
    >
      {isSelected && (
        <rect
          x={-4}
          y={-4}
          width={NODE_W + 8}
          height={NODE_H + 8}
          rx={12}
          ry={12}
          fill="none"
          stroke="#4DA8DA"
          strokeWidth={1}
          strokeOpacity={0.2}
        />
      )}
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={8}
        ry={8}
        fill={theme.fill}
        stroke={borderColor}
        strokeWidth={borderWidth}
        strokeOpacity={isSelected ? 1 : 0.5}
      />
      <rect
        x={0}
        y={0}
        width={3}
        height={NODE_H}
        rx={1.5}
        fill={theme.border}
        opacity={0.8}
      />
      <text x={14} y={22} fill={theme.text} fontSize={13} fontWeight={600} fontFamily='"DM Sans", system-ui, sans-serif'>
        {truncate(label, 22)}
      </text>
      <text x={14} y={40} fill="#64748B" fontSize={10} fontFamily='"DM Sans", system-ui, sans-serif'>
        {truncate(summary, 28)}
      </text>
      {theme.label && (
        <text x={14} y={60} fill={theme.text} fontSize={9} fontWeight={700} fontFamily='"JetBrains Mono", monospace' letterSpacing={1}>
          {theme.label}
        </text>
      )}
      <text x={NODE_W - 10} y={20} fill="#64748B" fontSize={9} textAnchor="end" fontFamily='"JetBrains Mono", monospace'>
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
      <div className="glass-panel rounded-lg text-center py-16 text-celestir-text-muted" data-testid="decision-tree-empty">
        No entries to display.
      </div>
    );
  }

  return (
    <div className="relative" data-testid="decision-tree">
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <button onClick={zoomIn} className="w-8 h-8 glass-panel rounded-md text-celestir-text-secondary hover:text-celestir-text text-sm font-bold transition-colors" title="Zoom in">+</button>
        <button onClick={zoomOut} className="w-8 h-8 glass-panel rounded-md text-celestir-text-secondary hover:text-celestir-text text-sm font-bold transition-colors" title="Zoom out">-</button>
        <button onClick={fitView} className="h-8 px-3 glass-panel rounded-md text-celestir-text-muted hover:text-celestir-text text-[11px] font-medium transition-colors" title="Reset view">Fit</button>
      </div>

      <div className="absolute top-3 left-3 z-10 text-[11px] font-mono text-celestir-text-muted/60">
        {nodes.length} node{nodes.length !== 1 ? "s" : ""} / {roots.length} root{roots.length !== 1 ? "s" : ""}
      </div>

      <div
        ref={containerRef}
        className="w-full h-[560px] glass-panel rounded-lg overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        <svg width="100%" height="100%" style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="edge-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#4DA8DA" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#1B6B9A" stopOpacity={0.15} />
            </linearGradient>
            <filter id="node-glow">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {edges.map(({ parent, child }) => (
              <ConstellationEdge
                key={`${parent.entry.entryId}-${child.entry.entryId}`}
                parent={parent}
                child={child}
              />
            ))}
            {nodes.map((n) => (
              <ConstellationNode
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
