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
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-600"
      />
    </div>
  );
}

function EntryRow({ entry, chainId }: { readonly entry: ProofChainEntry; readonly chainId: string }) {
  return (
    <tr className="border-t border-slate-800/50 hover:bg-slate-900/30 transition-colors">
      <td className="py-2.5 px-3">
        <Link
          to={`/chains/${chainId}/entries/${entry.entryId}`}
          className="font-mono text-xs text-sky-400 hover:text-sky-300 hover:underline"
        >
          {entry.entryId.slice(0, 12)}...
        </Link>
      </td>
      <td className="py-2.5 px-3 text-sm text-slate-300">{entry.entryType}</td>
      <td className="py-2.5 px-3 text-xs text-slate-400 font-mono">{entry.timestamp}</td>
      <td className="py-2.5 px-3 text-sm text-slate-400">{entry.modelId ?? "-"}</td>
      <td className="py-2.5 px-3 text-sm text-slate-400">{entry.actorId ?? "-"}</td>
      <td className="py-2.5 px-3">
        {entry.sessionId ? (
          <Link
            to={`/chains/${chainId}/sessions/${entry.sessionId}`}
            className="text-xs text-sky-400 hover:text-sky-300 hover:underline font-mono"
          >
            {entry.sessionId.slice(0, 12)}...
          </Link>
        ) : (
          <span className="text-sm text-slate-500">-</span>
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
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Audit Trail Explorer</h1>
        <p className="text-sm text-slate-500 mt-1">
          Browse and inspect proof chain entries.
        </p>
      </div>

      {chainsResult.status === "loading" && <p className="text-slate-500">Loading chains...</p>}
      {chainsResult.status === "error" && <p className="text-red-400">{chainsResult.error}</p>}
      {chainsResult.status === "success" && chainsResult.data && (
        <div className="flex flex-wrap gap-2">
          {chainsResult.data.chains.length === 0 && (
            <p className="text-slate-500">No chains found.</p>
          )}
          {chainsResult.data.chains.map((chain) => (
            <button
              key={chain.chainId}
              onClick={() => selectChain(chain.chainId)}
              className={`px-3 py-1.5 text-sm rounded border transition-colors ${
                selectedChain === chain.chainId
                  ? "bg-sky-900/30 border-sky-700 text-sky-300"
                  : "bg-slate-900/30 border-slate-800 text-slate-400 hover:bg-slate-800"
              }`}
            >
              <span className="font-mono">{chain.chainId}</span>
              <span className="ml-2 text-xs text-slate-500">{chain.entryCount} entries</span>
            </button>
          ))}
        </div>
      )}

      {selectedChain && (
        <div>
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {showFilters ? "Hide filters" : "Show filters"}
          </button>
          {showFilters && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3">
              <FilterInput label="Model ID" value={filters.modelId} onChange={(v) => updateFilter("modelId", v)} placeholder="gpt-4o" />
              <FilterInput label="Actor ID" value={filters.actorId} onChange={(v) => updateFilter("actorId", v)} placeholder="user-123" />
              <FilterInput label="Session ID" value={filters.sessionId} onChange={(v) => updateFilter("sessionId", v)} placeholder="session-..." />
              <FilterInput label="Start Date" value={filters.startDate} onChange={(v) => updateFilter("startDate", v)} type="datetime-local" />
              <FilterInput label="End Date" value={filters.endDate} onChange={(v) => updateFilter("endDate", v)} type="datetime-local" />
              <button
                onClick={clearFilters}
                className="self-end px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {selectedChain && entriesResult.status === "loading" && (
        <p className="text-slate-500">Loading entries...</p>
      )}
      {selectedChain && entriesResult.status === "error" && (
        <p className="text-red-400">{entriesResult.error}</p>
      )}
      {selectedChain && entriesResult.status === "success" && entriesResult.data && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-slate-500 uppercase tracking-wider">
                  <th className="py-2 px-3 font-medium">Entry ID</th>
                  <th className="py-2 px-3 font-medium">Type</th>
                  <th className="py-2 px-3 font-medium">Timestamp</th>
                  <th className="py-2 px-3 font-medium">Model</th>
                  <th className="py-2 px-3 font-medium">Actor</th>
                  <th className="py-2 px-3 font-medium">Session</th>
                </tr>
              </thead>
              <tbody>
                {entriesResult.data.entries.map((entry) => (
                  <EntryRow key={entry.entryId} entry={entry} chainId={selectedChain} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <span className="text-xs text-slate-500">
              Showing {offset + 1}-{Math.min(offset + PAGE_SIZE, entriesResult.data.total)} of{" "}
              {entriesResult.data.total}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                disabled={offset === 0}
                className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                disabled={offset + PAGE_SIZE >= entriesResult.data.total}
                className="px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-400 hover:bg-slate-700 disabled:opacity-50 transition-colors"
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
