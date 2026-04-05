import type { EntryType } from "../types.ts";

const ENTRY_TYPE_STYLES: Record<EntryType, string> = {
  ai_decision: "bg-blue-100 text-blue-800",
  human_override: "bg-amber-100 text-amber-800",
  system_event: "bg-gray-100 text-gray-800",
  policy_check: "bg-purple-100 text-purple-800",
  data_access: "bg-cyan-100 text-cyan-800",
  model_deployment: "bg-green-100 text-green-800",
  feedback: "bg-yellow-100 text-yellow-800",
  correction: "bg-red-100 text-red-800",
};

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  ai_decision: "AI Decision",
  human_override: "Human Override",
  system_event: "System Event",
  policy_check: "Policy Check",
  data_access: "Data Access",
  model_deployment: "Model Deployment",
  feedback: "Feedback",
  correction: "Correction",
};

export function EntryTypeBadge({
  entryType,
}: {
  readonly entryType: EntryType;
}) {
  const style = ENTRY_TYPE_STYLES[entryType] ?? "bg-gray-100 text-gray-800";
  const label = ENTRY_TYPE_LABELS[entryType] ?? entryType;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}
      data-testid="entry-type-badge"
    >
      {label}
    </span>
  );
}
