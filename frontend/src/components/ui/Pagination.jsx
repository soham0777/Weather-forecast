import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Server-side pagination controls for a PageResponse. */
export default function Pagination({ page, onChange }) {
  if (!page || page.totalElements === 0) return null;
  const from = page.page * page.size + 1;
  const to = Math.min((page.page + 1) * page.size, page.totalElements);
  const btn = 'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 ring-inset ring-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300';
  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
      <p className="text-sm text-slate-600">
        Showing <span className="font-medium">{from}</span>–<span className="font-medium">{to}</span> of{' '}
        <span className="font-medium">{page.totalElements}</span>
      </p>
      <div className="flex items-center gap-2">
        <button type="button" className={btn} disabled={page.first} onClick={() => onChange(page.page - 1)}>
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
        </button>
        <span className="text-sm text-slate-500">Page {page.page + 1} of {Math.max(page.totalPages, 1)}</span>
        <button type="button" className={btn} disabled={page.last} onClick={() => onChange(page.page + 1)}>
          Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
