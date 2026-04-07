import { useParams, Link } from "react-router";
import { getEntry } from "../api.js";
import { useAsync } from "../hooks/use-async.js";
import { EntryFieldsView } from "../components/entry-fields.js";
import { CertificatePanel } from "../components/certificate-panel.js";

export function EntryDetailPage() {
  const { chainId, entryId } = useParams();

  const result = useAsync(
    () => {
      if (!chainId || !entryId) return Promise.reject(new Error("Missing parameters"));
      return getEntry(chainId, entryId);
    },
    [chainId, entryId],
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link
          to="/chains"
          className="text-[12px] font-medium text-celestir-text-muted hover:text-celestir-stardust transition-colors"
        >
          Audit Trail
        </Link>
        <span className="text-celestir-text-muted/30">/</span>
        <span className="text-[12px] font-mono text-celestir-text-muted">
          {entryId?.slice(0, 12)}...
        </span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-celestir-text">Entry Detail</h1>
        {result.status === "success" && result.data?.entry.sessionId && (
          <Link
            to={`/chains/${chainId}/sessions/${result.data.entry.sessionId}`}
            className="flex items-center gap-2 px-4 py-2 glass-panel rounded-lg text-[12px] font-medium text-celestir-stardust hover:text-celestir-stardust-light transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="3" r="2" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="3" cy="11" r="2" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="11" cy="11" r="2" stroke="currentColor" strokeWidth="1.2" />
              <line x1="7" y1="5" x2="3" y2="9" stroke="currentColor" strokeWidth="1.2" />
              <line x1="7" y1="5" x2="11" y2="9" stroke="currentColor" strokeWidth="1.2" />
            </svg>
            View decision tree
          </Link>
        )}
      </div>

      {result.status === "loading" && (
        <div className="h-1 bg-celestir-navy-800 rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-celestir-aurora rounded-full animate-pulse" />
        </div>
      )}
      {result.status === "error" && <p className="text-celestir-alert-light text-sm">{result.error}</p>}
      {result.status === "success" && result.data && (
        <div className="space-y-4">
          <EntryFieldsView entry={result.data.entry} />

          {result.data.entry.reasoningCertificateId && (
            <CertificatePanel certificateId={result.data.entry.reasoningCertificateId} />
          )}
        </div>
      )}
    </div>
  );
}
