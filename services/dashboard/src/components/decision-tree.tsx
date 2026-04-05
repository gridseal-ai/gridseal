import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type { ProofChainEntry } from "../types.js";
import {
  buildForest,
  layoutTree,
  flattenTree,
  collectEdges,
} from "../tree-layout.js";
import { EdgePath, TreeNodeRect } from "./tree-node-rendering.js";

type DecisionTreeProps = {
  readonly entries: readonly ProofChainEntry[];
  readonly onNodeClick?: (entry: ProofChainEntry) => void;
  readonly selectedEntryId?: string | null;
};

const PADDING = 40;

export function DecisionTree({
  entries,
  onNodeClick,
  selectedEntryId,
}: DecisionTreeProps): React.JSX.Element {
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const panOffsetStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { roots, nodes, edges, treeWidth, treeHeight } = useMemo(() => {
    const forest = buildForest(entries);
    const dims = layoutTree(forest);
    return {
      roots: forest,
      nodes: flattenTree(forest),
      edges: collectEdges(forest),
      treeWidth: dims.width,
      treeHeight: dims.height,
    };
  }, [entries]);

  /** Auto-fit on mount and when entries change. */
  useEffect(() => {
    if (!containerRef.current || treeWidth === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = (rect.width - PADDING * 2) / treeWidth;
    const scaleY = (rect.height - PADDING * 2) / treeHeight;
    const fitScale = Math.min(scaleX, scaleY, 1);
    setScale(fitScale);
    setPanOffset({
      x: (rect.width - treeWidth * fitScale) / 2,
      y: PADDING,
    });
  }, [treeWidth, treeHeight, entries]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(3, scale * delta));
      setScale(newScale);
    },
    [scale],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY };
      panOffsetStart.current = { ...panOffset };
    },
    [panOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      setPanOffset({
        x: panOffsetStart.current.x + (e.clientX - panStart.current.x),
        y: panOffsetStart.current.y + (e.clientY - panStart.current.y),
      });
    },
    [isPanning],
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const handleNodeClick = useCallback(
    (entry: ProofChainEntry) => {
      onNodeClick?.(entry);
    },
    [onNodeClick],
  );

  const handleZoomIn = useCallback(() => {
    setScale((s) => Math.min(3, s * 1.2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((s) => Math.max(0.1, s / 1.2));
  }, []);

  const handleResetView = useCallback(() => {
    if (!containerRef.current || treeWidth === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = (rect.width - PADDING * 2) / treeWidth;
    const scaleY = (rect.height - PADDING * 2) / treeHeight;
    const fitScale = Math.min(scaleX, scaleY, 1);
    setScale(fitScale);
    setPanOffset({
      x: (rect.width - treeWidth * fitScale) / 2,
      y: PADDING,
    });
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
      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <button
          onClick={handleZoomIn}
          className="w-8 h-8 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 text-sm font-bold"
          title="Zoom in"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          className="w-8 h-8 bg-slate-800 border border-slate-700 rounded text-slate-300 hover:bg-slate-700 text-sm font-bold"
          title="Zoom out"
        >
          -
        </button>
        <button
          onClick={handleResetView}
          className="h-8 px-2 bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 text-xs"
          title="Reset view"
        >
          Fit
        </button>
      </div>

      {/* Node count */}
      <div className="absolute top-3 left-3 z-10 text-xs text-slate-500">
        {nodes.length} node{nodes.length !== 1 ? "s" : ""} | {roots.length} root{roots.length !== 1 ? "s" : ""}
      </div>

      {/* SVG canvas */}
      <div
        ref={containerRef}
        className="w-full h-[500px] bg-slate-950 border border-slate-800 rounded-lg overflow-hidden"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <svg
          width="100%"
          height="100%"
          style={{
            overflow: "visible",
          }}
        >
          <g transform={`translate(${panOffset.x}, ${panOffset.y}) scale(${scale})`}>
            {edges.map(({ parent, child }) => (
              <EdgePath
                key={`${parent.entry.entryId}-${child.entry.entryId}`}
                parent={parent}
                child={child}
              />
            ))}
            {nodes.map((node) => (
              <TreeNodeRect
                key={node.entry.entryId}
                node={node}
                isSelected={selectedEntryId === node.entry.entryId}
                onClick={() => handleNodeClick(node.entry)}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
