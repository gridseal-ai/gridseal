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
    <div className="space-y-6">
      <div>
        <Link
          to="/chains"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
        >
          Back to Audit Trail
        </Link>
        <h1 className="text-xl font-semibold text-slate-100 mt-2">Entry Detail</h1>
      </div>

      {result.status === "loading" && <p className="text-slate-500">Loading entry...</p>}
      {result.status === "error" && <p className="text-red-400">{result.error}</p>}
      {result.status === "success" && result.data && (
        <div className="space-y-6">
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-6">
            <EntryFieldsView entry={result.data.entry} />
          </div>

          {result.data.entry.reasoningCertificateId && (
            <CertificatePanel certificateId={result.data.entry.reasoningCertificateId} />
          )}

          {result.data.entry.sessionId && (
            <div className="pt-2">
              <Link
                to={`/chains/${chainId}/sessions/${result.data.entry.sessionId}`}
                className="text-sm text-sky-400 hover:text-sky-300 hover:underline"
              >
                View session decision tree
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
