/** Display a truncated hash with a copy-to-clipboard interaction. */
export function HashDisplay({
  hash,
  label,
}: {
  readonly hash: string | null;
  readonly label?: string;
}) {
  if (hash === null) {
    return <span className="text-gray-400 text-sm">-</span>;
  }

  const truncated = `${hash.slice(0, 8)}...${hash.slice(-8)}`;

  return (
    <span className="inline-flex items-center gap-1.5" data-testid="hash-display">
      {label !== undefined && (
        <span className="text-gray-500 text-xs">{label}</span>
      )}
      <code
        className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700 cursor-pointer hover:bg-gray-200 transition-colors"
        title={hash}
        onClick={() => {
          void navigator.clipboard.writeText(hash);
        }}
      >
        {truncated}
      </code>
    </span>
  );
}
