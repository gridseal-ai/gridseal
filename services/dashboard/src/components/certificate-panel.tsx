import { useState } from "react";
import { getCertificate } from "../api.js";
import type { ReasoningCertificate } from "../api.js";

export function CertificatePanel({
  certificateId,
}: {
  readonly certificateId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [certificate, setCertificate] = useState<ReasoningCertificate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (certificate) return;

    setLoading(true);
    setError(null);
    try {
      const res = await getCertificate(certificateId);
      setCertificate(res.certificate);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load certificate";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-slate-700 rounded-lg">
      <button
        onClick={toggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-800/30 transition-colors"
      >
        <span className="text-sm font-medium text-slate-200">Reasoning Certificate</span>
        <span className="text-xs text-slate-500">{expanded ? "Collapse" : "Expand"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800">
          {loading && <p className="text-sm text-slate-500 mt-3">Loading certificate...</p>}
          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          {certificate && (
            <div className="space-y-4 mt-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Claims Analysis
                </h4>
                <div className="space-y-1.5">
                  {certificate.claimsAnalysis.claims.map((c, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-slate-300">{c.claim}</span>
                      <span className="ml-2 text-xs text-slate-500">[{c.status}]</span>
                      <p className="text-xs text-slate-400 mt-0.5">{c.evidence}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Evidence Chain
                </h4>
                <ol className="list-decimal list-inside space-y-1">
                  {certificate.evidenceChain.steps.map((s, i) => (
                    <li key={i} className="text-sm text-slate-300">
                      {s.step}
                      <p className="text-xs text-slate-400 ml-3">{s.reasoning}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Confidence Assessment
                </h4>
                <div className="text-sm">
                  <span className="text-slate-300">
                    Level: {certificate.confidenceAssessment.level}
                  </span>
                  <span className="ml-3 text-slate-400">
                    Score: {certificate.confidenceAssessment.score}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Rationale: {certificate.confidenceAssessment.rationale}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Limitations
                </h4>
                <div className="space-y-1">
                  {certificate.limitations.items.map((l, i) => (
                    <div key={i} className="text-sm">
                      <span className="text-slate-300">{l.limitation}</span>
                      <span className="ml-2 text-xs text-slate-500">[{l.severity}]</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
