import type { ProofChainEntry } from "../api.js";

function FieldRow({ label, value }: { readonly label: string; readonly value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-200 mt-0.5">{value ?? "-"}</dd>
    </div>
  );
}

function Section({ title, children }: { readonly title: string; readonly children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
        {title}
      </h4>
      {children}
    </div>
  );
}

function confidenceColor(level: string): string {
  switch (level) {
    case "high":
      return "text-red-400";
    case "medium":
      return "text-amber-400";
    default:
      return "text-slate-400";
  }
}

export function EntryFieldsView({ entry }: { readonly entry: ProofChainEntry }) {
  return (
    <div className="space-y-5">
      <Section title="Chain Integrity">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <FieldRow label="Entry ID" value={entry.entryId} />
          <FieldRow label="Chain ID" value={entry.chainId} />
          <FieldRow label="Sequence #" value={String(entry.sequenceNumber)} />
          <FieldRow label="Timestamp" value={entry.timestamp} />
          <FieldRow label="Entry Type" value={entry.entryType} />
          <FieldRow label="Parent Entry" value={entry.parentEntryId} />
          <div className="col-span-2">
            <FieldRow label="Entry Hash" value={entry.entryHash} />
          </div>
          <div className="col-span-2">
            <FieldRow label="Previous Hash" value={entry.previousHash} />
          </div>
        </dl>
      </Section>

      <Section title="AI Decision Context">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <FieldRow label="Model ID" value={entry.modelId} />
          <FieldRow label="Provider" value={entry.modelProvider} />
          <FieldRow label="Decision Type" value={entry.decisionType} />
          <FieldRow
            label="Confidence"
            value={entry.confidenceScore !== null ? String(entry.confidenceScore) : null}
          />
          <FieldRow
            label="Input Tokens"
            value={entry.inputTokenCount !== null ? String(entry.inputTokenCount) : null}
          />
          <FieldRow
            label="Output Tokens"
            value={entry.outputTokenCount !== null ? String(entry.outputTokenCount) : null}
          />
          <div className="col-span-2">
            <FieldRow label="Input Hash" value={entry.inputHash} />
          </div>
          <div className="col-span-2">
            <FieldRow label="Output Hash" value={entry.outputHash} />
          </div>
        </dl>
      </Section>

      <Section title="Metadata">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <FieldRow label="Session ID" value={entry.sessionId} />
          <FieldRow label="Actor ID" value={entry.actorId} />
          <FieldRow label="Annotation" value={entry.annotation} />
          <FieldRow
            label="Policy IDs"
            value={entry.policyIds.length > 0 ? entry.policyIds.join(", ") : null}
          />
        </dl>
        {Object.keys(entry.tags).length > 0 && (
          <div className="mt-3">
            <h5 className="text-xs text-slate-500 mb-1">Tags</h5>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(entry.tags).map(([k, v]) => (
                <span
                  key={k}
                  className="px-2 py-0.5 text-xs bg-slate-800 border border-slate-700 rounded text-slate-300"
                >
                  {k}: {v}
                </span>
              ))}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

export { confidenceColor, FieldRow, Section };
