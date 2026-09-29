import { useState } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/States';

/**
 * Wraps a chart with a title and a Chart/Table toggle so every figure is also available as
 * an accessible table. `data` is [{ label, value }]; `valueLabel` names the value column.
 */
export default function ChartCard({ title, description, data, valueLabel = 'Count', formatValue = (v) => v,
  emptyMessage = 'No data available', children, className = '' }) {
  const [view, setView] = useState('chart');
  const hasData = data && data.length > 0 && data.some((d) => d.value !== null && d.value !== undefined);
  const allZero = hasData && data.every((d) => !d.value);

  const toggle = hasData && (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label={`${title} view`}>
      {[['chart', BarChart3, 'Chart'], ['table', Table2, 'Table']].map(([id, Icon, text]) => (
        <button key={id} type="button" onClick={() => setView(id)} aria-pressed={view === id}
                className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium
                  ${view === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {text}
        </button>
      ))}
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader title={title} description={description} actions={toggle} />
      <div className="px-3 py-4 sm:px-5">
        {!hasData && <EmptyState title={emptyMessage} />}
        {hasData && view === 'chart' && (
          <>
            {allZero && <p className="mb-2 text-center text-xs text-slate-500">All values are currently zero.</p>}
            {children}
          </>
        )}
        {hasData && view === 'table' && (
          <div className="overflow-x-auto">
            <table className="table-base">
              <caption className="sr-only">{title}</caption>
              <thead><tr><th scope="col">Category</th><th scope="col" className="text-right">{valueLabel}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((d) => (
                  <tr key={d.label}>
                    <td>{d.label}</td>
                    <td className="text-right tabular">{d.value === null || d.value === undefined ? 'No data' : formatValue(d.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
