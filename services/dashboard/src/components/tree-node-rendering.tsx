import type { ProofChainEntry } from "../types.js";
import { NODE_WIDTH, NODE_HEIGHT, type TreeNode } from "../tree-layout.js";

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  approved: { bg: "#064e3b", text: "#6ee7b7", border: "#059669" },
  rejected: { bg: "#450a0a", text: "#fca5a5", border: "#dc2626" },
  pending: { bg: "#422006", text: "#fcd34d", border: "#d97706" },
};

const DEFAULT_STATUS_COLOR = { bg: "#1e293b", text: "#94a3b8", border: "#334155" };

export function getNodeColors(entry: ProofChainEntry): { bg: string; text: string; border: string } {
  const reviewStatus = entry.tags["review_status"] ?? entry.tags["reviewStatus"];
  if (reviewStatus && reviewStatus in STATUS_COLORS) {
    return STATUS_COLORS[reviewStatus]!;
  }
  return DEFAULT_STATUS_COLOR;
}

export function getAgentRole(entry: ProofChainEntry): string {
  return (
    entry.tags["agent_role"] ??
    entry.tags["agentRole"] ??
    entry.actorId ??
    entry.entryType
  );
}

export function getAuthorityLevel(entry: ProofChainEntry): string | null {
  return (
    entry.tags["authority_level"] ??
    entry.tags["authorityLevel"] ??
    null
  );
}

export function getReviewStatus(entry: ProofChainEntry): string | null {
  return (
    entry.tags["review_status"] ??
    entry.tags["reviewStatus"] ??
    null
  );
}

export function getSummary(entry: ProofChainEntry): string {
  return (
    entry.annotation ??
    entry.tags["summary"] ??
    entry.decisionType ??
    entry.entryType
  );
}

function truncateText(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen - 1)}...` : text;
}

export function EdgePath({ parent, child }: { parent: TreeNode; child: TreeNode }): React.JSX.Element {
  const x1 = parent.x + NODE_WIDTH / 2;
  const y1 = parent.y + NODE_HEIGHT;
  const x2 = child.x + NODE_WIDTH / 2;
  const y2 = child.y;
  const midY = (y1 + y2) / 2;

  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
      fill="none"
      stroke="#334155"
      strokeWidth={1.5}
      strokeOpacity={0.7}
    />
  );
}

export function TreeNodeRect({
  node,
  isSelected,
  onClick,
}: {
  node: TreeNode;
  isSelected: boolean;
  onClick: () => void;
}): React.JSX.Element {
  const { entry } = node;
  const colors = getNodeColors(entry);
  const role = getAgentRole(entry);
  const authority = getAuthorityLevel(entry);
  const reviewStatus = getReviewStatus(entry);
  const summary = getSummary(entry);

  const borderColor = isSelected ? "#38bdf8" : colors.border;
  const strokeWidth = isSelected ? 2.5 : 1.5;

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      onClick={onClick}
      style={{ cursor: "pointer" }}
      role="button"
      aria-label={`Tree node: ${role}`}
      data-testid={`tree-node-${entry.entryId}`}
    >
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        ry={8}
        fill={colors.bg}
        stroke={borderColor}
        strokeWidth={strokeWidth}
      />
      <text
        x={10}
        y={20}
        fill={colors.text}
        fontSize={13}
        fontWeight={600}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {truncateText(role, 26)}
      </text>
      <text
        x={10}
        y={38}
        fill="#94a3b8"
        fontSize={10}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {authority ? `Level: ${authority}` : ""}
        {authority && reviewStatus ? "  |  " : ""}
        {reviewStatus ? `Review: ${reviewStatus}` : ""}
      </text>
      <text
        x={10}
        y={58}
        fill="#cbd5e1"
        fontSize={11}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {truncateText(summary, 30)}
      </text>
      <text
        x={NODE_WIDTH - 10}
        y={20}
        fill="#64748b"
        fontSize={10}
        textAnchor="end"
        fontFamily="ui-monospace, monospace"
      >
        #{entry.sequenceNumber}
      </text>
    </g>
  );
}
