import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { ProofChainEntry, EntryValidationResult } from "../api/types";
import { getEntry, getEntryChildren, validateEntry } from "../api/client";
import { LoadingSpinner } from "../components/loading-spinner";
import { ErrorMessage } from "../components/error-message";
import { DataField } from "../components/data-field";
import { HashDisplay } from "../components/hash-display";
import { StatusBadge } from "../components/status-badge";
import { ValidationBanner } from "../components/validation-banner";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; entry: ProofChainEntry; children: ReadonlyArray<ProofChainEntry> };

export function EntryDetailPage(): ReactNode {
  const { chainId, entryId } = useParams<{ chainId: string; entryId: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });

  function load(): void {
    if (chainId === undefined || entryId === undefined) return;
    void Promise.all([
      getEntry(chainId, entryId),
      getEntryChildren(chainId, entryId),
    ]).then(([entryResult, childrenResult]) => {
      if (entryResult.ok) {
        setState({
          status: "loaded",
          entry: entryResult.data.entry,
          children: childrenResult.ok ? childrenResult.data.children : [],
        });
      } else {
        setState({ status: "error", message: entryResult.error });
      }
    });
  }

  useEffect(() => { load(); }, [chainId, entryId]);

  if (chainId === undefined || entryId === undefined) {
    return <ErrorMessage message="Missing chain or entry ID" />;
  }

  if (state.status === "loading") {
    return <LoadingSpinner />;
  }

  if (state.status === "error") {
    return <ErrorMessage message={state.message} onRetry={() => { setState({ status: "loading" }); load(); }} />;
  }

  const { entry, children } = state;

  async function handleValidate(): Promise<EntryValidationResult> {
    const result = await validateEntry(chainId as string, entryId as string);
    if (result.ok) return result.data;
    return { valid: false, entryId: entryId as string, error: { type: result.error } };
  }

  return (
    <div>
      <div className="mb-4 text-sm">
        <Link to="/" className="text-blue-600 hover:underline">All Chains</Link>
        <span className="text-gray-400 mx-2">/</span>
        <Link to={`/chains/${encodeURIComponent(chainId)}`} className="text-blue-600 hover:underline font-mono">
          {chainId}
        </Link>
        <span className="text-gray-400 mx-2">/</span>
        <span className="text-gray-700">Entry #{entry.sequenceNumber}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Entry Detail</h1>
        <ValidationBanner onValidate={handleValidate} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Tier 1: Chain Integrity</h2>
          <dl className="divide-y divide-gray-100">
            <DataField label="Entry ID">
              <span className="font-mono text-sm">{entry.entryId}</span>
            </DataField>
            <DataField label="Chain ID">
              <span className="font-mono text-sm">{entry.chainId}</span>
            </DataField>
            <DataField label="Sequence Number">{entry.sequenceNumber}</DataField>
            <DataField label="Timestamp">{entry.timestamp}</DataField>
            <DataField label="Entry Type">
              <StatusBadge variant="info">{entry.entryType.replace(/_/g, " ")}</StatusBadge>
            </DataField>
            <DataField label="Entry Hash"><HashDisplay hash={entry.entryHash} /></DataField>
            <DataField label="Previous Hash"><HashDisplay hash={entry.previousHash} /></DataField>
            <DataField label="Parent Entry">
              {entry.parentEntryId !== null ? (
                <Link
                  to={`/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(entry.parentEntryId)}`}
                  className="font-mono text-sm text-blue-600 hover:underline"
                >
                  {entry.parentEntryId}
                </Link>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </DataField>
          </dl>
        </section>

        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Tier 2: AI Decision Context</h2>
          <dl className="divide-y divide-gray-100">
            <DataField label="Model ID">{entry.modelId ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Model Provider">{entry.modelProvider ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Input Hash"><HashDisplay hash={entry.inputHash} /></DataField>
            <DataField label="Output Hash"><HashDisplay hash={entry.outputHash} /></DataField>
            <DataField label="Input Tokens">{entry.inputTokenCount ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Output Tokens">{entry.outputTokenCount ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Decision Type">{entry.decisionType ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Confidence">
              {entry.confidenceScore !== null ? `${(entry.confidenceScore * 100).toFixed(1)}%` : <span className="text-gray-400">-</span>}
            </DataField>
            <DataField label="Reasoning Certificate">
              {entry.reasoningCertificateId !== null ? (
                <Link
                  to={`/certificates/${encodeURIComponent(entry.reasoningCertificateId)}`}
                  className="font-mono text-sm text-blue-600 hover:underline"
                >
                  {entry.reasoningCertificateId}
                </Link>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </DataField>
            <DataField label="Provenance">
              {entry.provenanceId !== null ? (
                <Link
                  to={`/provenance/${encodeURIComponent(entry.provenanceId)}`}
                  className="font-mono text-sm text-blue-600 hover:underline"
                >
                  {entry.provenanceId}
                </Link>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </DataField>
          </dl>
        </section>

        <section className="rounded-lg border border-gray-200 p-4 md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Tier 3: Compliance and Metadata</h2>
          <dl className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-gray-100">
            <DataField label="Session ID">{entry.sessionId ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Actor ID">{entry.actorId ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Policy IDs">
              {entry.policyIds.length > 0 ? entry.policyIds.join(", ") : <span className="text-gray-400">-</span>}
            </DataField>
            <DataField label="Annotation">{entry.annotation ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Tags">
              {Object.keys(entry.tags).length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(entry.tags).map(([k, v]) => (
                    <span key={k} className="inline-flex rounded bg-gray-100 px-2 py-0.5 text-xs font-mono">
                      {k}={v}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </DataField>
            <DataField label="Compliance Metadata">
              {Object.keys(entry.complianceMetadata).length > 0 ? (
                <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                  {JSON.stringify(entry.complianceMetadata, null, 2)}
                </pre>
              ) : (
                <span className="text-gray-400">-</span>
              )}
            </DataField>
          </dl>
        </section>
      </div>

      {children.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Child Entries</h2>
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Seq</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Entry ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {children.map((child) => (
                  <tr key={child.entryId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{child.sequenceNumber}</td>
                    <td className="px-4 py-3 text-sm">{child.entryType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(child.entryId)}`}
                        className="font-mono text-sm text-blue-600 hover:underline"
                      >
                        {child.entryId}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
