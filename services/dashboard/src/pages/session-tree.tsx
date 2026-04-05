import { useState, useCallback } from "react";
import { useParams, Link } from "react-router";
import { fetchEntries } from "../api/client.js";
import { useAsync } from "../hooks/use-async.js";
import { DecisionTree } from "../components/decision-tree.js";
import { TreeNodeDetail } from "../components/tree-node-detail.js";
import type { ProofChainEntry } from "../types.js";

/** Fetch all entries for a session (up to 1000 to cover large workflows). */
function fetchSessionEntries(chainId: string, sessionId: string) {
  return fetchEntries(chainId, 0, 1000, { sessionId });
}

export function SessionTreePage(): React.JSX.Element {
  const { chainId, sessionId } = useParams();
  const [selectedEntry, setSelectedEntry] = useState<ProofChainEntry | null>(
    null,
  );

  const { status, data, error } = useAsync(
    () => {
      if (!chainId || !sessionId) {
        return Promise.reject(new Error("Missing chain or session ID"));
      }
      return fetchSessionEntries(chainId, sessionId);
    },
    [chainId, sessionId],
  );

  const handleNodeClick = useCallback((entry: ProofChainEntry) => {
    setSelectedEntry((prev) =>
      prev?.entryId === entry.entryId ? null : entry,
    );
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link
          to="/chains"
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Audit Trail
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-400 font-mono">
          {sessionId ? `session:${sessionId.slice(0, 12)}...` : ""}
        </span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-100">
          Decision Tree
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Agent delegation tree for session{" "}
          <span className="font-mono text-slate-400">
            {sessionId?.slice(0, 16)}
          </span>
        </p>
      </div>

      {status === "loading" && (
        <div className="text-slate-500">Loading session entries...</div>
      )}
      {status === "error" && (
        <div className="text-red-400">{error}</div>
      )}
      {status === "success" && data && (
        <>
          <DecisionTree
            entries={data.entries}
            onNodeClick={handleNodeClick}
            selectedEntryId={selectedEntry?.entryId ?? null}
          />
          {selectedEntry && (
            <TreeNodeDetail
              entry={selectedEntry}
              onClose={handleCloseDetail}
            />
          )}
        </>
      )}
    </div>
  );
}
