import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import type { ChainSummary } from "../api/types";
import { listChains } from "../api/client";
import { LoadingSpinner } from "../components/loading-spinner";
import { ErrorMessage } from "../components/error-message";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; chains: ReadonlyArray<ChainSummary> };

export function ChainsPage(): ReactNode {
  const [state, setState] = useState<PageState>({ status: "loading" });

  function load(): void {
    setState({ status: "loading" });
    void listChains().then((result) => {
      if (result.ok) {
        setState({ status: "loaded", chains: result.data.chains });
      } else {
        setState({ status: "error", message: result.error });
      }
    });
  }

  useEffect(() => { load(); }, []);

  if (state.status === "loading") {
    return <LoadingSpinner />;
  }

  if (state.status === "error") {
    return <ErrorMessage message={state.message} onRetry={load} />;
  }

  const { chains } = state;

  if (chains.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">No chains found</p>
        <p className="text-sm mt-1">Chains appear here when entries are appended via the API.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-gray-900 mb-4">Proof Chains</h1>
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                Chain ID
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                Entries
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {chains.map((chain) => (
              <tr key={chain.chainId} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <Link
                    to={`/chains/${encodeURIComponent(chain.chainId)}`}
                    className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    {chain.chainId}
                  </Link>
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-700">
                  {chain.entryCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
