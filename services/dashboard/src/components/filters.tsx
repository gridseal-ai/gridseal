import { useState } from "react";
import type { EntryFilters } from "../types.js";

type FiltersProps = {
  readonly filters: EntryFilters;
  readonly onApply: (filters: EntryFilters) => void;
};

export function Filters({ filters, onApply }: FiltersProps): React.JSX.Element {
  const [local, setLocal] = useState<EntryFilters>(filters);

  function update(key: keyof EntryFilters, value: string): void {
    setLocal((prev) => ({ ...prev, [key]: value || undefined }));
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    onApply(local);
  }

  function handleClear(): void {
    const cleared: EntryFilters = {};
    setLocal(cleared);
    onApply(cleared);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Field label="Start Date">
        <input
          type="datetime-local"
          value={local.startDate ?? ""}
          onChange={(e) => update("startDate", e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30 transition-colors"
        />
      </Field>
      <Field label="End Date">
        <input
          type="datetime-local"
          value={local.endDate ?? ""}
          onChange={(e) => update("endDate", e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30 transition-colors"
        />
      </Field>
      <Field label="Model ID">
        <input
          type="text"
          placeholder="e.g. gpt-4o"
          value={local.modelId ?? ""}
          onChange={(e) => update("modelId", e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30 transition-colors"
        />
      </Field>
      <Field label="Actor ID">
        <input
          type="text"
          placeholder="e.g. user-123"
          value={local.actorId ?? ""}
          onChange={(e) => update("actorId", e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30 transition-colors"
        />
      </Field>
      <Field label="Session ID">
        <input
          type="text"
          placeholder="e.g. sess-abc"
          value={local.sessionId ?? ""}
          onChange={(e) => update("sessionId", e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600/30 transition-colors"
        />
      </Field>
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-sm font-medium transition-colors"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={handleClear}
          className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors"
        >
          Clear
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      {children}
    </label>
  );
}
