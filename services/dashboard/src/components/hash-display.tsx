import type { ReactNode } from "react";

export function HashDisplay({
  hash,
  label,
}: {
  readonly hash: string | null;
  readonly label?: string | undefined;
}): ReactNode {
  if (hash === null) {
    return <span className="text-gray-400">-</span>;
  }

  const short = `${hash.slice(0, 8)}...${hash.slice(-8)}`;

  return (
    <span className="font-mono text-sm" title={hash}>
      {label !== undefined ? <span className="text-gray-500 mr-1">{label}:</span> : null}
      {short}
    </span>
  );
}
