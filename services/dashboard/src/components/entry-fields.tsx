import type { ProofChainEntry } from "../api.js";

function FieldRow({ label, value, mono }: { readonly label: string; readonly value: string | null | undefined; readonly mono?: boolean }) {
  return (
    <div className="space-y-1">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted">{label}</dt>
      <dd className={`text-[13px] text-celestir-text ${mono ? "font-mono text-[12px] break-all leading-relaxed" : ""}`}>
        {value ?? <span className="text-celestir-text-muted/30">-</span>}
      </dd>
    </div>
  );
}

function Section({ title, color, children }: { readonly title: string; readonly color: string; readonly children: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-lg p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-1 h-4 rounded-full ${color}`} />
        <h4 className="text-[11px] font-semibold uppercase tracking-widest text-celestir-text-muted">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function confidenceColor(level: string): string {
  switch (level) {
    case "high":
      return "text-celestir-alert-light";
    case "medium":
      return "text-celestir-warn-light";
    default:
      return "text-celestir-text-muted";
  }
}

export function EntryFieldsView({ entry }: { readonly entry: ProofChainEntry }) {
  return (
    <div className="space-y-4">
      <Section title="Chain Integrity" color="bg-celestir-verify">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
          <FieldRow label="Entry ID" value={entry.entryId} mono />
          <FieldRow label="Chain ID" value={entry.chainId} mono />
          <FieldRow label="Sequence #" value={String(entry.sequenceNumber)} />
          <FieldRow label="Timestamp" value={entry.timestamp} mono />
          <FieldRow label="Entry Type" value={entry.entryType} />
          <FieldRow label="Parent Entry" value={entry.parentEntryId} mono />
          <div className="col-span-2">
            <FieldRow label="Entry Hash" value={entry.entryHash} mono />
          </div>
          <div className="col-span-2">
            <FieldRow label="Previous Hash" value={entry.previousHash} mono />
          </div>
        </dl>
      </Section>

      <Section title="AI Decision Context" color="bg-celestir-stardust">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
          <FieldRow label="Model ID" value={entry.modelId} />
          <FieldRow label="Provider" value={entry.modelProvider} />
          <FieldRow label="Decision Type" value={entry.decisionType} />
          <FieldRow
            label="Confidence"
            value={entry.confidenceScore !== null ? `${Math.round(entry.confidenceScore * 100)}%` : null}
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
            <FieldRow label="Input Hash" value={entry.inputHash} mono />
          </div>
          <div className="col-span-2">
            <FieldRow label="Output Hash" value={entry.outputHash} mono />
          </div>
        </dl>
      </Section>

      <Section title="Compliance Metadata" color="bg-celestir-nebula">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
          <FieldRow label="Session ID" value={entry.sessionId} mono />
          <FieldRow label="Actor ID" value={entry.actorId} />
          <FieldRow label="Annotation" value={entry.annotation} />
          <FieldRow
            label="Policy IDs"
            value={entry.policyIds.length > 0 ? entry.policyIds.join(", ") : null}
          />
        </dl>
        {Object.keys(entry.tags).length > 0 && (
          <div className="mt-4 pt-4 border-t border-celestir-navy-700/20">
            <h5 className="text-[10px] font-semibold uppercase tracking-wider text-celestir-text-muted mb-2">Tags</h5>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(entry.tags).map(([k, v]) => (
                <span
                  key={k}
                  className="px-2.5 py-1 text-[11px] font-mono bg-celestir-navy-800/60 border border-celestir-navy-700/30 rounded-md text-celestir-text-secondary"
                >
                  <span className="text-celestir-text-muted">{k}:</span> {v}
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
