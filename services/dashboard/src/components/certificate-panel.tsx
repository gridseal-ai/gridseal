import { useState } from "react";
import type { ReasoningCertificate } from "../types.js";
import { useAsync } from "../hooks/use-async.js";
import { fetchCertificate } from "../api/client.js";

type CertificatePanelProps = {
  readonly certificateId: string;
};

export function CertificatePanel({
  certificateId,
}: CertificatePanelProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const { status, data, error } = useAsync(
    () => fetchCertificate(certificateId),
    [certificateId],
  );

  return (
    <div className="border border-slate-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/50 hover:bg-slate-800/50 transition-colors text-left"
      >
        <span className="text-sm font-medium text-slate-300">
          Reasoning Certificate
        </span>
        <span className="text-slate-500 text-xs">
          {expanded ? "Collapse" : "Expand"}
        </span>
      </button>
      {expanded && (
        <div className="px-4 py-3 space-y-4">
          {status === "loading" && (
            <p className="text-slate-500 text-sm">Loading certificate...</p>
          )}
          {status === "error" && (
            <p className="text-red-400 text-sm">{error}</p>
          )}
          {status === "success" && data && (
            <CertificateContent certificate={data.certificate} />
          )}
        </div>
      )}
    </div>
  );
}

function CertificateContent({
  certificate,
}: {
  readonly certificate: ReasoningCertificate;
}): React.JSX.Element {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Model" value={`${certificate.modelProvider} / ${certificate.modelId}`} />
        <Field
          label="Confidence"
          value={`${certificate.confidenceAssessment.level} (${(certificate.confidenceAssessment.score * 100).toFixed(0)}%)`}
        />
      </div>

      {certificate.claims.length > 0 && (
        <Section title={`Claims (${certificate.claims.length})`}>
          <ul className="space-y-1">
            {certificate.claims.map((c) => (
              <li key={c.claimId} className="text-slate-300">
                {c.statement}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {certificate.unsupportedClaims.length > 0 && (
        <Section title={`Unsupported Claims (${certificate.unsupportedClaims.length})`}>
          <ul className="space-y-1">
            {certificate.unsupportedClaims.map((c, i) => (
              <li key={i} className="text-amber-400">
                {c.statement} — <span className="text-slate-500">{c.reason}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {certificate.assumptions.length > 0 && (
        <Section title={`Assumptions (${certificate.assumptions.length})`}>
          <ul className="space-y-1">
            {certificate.assumptions.map((a, i) => (
              <li key={i} className="text-slate-300">
                <span className={criticalityColor(a.criticality)}>
                  [{a.criticality}]
                </span>{" "}
                {a.statement}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {certificate.limitations.length > 0 && (
        <Section title={`Limitations (${certificate.limitations.length})`}>
          <ul className="space-y-1">
            {certificate.limitations.map((l, i) => (
              <li key={i} className="text-slate-300">
                {l.description} — <span className="text-slate-500">{l.impact}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="pt-2 border-t border-slate-800">
        <p className="text-xs text-slate-500">
          Rationale: {certificate.confidenceAssessment.rationale}
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-200 mt-0.5">{value}</dd>
    </div>
  );
}

function criticalityColor(c: string): string {
  switch (c) {
    case "high":
      return "text-red-400";
    case "medium":
      return "text-amber-400";
    default:
      return "text-slate-400";
  }
}
