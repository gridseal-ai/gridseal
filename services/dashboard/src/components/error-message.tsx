import type { ReactNode } from "react";

export function ErrorMessage({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry?: (() => void) | undefined;
}): ReactNode {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm text-red-800">{message}</p>
      {onRetry !== undefined ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-medium text-red-600 underline hover:text-red-800"
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
