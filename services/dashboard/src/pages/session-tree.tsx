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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          to="/chains"
          className="text-[12px] font-medium text-celestir-text-muted hover:text-celestir-stardust transition-colors"
        >
          Audit Trail
        </Link>
        <span className="text-celestir-text-muted/30">/</span>
        <span className="text-[12px] font-mono text-celestir-text-muted">Decision Tree</span>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-celestir-text">Decision Tree</h1>
        <p className="text-sm text-celestir-text-muted mt-1">
          Agent delegation tree for session <span className="font-mono text-celestir-text-secondary">{sessionId}</span>
        </p>
      </div>

      {entriesResult.status === "loading" && (
        <div className="h-1 bg-celestir-navy-800 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-celestir-aurora rounded-full animate-pulse" />
        </div>
      )}
      {entriesResult.status === "error" && <p className="text-celestir-alert-light text-sm">{entriesResult.error}</p>}
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
