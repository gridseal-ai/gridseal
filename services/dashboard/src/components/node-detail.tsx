import { Link } from "react-router";
import type { ProofChainEntry } from "../api.js";

function Field({ label, value, mono }: { readonly label: string; readonly value: string | null | undefined; readonly mono?: boolean }) {
  return (
    <div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">{label}</span>
      <p className={`mt-0.5 text-[13px] text-celestir-text ${mono ? "font-mono text-[11px] break-all" : ""}`}>
        {value ?? <span className="text-celestir-text-muted/30">-</span>}
      </p>
    </div>
  );
}

export function NodeDetail({
  entry,
  onClose,
}: {
  readonly entry: ProofChainEntry;
  readonly onClose: () => void;
}) {
  return (
    <div className="glass-panel rounded-lg p-5 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-celestir-stardust" />
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-celestir-text-muted">
            Node Detail
          </h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-md bg-celestir-navy-800/50 border border-celestir-navy-700/30 text-celestir-text-muted hover:text-celestir-text hover:bg-celestir-navy-700/50 text-[13px] transition-all flex items-center justify-center"
          title="Close"
        >
          x
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Entry ID" value={entry.entryId} mono />
        <Field label="Type" value={entry.entryType} />
        <Field label="Model" value={entry.modelId} />
        <Field label="Actor" value={entry.actorId} />
        <Field label="Decision" value={entry.decisionType} />
        <Field label="Confidence" value={entry.confidenceScore !== null ? `${Math.round(entry.confidenceScore * 100)}%` : null} />
        <Field label="Session" value={entry.sessionId} mono />
        <Field label="Timestamp" value={entry.timestamp} mono />
        <div className="col-span-2">
          <Field label="Entry Hash" value={entry.entryHash} mono />
        </div>
        <div className="col-span-2">
          <Field label="Previous Hash" value={entry.previousHash} mono />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-celestir-navy-700/20">
        <Link
          to={`/chains/${entry.chainId}/entries/${entry.entryId}`}
          className="text-[12px] font-medium text-celestir-stardust hover:text-celestir-stardust-light transition-colors"
        >
          View full entry detail
        </Link>
      </div>
    </div>
  );
}
