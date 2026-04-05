import { Link } from "react-router";
import type { ProofChainEntry } from "../api.js";

export function NodeDetail({
  entry,
  onClose,
}: {
  readonly entry: ProofChainEntry;
  readonly onClose: () => void;
}) {
  return (
    <div className="border border-slate-700 rounded-lg bg-slate-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-200">
          {entry.tags["agent_role"] ?? entry.tags["agentRole"] ?? entry.actorId ?? entry.entryType}
        </h3>
        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          title="Close detail panel"
        >
          Close detail panel
        </button>
      </div>

      <dl className="space-y-1.5 text-sm">
        <div className="flex gap-2">
          <dt className="text-slate-500">Entry ID:</dt>
          <dd className="font-mono text-xs text-slate-300">{entry.entryId}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-slate-500">Type:</dt>
          <dd className="text-slate-300">{entry.entryType}</dd>
        </div>
        {entry.modelId && (
          <div className="flex gap-2">
            <dt className="text-slate-500">Model:</dt>
            <dd className="text-slate-300">{entry.modelId}</dd>
          </div>
        )}
        {entry.decisionType && (
          <div className="flex gap-2">
            <dt className="text-slate-500">Decision:</dt>
            <dd className="text-slate-300">{entry.decisionType}</dd>
          </div>
        )}
        {entry.confidenceScore !== null && (
          <div className="flex gap-2">
            <dt className="text-slate-500">Confidence:</dt>
            <dd className="text-slate-300">{entry.confidenceScore}</dd>
          </div>
        )}
        {entry.parentEntryId && (
          <div className="flex gap-2">
            <dt className="text-slate-500">Parent entry: </dt>
            <dd className="font-mono text-xs text-slate-400">{entry.parentEntryId.slice(0, 16)}...</dd>
          </div>
        )}
        {entry.annotation && (
          <div className="flex gap-2">
            <dt className="text-slate-500">Annotation:</dt>
            <dd className="text-slate-300">{entry.annotation}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3">
        <Link
          to={`/chains/${entry.chainId}/entries/${entry.entryId}`}
          className="text-xs text-sky-400 hover:text-sky-300 hover:underline"
        >
          Full detail
        </Link>
      </div>
    </div>
  );
}
