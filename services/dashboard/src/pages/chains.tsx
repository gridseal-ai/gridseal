import { useEffect, useState, useCallback } from "react";
import type { ChainSummary } from "../types.ts";
import { listChains } from "../api/client.ts";
import { ChainCard } from "../components/chain-card.tsx";
import { Loading } from "../components/loading.tsx";
import { ErrorMessage } from "../components/error-message.tsx";

type PageState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "loaded"; readonly chains: ReadonlyArray<ChainSummary> };

export function ChainsPage() {
  const [state, setState] = useState<PageState>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const result = await listChains();
    if (result.ok) {
      setState({ status: "loaded", chains: result.value.chains });
    } else {
      setState({ status: "error", message: result.error });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Proof Chains</h1>
        <p className="mt-1 text-sm text-gray-500">
          All audit trail chains and their verification status.
        </p>
      </div>

      {state.status === "loading" && <Loading label="Loading chains..." />}

      {state.status === "error" && (
        <ErrorMessage message={state.message} onRetry={() => void load()} />
      )}

      {state.status === "loaded" && state.chains.length === 0 && (
        <div className="text-center py-12 text-gray-500" data-testid="empty-chains">
          No chains found. Create entries via the API to get started.
        </div>
      )}

      {state.status === "loaded" && state.chains.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="chains-grid">
          {state.chains.map((chain) => (
            <ChainCard key={chain.chainId} chain={chain} />
          ))}
        </div>
      )}
    </div>
  );
}
