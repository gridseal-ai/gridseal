import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import type { PaginatedEntries } from "../types.ts";
import type { ValidationResult } from "../types.ts";
import {
  getChainEntries,
  validateChain,
} from "../api/client.ts";
import { EntryTable } from "../components/entry-table.tsx";
import { Pagination } from "../components/pagination.tsx";
import { ValidationBadge } from "../components/validation-badge.tsx";
import { Loading } from "../components/loading.tsx";
import { ErrorMessage } from "../components/error-message.tsx";

type EntriesState =
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "loaded"; readonly data: PaginatedEntries };

type ValidState =
  | { readonly status: "idle" }
  | { readonly status: "pending" }
  | { readonly status: "valid"; readonly result: ValidationResult }
  | { readonly status: "invalid"; readonly result: ValidationResult };

const PAGE_SIZE = 50;

export function ChainDetailPage() {
  const { chainId } = useParams<{ chainId: string }>();
  const [entriesState, setEntriesState] = useState<EntriesState>({
    status: "loading",
  });
  const [validState, setValidState] = useState<ValidState>({
    status: "idle",
  });
  const [offset, setOffset] = useState(0);

  const loadEntries = useCallback(
    async (currentOffset: number) => {
      if (chainId === undefined) return;
      setEntriesState({ status: "loading" });
      const result = await getChainEntries(chainId, currentOffset, PAGE_SIZE);
      if (result.ok) {
        setEntriesState({ status: "loaded", data: result.value });
      } else {
        setEntriesState({ status: "error", message: result.error });
      }
    },
    [chainId],
  );

  useEffect(() => {
    void loadEntries(offset);
  }, [loadEntries, offset]);

  const handleValidate = useCallback(async () => {
    if (chainId === undefined) return;
    setValidState({ status: "pending" });
    const result = await validateChain(chainId);
    if (result.ok) {
      if (result.value.valid) {
        setValidState({ status: "valid", result: result.value });
      } else {
        setValidState({ status: "invalid", result: result.value });
      }
    } else {
      setValidState({ status: "idle" });
    }
  }, [chainId]);

  if (chainId === undefined) {
    return <ErrorMessage message="No chain ID provided" />;
  }

  const validationBadgeState =
    validState.status === "pending"
      ? "pending" as const
      : validState.status === "valid"
        ? "valid" as const
        : validState.status === "invalid"
          ? "invalid" as const
          : "idle" as const;

  return (
    <div>
      <div className="mb-6">
        <nav className="text-sm text-gray-500 mb-2">
          <Link to="/" className="hover:text-seal-600 transition-colors">
            Chains
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Chain Detail</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chain Detail</h1>
            <p
              className="mt-1 text-sm font-mono text-gray-500 truncate max-w-lg"
              title={chainId}
            >
              {chainId}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ValidationBadge state={validationBadgeState} />
            <button
              type="button"
              onClick={() => void handleValidate()}
              disabled={validState.status === "pending"}
              className="px-4 py-2 text-sm font-medium text-white bg-seal-600 rounded-md hover:bg-seal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Validate Chain
            </button>
          </div>
        </div>
        {entriesState.status === "loaded" && (
          <p className="mt-2 text-sm text-gray-500">
            {entriesState.data.total} total{" "}
            {entriesState.data.total === 1 ? "entry" : "entries"}
          </p>
        )}
      </div>

      {entriesState.status === "loading" && (
        <Loading label="Loading entries..." />
      )}

      {entriesState.status === "error" && (
        <ErrorMessage
          message={entriesState.message}
          onRetry={() => void loadEntries(offset)}
        />
      )}

      {entriesState.status === "loaded" && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <EntryTable
              entries={entriesState.data.entries}
              chainId={chainId}
            />
          </div>
          <Pagination
            offset={entriesState.data.offset}
            limit={entriesState.data.limit}
            total={entriesState.data.total}
            onPageChange={setOffset}
          />
        </>
      )}
    </div>
  );
}
