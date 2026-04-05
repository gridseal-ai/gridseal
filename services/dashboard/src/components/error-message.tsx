export function ErrorMessage({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry?: () => void;
}) {
  return (
    <div
      className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between"
      role="alert"
      data-testid="error-message"
    >
      <p className="text-sm text-red-800">{message}</p>
      {onRetry !== undefined && (
        <button
          type="button"
          onClick={onRetry}
          className="ml-4 px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded hover:bg-red-200 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
}
