import { type ReactNode, useState } from "react";
import type { ValidationResult, EntryValidationResult } from "../api/types";

type ValidationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "result"; result: ValidationResult | EntryValidationResult };

export function ValidationBanner({
  onValidate,
}: {
  readonly onValidate: () => Promise<ValidationResult | EntryValidationResult>;
}): ReactNode {
  const [state, setState] = useState<ValidationState>({ status: "idle" });

  async function handleClick(): Promise<void> {
    setState({ status: "loading" });
    const result = await onValidate();
    setState({ status: "result", result });
  }

  if (state.status === "idle") {
    return (
      <button
        type="button"
        onClick={() => void handleClick()}
        className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Validate
      </button>
    );
  }

  if (state.status === "loading") {
    return (
      <span className="text-sm text-gray-500">Validating...</span>
    );
  }

  const { result } = state;

  return (
    <div className="flex items-center gap-3">
      {result.valid ? (
        <span className="rounded-md bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800">
          Valid
        </span>
      ) : (
        <span className="rounded-md bg-red-100 px-3 py-1.5 text-sm font-medium text-red-800">
          Invalid{result.error !== undefined ? `: ${result.error.type}` : ""}
        </span>
      )}
      <button
        type="button"
        onClick={() => setState({ status: "idle" })}
        className="text-sm text-gray-500 underline hover:text-gray-700"
      >
        Re-check
      </button>
    </div>
  );
}
