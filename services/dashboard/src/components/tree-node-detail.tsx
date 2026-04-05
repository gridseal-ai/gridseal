import { Link } from "react-router";
import type { ProofChainEntry } from "../types.js";
import { EntryFields } from "./entry-fields.js";
import { CertificatePanel } from "./certificate-panel.js";

type TreeNodeDetailProps = {
  readonly entry: ProofChainEntry;
  readonly onClose: () => void;
};

export function TreeNodeDetail({
  entry,
  onClose,
}: TreeNodeDetailProps): React.JSX.Element {
  return (
    <div
      className="bg-slate-900/30 border border-slate-800 rounded-lg overflow-hidden"
      data-testid="tree-node-detail"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-200">
            Node Detail
          </h3>
          <span className="font-mono text-xs text-slate-500">
            {entry.entryId.slice(0, 12)}...
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/chains/${entry.chainId}/entries/${entry.entryId}`}
            className="text-xs text-sky-400 hover:text-sky-300 hover:underline"
          >
            Full detail
          </Link>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 text-sm flex items-center justify-center"
            aria-label="Close detail panel"
          >
            x
          </button>
        </div>
      </div>
      <div className="p-4 max-h-[400px] overflow-y-auto">
        <EntryFields entry={entry} />
        {entry.reasoningCertificateId && (
          <div className="mt-4">
            <CertificatePanel certificateId={entry.reasoningCertificateId} />
          </div>
        )}
      </div>
    </div>
  );
}
