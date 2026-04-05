import type { ReactNode } from "react";

type Variant = "success" | "error" | "warning" | "info" | "neutral";

const VARIANT_CLASSES: Record<Variant, string> = {
  success: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
  warning: "bg-amber-100 text-amber-800",
  info: "bg-blue-100 text-blue-800",
  neutral: "bg-gray-100 text-gray-800",
};

export function StatusBadge({
  variant,
  children,
}: {
  readonly variant: Variant;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
