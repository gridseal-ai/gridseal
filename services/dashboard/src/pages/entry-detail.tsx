import { useParams, Link } from "react-router";
import { fetchEntry } from "../api/client.js";
import { useAsync } from "../hooks/use-async.js";
import { EntryFields } from "../components/entry-fields.js";
import { CertificatePanel } from "../components/certificate-panel.js";

export function EntryDetailPage(): React.JSX.Element {
  const { chainId, entryId } = useParams();

  const { status, data, error } = useAsync(
    () => {
      if (!chainId || !entryId) {
        return Promise.reject(new Error("Missing chain or entry ID"));
      }
      return fetchEntry(chainId, entryId);
    },
    [chainId, entryId],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/chains"
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Audit Trail
        </Link>
        <span className="text-slate-700">/</span>
        <span className="text-sm text-slate-400 font-mono">
          {entryId ? `${entryId.slice(0, 8)}...` : ""}
        </span>
      </div>

      <h1 className="text-xl font-semibold text-slate-100">Entry Detail</h1>

      {status === "loading" && (
        <div className="text-slate-500">Loading entry...</div>
      )}
      {status === "error" && (
        <div className="text-red-400">{error}</div>
      )}
      {status === "success" && data && (
        <div className="space-y-6">
          <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-6">
            <EntryFields entry={data.entry} />
          </div>

          {data.entry.reasoningCertificateId && (
            <CertificatePanel
              certificateId={data.entry.reasoningCertificateId}
            />
          )}

          {data.entry.parentEntryId && chainId && (
            <div className="text-sm">
              <span className="text-slate-500">Parent entry: </span>
              <Link
                to={`/chains/${chainId}/entries/${data.entry.parentEntryId}`}
                className="text-sky-400 hover:text-sky-300 hover:underline font-mono text-xs"
              >
                {data.entry.parentEntryId}
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
