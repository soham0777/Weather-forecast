/** Tooltip body shared by all charts; text uses ink colours, the swatch carries identity. */
export default function ChartTooltip({ active, payload, label, formatValue = (v) => v, valueLabel = 'Value', formatLabel = (l) => l }) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{formatLabel(label ?? item.payload?.label)}</p>
      <p className="mt-1 flex items-center gap-1.5 text-slate-600">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: item.color || item.fill }} aria-hidden="true" />
        {valueLabel}: <span className="font-semibold text-slate-900 tabular">{formatValue(item.value)}</span>
      </p>
    </div>
  );
}
