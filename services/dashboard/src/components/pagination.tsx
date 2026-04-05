type PaginationProps = {
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly onPageChange: (offset: number) => void;
};

export function Pagination({
  offset,
  limit,
  total,
  onPageChange,
}: PaginationProps): React.JSX.Element {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = offset > 0;
  const hasNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between text-sm text-slate-400">
      <span>
        Showing {Math.min(offset + 1, total)}-{Math.min(offset + limit, total)}{" "}
        of {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={!hasPrev}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-2">
          {currentPage} / {totalPages}
        </span>
        <button
          disabled={!hasNext}
          onClick={() => onPageChange(offset + limit)}
          className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
