import { useState, useCallback } from "react";
import { fetchChains, fetchEntries } from "../api/client.js";
import { useAsync } from "../hooks/use-async.js";
import { EntryTable } from "../components/entry-table.js";
import { Filters } from "../components/filters.js";
import { Pagination } from "../components/pagination.js";
import type { EntryFilters } from "../types.js";

const PAGE_SIZE = 25;

export function AuditTrailPage(): React.JSX.Element {
  const [selectedChain, setSelectedChain] = useState<string | null>(null);
  const [filters, setFilters] = useState<EntryFilters>({});
  const [offset, setOffset] = useState(0);

  const chainsState = useAsync(() => fetchChains(), []);

  const entriesState = useAsync(
    () =>
      selectedChain
        ? fetchEntries(selectedChain, offset, PAGE_SIZE, filters)
        : Promise.resolve(null),
    [selectedChain, offset, filters],
  );

  const handleChainSelect = useCallback((chainId: string) => {
    setSelectedChain(chainId);
    setOffset(0);
  }, []);

  const handleFilterApply = useCallback((newFilters: EntryFilters) => {
    setFilters(newFilters);
    setOffset(0);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Audit Trail Explorer</h1>
        <p className="text-sm text-slate-500 mt-1">
          Browse and search proof chain entries.
        </p>
      </div>

      {/* Chain selector */}
      <div>
        <label className="block text-xs text-slate-400 mb-1.5">Chain</label>
        {chainsState.status === "loading" && (
          <p className="text-sm text-slate-500">Loading chains...</p>
        )}
        {chainsState.status === "error" && (
          <p className="text-sm text-red-400">{chainsState.error}</p>
        )}
        {chainsState.status === "success" && chainsState.data && (
          <div className="flex flex-wrap gap-2">
            {chainsState.data.chains.length === 0 && (
              <p className="text-sm text-slate-500">No chains found. Create entries via the API to get started.</p>
            )}
            {chainsState.data.chains.map((chain) => (
              <button
                key={chain.chainId}
                onClick={() => handleChainSelect(chain.chainId)}
                className={`px-3 py-1.5 rounded text-sm font-mono transition-colors ${
                  selectedChain === chain.chainId
                    ? "bg-sky-800 text-sky-200"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                }`}
              >
                {chain.chainId}
                <span className="ml-2 text-xs opacity-60">{chain.entryCount}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      {selectedChain && (
        <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4">
          <Filters filters={filters} onApply={handleFilterApply} />
        </div>
      )}

      {/* Entries */}
      {selectedChain && (
        <div className="bg-slate-900/30 border border-slate-800 rounded-lg overflow-hidden">
          {entriesState.status === "loading" && (
            <div className="p-8 text-center text-slate-500">Loading entries...</div>
          )}
          {entriesState.status === "error" && (
            <div className="p-8 text-center text-red-400">{entriesState.error}</div>
          )}
          {entriesState.status === "success" && entriesState.data && (
            <>
              <EntryTable
                entries={entriesState.data.entries}
                chainId={selectedChain}
              />
              <div className="px-4 py-3 border-t border-slate-800">
                <Pagination
                  offset={entriesState.data.offset}
                  limit={entriesState.data.limit}
                  total={entriesState.data.total}
                  onPageChange={setOffset}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
