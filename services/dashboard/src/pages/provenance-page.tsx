import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { ModelProvenance, ProvenanceVerifyResult } from "../api/types";
import { getProvenance, verifyProvenance } from "../api/client";
import { LoadingSpinner } from "../components/loading-spinner";
import { ErrorMessage } from "../components/error-message";
import { DataField } from "../components/data-field";
import { HashDisplay } from "../components/hash-display";
import { StatusBadge } from "../components/status-badge";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; provenance: ModelProvenance };

export function ProvenancePage(): ReactNode {
  const { provenanceId } = useParams<{ provenanceId: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [verifyResult, setVerifyResult] = useState<ProvenanceVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  function load(): void {
    if (provenanceId === undefined) return;
    void getProvenance(provenanceId).then((result) => {
      if (result.ok) {
        setState({ status: "loaded", provenance: result.data.provenance });
      } else {
        setState({ status: "error", message: result.error });
      }
    });
  }

  useEffect(() => { load(); }, [provenanceId]);

  if (provenanceId === undefined) {
    return <ErrorMessage message="Missing provenance ID" />;
  }

  if (state.status === "loading") {
    return <LoadingSpinner />;
  }

  if (state.status === "error") {
    return <ErrorMessage message={state.message} onRetry={() => { setState({ status: "loading" }); load(); }} />;
  }

  const { provenance } = state;

  async function handleVerify(): Promise<void> {
    setVerifying(true);
    const result = await verifyProvenance(provenanceId as string);
    if (result.ok) {
      setVerifyResult(result.data);
    }
    setVerifying(false);
  }

  return (
    <div>
      <div className="mb-4 text-sm">
        <Link to="/" className="text-blue-600 hover:underline">All Chains</Link>
        <span className="text-gray-400 mx-2">/</span>
        <span className="text-gray-700">Model Provenance</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Model Provenance (AIBOM)</h1>
        <div className="flex items-center gap-3">
          {verifyResult !== null ? (
            <StatusBadge variant={verifyResult.valid ? "success" : "error"}>
              {verifyResult.valid ? "Verified" : "Invalid"}
            </StatusBadge>
          ) : null}
          <button
            type="button"
            disabled={verifying}
            onClick={() => void handleVerify()}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {verifying ? "Verifying..." : "Verify Integrity"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Model Information</h2>
          <dl className="divide-y divide-gray-100">
            <DataField label="Provenance ID"><span className="font-mono text-sm">{provenance.provenanceId}</span></DataField>
            <DataField label="Timestamp">{provenance.timestamp}</DataField>
            <DataField label="BOM Version">{provenance.bomVersion}</DataField>
            <DataField label="Model Name">{provenance.modelName}</DataField>
            <DataField label="Model Version">{provenance.modelVersion}</DataField>
            <DataField label="Model Type">
              <StatusBadge variant="info">{provenance.modelType}</StatusBadge>
            </DataField>
            <DataField label="Provider">{provenance.modelProvider}</DataField>
            <DataField label="Description">{provenance.modelDescription ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Author">{provenance.modelAuthor ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="License">{provenance.modelLicense ?? <span className="text-gray-400">-</span>}</DataField>
            <DataField label="Hash"><HashDisplay hash={provenance.provenanceHash} /></DataField>
          </dl>
        </section>

        {provenance.trainingDatasets.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Training Datasets ({provenance.trainingDatasets.length})
            </h2>
            <div className="overflow-hidden rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Version</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {provenance.trainingDatasets.map((ds) => (
                    <tr key={ds.datasetId}>
                      <td className="px-4 py-2 text-sm">{ds.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{ds.version ?? "-"}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{ds.source ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {provenance.performanceMetrics.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Performance Metrics ({provenance.performanceMetrics.length})
            </h2>
            <div className="overflow-hidden rounded border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Metric</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase text-gray-500">Value</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase text-gray-500">Slice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {provenance.performanceMetrics.map((m) => (
                    <tr key={m.metricId}>
                      <td className="px-4 py-2 text-sm">{m.name}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono">{m.value.toFixed(4)}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{m.slice ?? "overall"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {provenance.ethicalConsiderations.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Ethical Considerations ({provenance.ethicalConsiderations.length})
            </h2>
            <ul className="space-y-3">
              {provenance.ethicalConsiderations.map((ec, i) => (
                <li key={i} className="border-l-2 border-purple-300 pl-3">
                  <p className="text-sm font-medium text-gray-900">{ec.category}</p>
                  <p className="text-sm text-gray-600">{ec.description}</p>
                  {ec.mitigationStrategy !== null ? (
                    <p className="text-xs text-gray-500 mt-1">Mitigation: {ec.mitigationStrategy}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {provenance.externalReferences.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              External References ({provenance.externalReferences.length})
            </h2>
            <ul className="space-y-2">
              {provenance.externalReferences.map((ref, i) => (
                <li key={i} className="text-sm">
                  <span className="font-medium text-gray-700">{ref.referenceType}:</span>{" "}
                  <span className="text-gray-600">{ref.url}</span>
                  {ref.description !== null ? <span className="text-gray-500"> - {ref.description}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
