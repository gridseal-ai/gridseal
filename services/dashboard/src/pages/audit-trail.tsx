import { useState, useCallback } from "react";
import { Link } from "react-router";
import { listChains, listEntries } from "../api.js";
import { useAsync } from "../hooks/use-async.js";
import type { ProofChainEntry } from "../api.js";

const PAGE_SIZE = 20;

type Filters = {
  modelId: string;
  actorId: string;
  sessionId: string;
  startDate: string;
  endDate: string;
};

function emptyFilters(): Filters {
  return { modelId: "", actorId: "", sessionId: "", startDate: "", endDate: "" };
}

const ENTRY_TYPE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  ai_decision:      { bg: "bg-celestir-stardust/10", text: "text-celestir-stardust", dot: "bg-celestir-stardust" },
  human_override:   { bg: "bg-celestir-nebula/10", text: "text-celestir-nebula-light", dot: "bg-celestir-nebula" },
  system_event:     { bg: "bg-celestir-aurora/10", text: "text-celestir-aurora-light", dot: "bg-celestir-aurora" },
  policy_check:     { bg: "bg-celestir-warn/10", text: "text-celestir-warn-light", dot: "bg-celestir-warn" },
  data_access:      { bg: "bg-celestir-text-muted/10", text: "text-celestir-text-secondary", dot: "bg-celestir-text-muted" },
  model_deployment: { bg: "bg-celestir-verify/10", text: "text-celestir-verify", dot: "bg-celestir-verify" },
  feedback:         { bg: "bg-celestir-stardust/10", text: "text-celestir-stardust-dim", dot: "bg-celestir-stardust-dim" },
  correction:       { bg: "bg-celestir-alert/10", text: "text-celestir-alert-light", dot: "bg-celestir-alert" },
};

const DEFAULT_TYPE_STYLE = { bg: "bg-celestir-navy-800", text: "text-celestir-text-muted", dot: "bg-celestir-text-muted" };

function TypeBadge({ type }: { readonly type: string }) {
  const style = ENTRY_TYPE_STYLES[type] ?? DEFAULT_TYPE_STYLE;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${style.bg} ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {type.replace(/_/g, " ")}
    </span>
  );
}

function ConfidenceBar({ score }: { readonly score: number | null }) {
  if (score === null) return <span className="text-celestir-text-muted">-</span>;
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? "bg-celestir-verify" : pct >= 70 ? "bg-celestir-stardust" : pct >= 50 ? "bg-celestir-warn" : "bg-celestir-alert";
  return (
    <div className="flex items-center gap-2">
      <div className="w-12 h-1.5 rounded-full bg-celestir-navy-700/50 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono text-celestir-text-muted">{pct}%</span>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (v: string) => void;
  readonly placeholder?: string | undefined;
  readonly type?: string | undefined;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-celestir-text-muted mb-1.5">{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-celestir-navy-900/80 border border-celestir-navy-700/50 rounded-md text-celestir-text placeholder-celestir-text-muted/40 focus:outline-none focus:border-celestir-aurora/50 focus:ring-1 focus:ring-celestir-aurora/20 transition-all"
      />
    </div>
  );
}

function EntryRow({ entry, chainId, index }: { readonly entry: ProofChainEntry; readonly chainId: string; readonly index: number }) {
  return (
    <tr
      className="row-glow border-t border-celestir-navy-800/30 transition-all duration-150 animate-fade-in"
      style={{ animationDelay: `${index * 20}ms` }}
    >
      <td className="py-3 px-4">
        <Link
          to={`/chains/${chainId}/entries/${entry.entryId}`}
          className="font-mono text-[12px] text-celestir-stardust hover:text-celestir-stardust-light transition-colors"
        >
          {entry.entryId.slice(0, 8)}
          <span className="text-celestir-text-muted/40">...</span>
        </Link>
      </td>
      <td className="py-3 px-4">
        <TypeBadge type={entry.entryType} />
      </td>
      <td className="py-3 px-4 font-mono text-[11px] text-celestir-text-muted tabular-nums">
        {new Date(entry.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </td>
      <td className="py-3 px-4">
        <span className="text-[13px] text-celestir-text-secondary">{entry.modelId ?? <span className="text-celestir-text-muted/40">-</span>}</span>
      </td>
      <td className="py-3 px-4">
        <span className="text-[13px] text-celestir-text-secondary">{entry.actorId ?? <span className="text-celestir-text-muted/40">-</span>}</span>
      </td>
      <td className="py-3 px-4">
        <ConfidenceBar score={entry.confidenceScore} />
      </td>
      <td className="py-3 px-4">
        {entry.sessionId ? (
          <Link
            to={`/chains/${chainId}/sessions/${entry.sessionId}`}
            className="font-mono text-[11px] text-celestir-aurora hover:text-celestir-aurora-light transition-colors"
          >
            {entry.sessionId.slice(0, 16)}...
          </Link>
        ) : (
          <span className="text-celestir-text-muted/40">-</span>
        )}
      </td>
    </tr>
  );
}

export function AuditTrailPage() {
  const chainsResult = useAsync(() => listChains(), []);
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [showFilters, setShowFilters] = useState(false);

  const activeFilters = {
    modelId: filters.modelId || undefined,
    actorId: filters.actorId || undefined,
    sessionId: filters.sessionId || undefined,
    startDate: filters.startDate || undefined,
    endDate: filters.endDate || undefined,
  };

  const entriesResult = useAsync(
    () =>
      selectedChain
        ? listEntries(selectedChain, offset, PAGE_SIZE, activeFilters)
        : Promise.resolve(null),
    [selectedChain, offset, filters.modelId, filters.actorId, filters.sessionId, filters.startDate, filters.endDate],
  );

  const selectChain = useCallback((chainId: string) => {
    setSelectedChain(chainId);
    setOffset(0);
  }, []);

  const updateFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setOffset(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(emptyFilters());
    setOffset(0);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-celestir-text">Audit Trail</h1>
          <p className="text-sm text-celestir-text-muted mt-1">
            Browse and inspect proof chain entries
          </p>
        </div>
        {selectedChain && entriesResult.status === "success" && entriesResult.data && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="status-dot status-dot-verified" />
              <span className="text-[12px] font-mono text-celestir-text-muted">
                {entriesResult.data.total} entries
              </span>
            </div>
          </div>
        )}
      </div>

      {chainsResult.status === "loading" && <p className="text-celestir-text-muted text-sm">Loading chains...</p>}
      {chainsResult.status === "error" && <p className="text-celestir-alert-light text-sm">{chainsResult.error}</p>}
      {chainsResult.status === "success" && chainsResult.data && (
        <div className="flex flex-wrap gap-2">
          {chainsResult.data.chains.length === 0 && (
            <p className="text-celestir-text-muted text-sm">No chains found.</p>
          )}
          {chainsResult.data.chains.map((chain) => (
            <button
              key={chain.chainId}
              onClick={() => selectChain(chain.chainId)}
              className={`glass-panel px-4 py-2.5 rounded-lg transition-all duration-200 ${
                selectedChain === chain.chainId
                  ? "!border-celestir-aurora/40 shadow-[0_0_12px_rgba(27,107,154,0.15)]"
                  : "hover:!border-celestir-navy-600/50"
              }`}
            >
              <span className={`font-mono text-[13px] ${selectedChain === chain.chainId ? "text-celestir-stardust" : "text-celestir-text-secondary"}`}>
                {chain.chainId}
              </span>
              <span className="ml-3 text-[11px] text-celestir-text-muted">{chain.entryCount} entries</span>
            </button>
          ))}
        </div>
      )}

      {selectedChain && (
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className={`text-[12px] font-medium transition-colors ${showFilters ? "text-celestir-stardust" : "text-celestir-text-muted hover:text-celestir-text-secondary"}`}
          >
            {showFilters ? "Hide filters" : "Filters"}
          </button>
          {showFilters && (
            <button
              onClick={clearFilters}
              className="text-[11px] text-celestir-text-muted hover:text-celestir-alert-light transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
      {selectedChain && showFilters && (
        <div className="glass-panel rounded-lg p-4 grid grid-cols-2 md:grid-cols-5 gap-3 animate-fade-in">
          <FilterInput label="Model" value={filters.modelId} onChange={(v) => updateFilter("modelId", v)} placeholder="gpt-4o" />
          <FilterInput label="Actor" value={filters.actorId} onChange={(v) => updateFilter("actorId", v)} placeholder="analyst-chen" />
          <FilterInput label="Session" value={filters.sessionId} onChange={(v) => updateFilter("sessionId", v)} placeholder="session-..." />
          <FilterInput label="From" value={filters.startDate} onChange={(v) => updateFilter("startDate", v)} type="datetime-local" />
          <FilterInput label="To" value={filters.endDate} onChange={(v) => updateFilter("endDate", v)} type="datetime-local" />
        </div>
      )}

      {selectedChain && entriesResult.status === "loading" && (
        <div className="h-1 bg-celestir-navy-800 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-celestir-aurora rounded-full animate-pulse" />
        </div>
      )}
      {selectedChain && entriesResult.status === "error" && (
        <p className="text-celestir-alert-light text-sm">{entriesResult.error}</p>
      )}
      {selectedChain && entriesResult.status === "success" && entriesResult.data && (
        <div className="glass-panel rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-celestir-navy-700/30">
                  <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">Entry</th>
                  <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">Type</th>
                  <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">Timestamp</th>
                  <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">Model</th>
                  <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">Actor</th>
                  <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">Confidence</th>
                  <th className="py-3 px-4 text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">Session</th>
                </tr>
              </thead>
              <tbody>
                {entriesResult.data.entries.map((entry, i) => (
                  <EntryRow key={entry.entryId} entry={entry} chainId={selectedChain} index={i} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-4 py-3 border-t border-celestir-navy-700/30">
            <span className="text-[11px] font-mono text-celestir-text-muted">
              {offset + 1}-{Math.min(offset + PAGE_SIZE, entriesResult.data.total)} of {entriesResult.data.total}
            </span>
            <div className="flex gap-1.5">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-[12px] font-medium bg-celestir-navy-800/50 border border-celestir-navy-700/30 rounded-md text-celestir-text-muted hover:text-celestir-text-secondary hover:bg-celestir-navy-700/50 disabled:opacity-30 transition-all"
              >
                Prev
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= entriesResult.data.total}
                className="px-3 py-1.5 text-[12px] font-medium bg-celestir-navy-800/50 border border-celestir-navy-700/30 rounded-md text-celestir-text-muted hover:text-celestir-text-secondary hover:bg-celestir-navy-700/50 disabled:opacity-30 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
