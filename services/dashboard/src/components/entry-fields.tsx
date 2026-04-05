import type { ProofChainEntry } from "../types.js";

type EntryFieldsProps = {
  readonly entry: ProofChainEntry;
};

type FieldGroup = {
  readonly title: string;
  readonly fields: readonly FieldDef[];
};

type FieldDef = {
  readonly label: string;
  readonly value: unknown;
  readonly mono?: boolean;
};

function formatValue(value: unknown, mono?: boolean): React.JSX.Element {
  if (value === null || value === undefined) {
    return <span className="text-slate-600">null</span>;
  }
  if (typeof value === "object") {
    const json = JSON.stringify(value, null, 2);
    return (
      <pre className="text-xs font-mono bg-slate-900 rounded p-2 overflow-x-auto whitespace-pre-wrap">
        {json}
      </pre>
    );
  }
  const text = String(value);
  return (
    <span className={mono ? "font-mono text-xs break-all" : ""}>
      {text}
    </span>
  );
}

export function EntryFields({ entry }: EntryFieldsProps): React.JSX.Element {
  const groups: readonly FieldGroup[] = [
    {
      title: "Tier 1: Chain Integrity",
      fields: [
        { label: "Entry ID", value: entry.entryId, mono: true },
        { label: "Chain ID", value: entry.chainId, mono: true },
        { label: "Sequence Number", value: entry.sequenceNumber },
        { label: "Timestamp", value: entry.timestamp },
        { label: "Entry Type", value: entry.entryType },
        { label: "Entry Hash", value: entry.entryHash, mono: true },
        { label: "Previous Hash", value: entry.previousHash, mono: true },
        { label: "Parent Entry ID", value: entry.parentEntryId, mono: true },
      ],
    },
    {
      title: "Tier 2: AI Decision Context",
      fields: [
        { label: "Model ID", value: entry.modelId },
        { label: "Model Provider", value: entry.modelProvider },
        { label: "Input Hash", value: entry.inputHash, mono: true },
        { label: "Output Hash", value: entry.outputHash, mono: true },
        { label: "Input Tokens", value: entry.inputTokenCount },
        { label: "Output Tokens", value: entry.outputTokenCount },
        { label: "Decision Type", value: entry.decisionType },
        { label: "Confidence Score", value: entry.confidenceScore },
        { label: "Certificate ID", value: entry.reasoningCertificateId, mono: true },
        { label: "Provenance ID", value: entry.provenanceId, mono: true },
      ],
    },
    {
      title: "Tier 3: Compliance & Metadata",
      fields: [
        { label: "Session ID", value: entry.sessionId, mono: true },
        { label: "Actor ID", value: entry.actorId },
        { label: "Policy IDs", value: entry.policyIds.length > 0 ? entry.policyIds : null },
        { label: "Tags", value: Object.keys(entry.tags).length > 0 ? entry.tags : null },
        { label: "Annotation", value: entry.annotation },
        {
          label: "Compliance Metadata",
          value: Object.keys(entry.complianceMetadata).length > 0 ? entry.complianceMetadata : null,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {group.title}
          </h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {group.fields.map((field) => (
              <div key={field.label} className="py-1.5">
                <dt className="text-xs text-slate-500">{field.label}</dt>
                <dd className="text-slate-200 mt-0.5">
                  {formatValue(field.value, field.mono)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
