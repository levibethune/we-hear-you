"use client";

export function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="text-sm px-3 py-1.5 rounded-md bg-card border border-card-border disabled:opacity-30 hover:bg-card-border/50 transition-colors"
      >
        Prev
      </button>
      <span className="text-sm text-muted">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="text-sm px-3 py-1.5 rounded-md bg-card border border-card-border disabled:opacity-30 hover:bg-card-border/50 transition-colors"
      >
        Next
      </button>
    </div>
  );
}
