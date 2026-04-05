import { type ReactNode, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import type { ReasoningCertificate, CertificateVerifyResult } from "../api/types";
import { getCertificate, verifyCertificate } from "../api/client";
import { LoadingSpinner } from "../components/loading-spinner";
import { ErrorMessage } from "../components/error-message";
import { DataField } from "../components/data-field";
import { HashDisplay } from "../components/hash-display";
import { StatusBadge } from "../components/status-badge";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; certificate: ReasoningCertificate };

export function CertificatePage(): ReactNode {
  const { certificateId } = useParams<{ certificateId: string }>();
  const [state, setState] = useState<PageState>({ status: "loading" });
  const [verifyResult, setVerifyResult] = useState<CertificateVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  function load(): void {
    if (certificateId === undefined) return;
    void getCertificate(certificateId).then((result) => {
      if (result.ok) {
        setState({ status: "loaded", certificate: result.data.certificate });
      } else {
        setState({ status: "error", message: result.error });
      }
    });
  }

  useEffect(() => { load(); }, [certificateId]);

  if (certificateId === undefined) {
    return <ErrorMessage message="Missing certificate ID" />;
  }

  if (state.status === "loading") {
    return <LoadingSpinner />;
  }

  if (state.status === "error") {
    return <ErrorMessage message={state.message} onRetry={() => { setState({ status: "loading" }); load(); }} />;
  }

  const { certificate } = state;

  async function handleVerify(): Promise<void> {
    setVerifying(true);
    const result = await verifyCertificate(certificateId as string);
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
        <span className="text-gray-700">Certificate</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Reasoning Certificate</h1>
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
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Overview</h2>
          <dl className="divide-y divide-gray-100">
            <DataField label="Certificate ID"><span className="font-mono text-sm">{certificate.certificateId}</span></DataField>
            <DataField label="Timestamp">{certificate.timestamp}</DataField>
            <DataField label="Model">{certificate.modelId} ({certificate.modelProvider})</DataField>
            <DataField label="Hash"><HashDisplay hash={certificate.certificateHash} /></DataField>
            <DataField label="Confidence">
              <StatusBadge variant={confidenceLevelVariant(certificate.confidenceAssessment.level)}>
                {certificate.confidenceAssessment.level.replace(/_/g, " ")} ({(certificate.confidenceAssessment.score * 100).toFixed(0)}%)
              </StatusBadge>
              <p className="text-sm text-gray-600 mt-1">{certificate.confidenceAssessment.rationale}</p>
            </DataField>
          </dl>
        </section>

        {certificate.claims.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Claims ({certificate.claims.length})</h2>
            <ul className="space-y-3">
              {certificate.claims.map((claim) => (
                <li key={claim.claimId} className="border-l-2 border-blue-300 pl-3">
                  <p className="text-sm text-gray-900">{claim.statement}</p>
                  {claim.supportingEvidenceIds.length > 0 ? (
                    <p className="text-xs text-gray-500 mt-1">
                      Evidence: {claim.supportingEvidenceIds.join(", ")}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {certificate.supportingEvidence.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Supporting Evidence ({certificate.supportingEvidence.length})</h2>
            <ul className="space-y-3">
              {certificate.supportingEvidence.map((ev) => (
                <li key={ev.evidenceId} className="border-l-2 border-green-300 pl-3">
                  <p className="text-sm font-medium text-gray-900">{ev.evidenceType}</p>
                  <p className="text-sm text-gray-600">{ev.description}</p>
                  {ev.source !== null ? <p className="text-xs text-gray-500 mt-1">Source: {ev.source}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {certificate.unsupportedClaims.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Unsupported Claims ({certificate.unsupportedClaims.length})</h2>
            <ul className="space-y-2">
              {certificate.unsupportedClaims.map((uc, i) => (
                <li key={i} className="border-l-2 border-red-300 pl-3">
                  <p className="text-sm text-gray-900">{uc.statement}</p>
                  <p className="text-xs text-gray-500">Reason: {uc.reason}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {certificate.assumptions.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Assumptions ({certificate.assumptions.length})</h2>
            <ul className="space-y-2">
              {certificate.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <StatusBadge variant={a.criticality === "high" ? "error" : a.criticality === "medium" ? "warning" : "neutral"}>
                    {a.criticality}
                  </StatusBadge>
                  <span className="text-sm text-gray-900">{a.statement}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {certificate.limitations.length > 0 ? (
          <section className="rounded-lg border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Limitations ({certificate.limitations.length})</h2>
            <ul className="space-y-2">
              {certificate.limitations.map((l, i) => (
                <li key={i} className="border-l-2 border-amber-300 pl-3">
                  <p className="text-sm text-gray-900">{l.description}</p>
                  <p className="text-xs text-gray-500">Impact: {l.impact}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function confidenceLevelVariant(level: string): "success" | "error" | "warning" | "info" | "neutral" {
  if (level === "very_high" || level === "high") return "success";
  if (level === "medium") return "info";
  if (level === "low") return "warning";
  return "error";
}
