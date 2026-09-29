/** Key/value details grid. items: [{ label, value }] */
export default function DescriptionList({ items, columns = 2 }) {
  const cols = columns === 3 ? 'sm:grid-cols-3' : columns === 1 ? '' : 'sm:grid-cols-2';
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${cols}`}>
      {items.filter(Boolean).map((item) => (
        <div key={item.label} className={item.wide ? 'sm:col-span-full' : ''}>
          <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{item.label}</dt>
          <dd className="mt-1 text-sm break-words text-slate-900">{item.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
