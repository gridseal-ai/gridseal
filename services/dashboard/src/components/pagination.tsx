export function Pagination({
  offset,
  limit,
  total,
  onPageChange,
}: {
  readonly offset: number;
  readonly limit: number;
  readonly total: number;
  readonly onPageChange: (newOffset: number) => void;
}) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div
      className="flex items-center justify-between py-4"
      data-testid="pagination"
    >
      <span className="text-sm text-gray-600">
        Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(Math.max(0, offset - limit))}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </span>
        <button
          type="button"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(offset + limit)}
          className="px-3 py-1.5 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
