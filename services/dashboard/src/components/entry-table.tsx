import { Link } from "react-router-dom";
import type { ProofChainEntry } from "../types.ts";
import { EntryTypeBadge } from "./entry-type-badge.tsx";
import { HashDisplay } from "./hash-display.tsx";

export function EntryTable({
  entries,
  chainId,
}: {
  readonly entries: ReadonlyArray<ProofChainEntry>;
  readonly chainId: string;
}) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500" data-testid="empty-entries">
        No entries found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto" data-testid="entry-table">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Timestamp
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Model
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Hash
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Tokens
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {entries.map((entry) => (
            <tr
              key={entry.entryId}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                <Link
                  to={`/chains/${encodeURIComponent(chainId)}/entries/${encodeURIComponent(entry.entryId)}`}
                  className="text-seal-600 hover:text-seal-800 font-medium"
                >
                  {entry.sequenceNumber}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <EntryTypeBadge entryType={entry.entryType} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {formatTimestamp(entry.timestamp)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {entry.modelId !== null ? (
                  <span>
                    <span className="font-medium">{entry.modelId}</span>
                    {entry.modelProvider !== null && (
                      <span className="text-gray-400 ml-1">
                        ({entry.modelProvider})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <HashDisplay hash={entry.entryHash} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                {entry.inputTokenCount !== null || entry.outputTokenCount !== null ? (
                  <span>
                    {entry.inputTokenCount ?? 0} / {entry.outputTokenCount ?? 0}
                  </span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}
