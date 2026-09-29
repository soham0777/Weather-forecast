import { EmptyState, ErrorState, TableSkeleton } from './States';

/**
 * Responsive table (scrolls horizontally on small screens) with loading, error and empty states.
 * columns: [{ key, header, render?(row), className? }]
 */
export default function DataTable({ columns, rows, loading, error, onRetry, emptyTitle, emptyMessage, emptyAction,
  rowKey = (row) => row.id, caption }) {
  if (loading && !rows?.length) return <TableSkeleton cols={Math.min(columns.length, 6)} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (!rows || rows.length === 0) {
    return <EmptyState title={emptyTitle || 'No records found.'} message={emptyMessage} action={emptyAction} />;
  }
  return (
    <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
      <table className="table-base">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className={col.headerClassName || ''}>{col.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} className={col.className || ''}>
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
