import { Link } from "react-router";
import type { ProofChainEntry } from "../types.js";

type EntryTableProps = {
  readonly entries: readonly ProofChainEntry[];
  readonly chainId: string;
};

function truncate(s: string, len: number): string {
  return s.length > len ? `${s.slice(0, len)}...` : s;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const TYPE_COLORS: Record<string, string> = {
  ai_decision: "bg-blue-900/50 text-blue-300",
  human_override: "bg-amber-900/50 text-amber-300",
  system_event: "bg-slate-700/50 text-slate-300",
  policy_check: "bg-purple-900/50 text-purple-300",
  data_access: "bg-emerald-900/50 text-emerald-300",
  model_deployment: "bg-rose-900/50 text-rose-300",
  feedback: "bg-cyan-900/50 text-cyan-300",
  correction: "bg-orange-900/50 text-orange-300",
};

export function EntryTable({
  entries,
  chainId,
}: EntryTableProps): React.JSX.Element {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No entries found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-slate-400">
            <th className="py-3 px-3 font-medium">#</th>
            <th className="py-3 px-3 font-medium">Timestamp</th>
            <th className="py-3 px-3 font-medium">Type</th>
            <th className="py-3 px-3 font-medium">Model</th>
            <th className="py-3 px-3 font-medium">Actor</th>
            <th className="py-3 px-3 font-medium">Session</th>
            <th className="py-3 px-3 font-medium">Hash</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr
              key={entry.entryId}
              className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors"
            >
              <td className="py-2.5 px-3 text-slate-500 tabular-nums">
                {entry.sequenceNumber}
              </td>
              <td className="py-2.5 px-3 tabular-nums">
                <Link
                  to={`/chains/${chainId}/entries/${entry.entryId}`}
                  className="text-sky-400 hover:text-sky-300 hover:underline"
                >
                  {formatTimestamp(entry.timestamp)}
                </Link>
              </td>
              <td className="py-2.5 px-3">
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[entry.entryType] ?? "bg-slate-700 text-slate-300"}`}
                >
                  {entry.entryType}
                </span>
              </td>
              <td className="py-2.5 px-3 text-slate-300 font-mono text-xs">
                {entry.modelId ?? "-"}
              </td>
              <td className="py-2.5 px-3 text-slate-400">
                {entry.actorId ?? "-"}
              </td>
              <td className="py-2.5 px-3 font-mono text-xs">
                {entry.sessionId ? (
                  <Link
                    to={`/chains/${chainId}/sessions/${entry.sessionId}`}
                    className="text-sky-400 hover:text-sky-300 hover:underline"
                    title="View decision tree"
                  >
                    {truncate(entry.sessionId, 12)}
                  </Link>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </td>
              <td className="py-2.5 px-3 text-slate-500 font-mono text-xs">
                {truncate(entry.entryHash, 12)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
