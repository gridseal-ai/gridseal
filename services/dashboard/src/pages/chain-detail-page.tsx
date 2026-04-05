import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { ChainSummary, ProofChainEntry, ValidationResult } from "../api/types";
import { getChain, getChainEntries, validateChain } from "../api/client";
import { LoadingSpinner } from "../components/loading-spinner";
import { ErrorMessage } from "../components/error-message";
import { StatusBadge } from "../components/status-badge";
import { HashDisplay } from "../components/hash-display";
import { ValidationBanner } from "../components/validation-banner";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; chain: ChainSummary; entries: ReadonlyArray<ProofChainEntry>; total: number };

const PAGE_SIZE = 50;

export function ChainDetailPage(): ReactNode {
  const { chainId } = useParams<{ chainId: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [offset, setOffset] = useState(0);

  function load(): void {
    if (chainId === undefined) return;
    void Promise.all([
      getChain(chainId),
      getChainEntries(chainId, offset, PAGE_SIZE),
    ]).then(([chainResult, entriesResult]) => {
      if (chainResult.ok && entriesResult.ok) {
        setState({
          status: "loaded",
          chain: chainResult.data,
          entries: entriesResult.data.entries,
          total: entriesResult.data.total,
        });
      } else {
        const msg = !chainResult.ok ? chainResult.error : !entriesResult.ok ? entriesResult.error : "Unknown error";
        setState({ status: "error", message: msg });
      }
    });
  }

  useEffect(() => { load(); }, [chainId, offset]);

  if (chainId === undefined) {
    return <ErrorMessage message="Missing chain ID" />;
  }

  if (state.status === "loading") {
    return <LoadingSpinner />;
  }

  if (state.status === "error") {
    return <ErrorMessage message={state.message} onRetry={() => { setState({ status: "loading" }); load(); }} />;
  }

  const { chain, entries, total } = state;

  async function handleValidate(): Promise<ValidationResult> {
    const result = await validateChain(chainId as string);
    if (result.ok) return result.data;
    return { valid: false, chainId: chainId as string, entryCount: 0, error: { type: result.error } };
  }

  return (
    <div>
      <div className="mb-4">
        <Link to="/" className="text-sm text-blue-600 hover:underline">
          All Chains
        </Link>
        <span className="text-gray-400 mx-2">/</span>
        <span className="font-mono text-sm text-gray-700">{chainId}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Chain Detail</h1>
          <p className="text-sm text-gray-500 mt-1">{chain.entryCount} entries</p>
        </div>
        <ValidationBanner onValidate={handleValidate} />
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500">No entries in this chain.</p>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Seq</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {entries.map((entry) => (
                  <tr key={entry.entryId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{entry.sequenceNumber}</td>
                    <td className="px-4 py-3">
                      <EntryTypeBadge type={entry.entryType} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {entry.modelId !== null ? entry.modelId : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(entry.entryId)}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <HashDisplay hash={entry.entryHash} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => { setState({ status: "loading" }); setOffset(Math.max(0, offset - PAGE_SIZE)); }}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-500">
                {offset + 1} - {Math.min(offset + PAGE_SIZE, total)} of {total}
              </span>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => { setState({ status: "loading" }); setOffset(offset + PAGE_SIZE); }}
                className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function EntryTypeBadge({ type }: { readonly type: string }): ReactNode {
  const variant = type === "ai_decision" ? "info"
    : type === "human_override" ? "warning"
    : type === "policy_check" ? "success"
    : type === "correction" ? "error"
    : "neutral";
  return <StatusBadge variant={variant}>{type.replace(/_/g, " ")}</StatusBadge>;
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}
