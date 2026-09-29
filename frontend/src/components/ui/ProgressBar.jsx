/** Horizontal meter with a visible percentage label. */
export default function ProgressBar({ value, label }) {
  const pct = Math.max(0, Math.min(100, value || 0));
  const fill = pct >= 100 ? 'bg-emerald-600' : pct >= 50 ? 'bg-brand-600' : 'bg-amber-500';
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex justify-between text-sm">
          <span className="font-medium text-slate-700">{label}</span>
          <span className="font-semibold text-slate-900">{pct}%</span>
        </div>
      )}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct}
           aria-valuemin={0} aria-valuemax={100} aria-label={label || 'Progress'}>
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
