type ValidationState = "valid" | "invalid" | "pending" | "idle";

const VALIDATION_STYLES: Record<ValidationState, string> = {
  valid: "bg-green-100 text-green-800 border-green-200",
  invalid: "bg-red-100 text-red-800 border-red-200",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  idle: "bg-gray-100 text-gray-600 border-gray-200",
};

const VALIDATION_LABELS: Record<ValidationState, string> = {
  valid: "Valid",
  invalid: "Invalid",
  pending: "Validating...",
  idle: "Not Validated",
};

export function ValidationBadge({
  state,
}: {
  readonly state: ValidationState;
}) {
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-md text-sm font-medium border ${VALIDATION_STYLES[state]}`}
      data-testid="validation-badge"
    >
      {VALIDATION_LABELS[state]}
    </span>
  );
}
