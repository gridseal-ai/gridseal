import { Link } from "react-router-dom";
import type { ChainSummary } from "../types.ts";

export function ChainCard({ chain }: { readonly chain: ChainSummary }) {
  return (
    <Link
      to={`/chains/${encodeURIComponent(chain.chainId)}`}
      className="block bg-white rounded-lg border border-gray-200 p-6 hover:border-seal-300 hover:shadow-md transition-all"
      data-testid="chain-card"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 truncate max-w-xs">
          Chain
        </h3>
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-seal-100 text-seal-800">
          {chain.entryCount} {chain.entryCount === 1 ? "entry" : "entries"}
        </span>
      </div>
      <p
        className="text-xs font-mono text-gray-500 truncate"
        title={chain.chainId}
      >
        {chain.chainId}
      </p>
    </Link>
  );
}
