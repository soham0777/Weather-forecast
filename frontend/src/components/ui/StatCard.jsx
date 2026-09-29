import { Link } from 'react-router-dom';

/** Stat tile: label, value, optional hint. The icon is decorative; the label carries meaning. */
export default function StatCard({ label, value, hint, icon: Icon, to, accent = 'brand' }) {
  const accents = {
    brand: 'bg-brand-50 text-brand-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-1.5 text-2xl font-semibold text-slate-900">{value ?? '—'}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {Icon && (
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${accents[accent]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
    </div>
  );
  if (to) {
    return <Link to={to} className="card block p-5 transition hover:border-brand-200 hover:shadow">{body}</Link>;
  }
  return <div className="card p-5">{body}</div>;
}
