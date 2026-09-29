import { RatingDisplay } from '../ui/StarRating';

/** Read-only list of labelled ratings. */
export default function RatingsSummary({ fields, values }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.key} className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5">
          <dt className="text-sm text-slate-600">{f.label}</dt>
          <dd><RatingDisplay value={values?.[f.key]} /></dd>
        </div>
      ))}
    </dl>
  );
}
