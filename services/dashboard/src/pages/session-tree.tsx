import { useState, useCallback } from "react";
import { useParams, Link } from "react-router";
import { listChains, listEntries } from "../api.js";
import { useAsync } from "../hooks/use-async.js";
import { DecisionTree } from "../components/decision-tree.js";
import { NodeDetail } from "../components/node-detail.js";
import type { ProofChainEntry } from "../api.js";

export function SessionTreePage() {
  const { chainId, sessionId } = useParams();
  const [selectedEntry, setSelectedEntry] = useState<ProofChainEntry | null>(null);

  const chainsResult = useAsync(() => listChains(), []);

  const resolvedChainId = chainId ?? (
    chainsResult.status === "success" && chainsResult.data
      ? chainsResult.data.chains[0]?.chainId ?? null
      : null
  );

  const entriesResult = useAsync(
    () => {
      if (!resolvedChainId || !sessionId) return Promise.resolve(null);
      return listEntries(resolvedChainId, 0, 1000, { sessionId });
    },
    [resolvedChainId, sessionId],
  );

  const handleNodeClick = useCallback((entry: ProofChainEntry) => {
    setSelectedEntry((prev) => (prev?.entryId === entry.entryId ? null : entry));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/chains"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Back to Audit Trail
        </Link>
        <h1 className="text-xl font-semibold text-slate-100 mt-2">Decision Tree</h1>
        <p className="text-sm text-slate-500 mt-1">
          Agent delegation tree for session <span className="font-mono">{sessionId}</span>
        </p>
      </div>

      {entriesResult.status === "loading" && <p className="text-slate-500">Loading session entries...</p>}
      {entriesResult.status === "error" && <p className="text-red-400">{entriesResult.error}</p>}
      {entriesResult.status === "success" && entriesResult.data && (
        <div className="space-y-4">
          <DecisionTree
            entries={entriesResult.data.entries}
            onNodeClick={handleNodeClick}
            selectedEntryId={selectedEntry?.entryId ?? null}
          />

          {selectedEntry && (
            <NodeDetail
              entry={selectedEntry}
              onClose={() => setSelectedEntry(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
