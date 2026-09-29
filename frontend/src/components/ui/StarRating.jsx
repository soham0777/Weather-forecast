import { useId } from 'react';
import { Star } from 'lucide-react';

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

/** 1–5 rating input built on radio buttons (keyboard and screen-reader friendly). */
export function StarRatingInput({ label, value, onChange, error, required = true, description }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span>}
      </legend>
      {description && <p className="text-xs text-slate-500">{description}</p>}
      <div className="mt-1.5 flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer rounded p-0.5 focus-within:ring-2 focus-within:ring-brand-600">
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="sr-only"
                   aria-label={`${n} of 5 — ${WORDS[n]}`} />
            <Star aria-hidden="true"
                  className={`h-6 w-6 ${value >= n ? 'fill-amber-400 text-amber-500' : 'text-slate-300 hover:text-amber-400'}`} />
          </label>
        ))}
        <span className="ml-2 text-sm text-slate-600">{value ? `${value}/5 · ${WORDS[value]}` : 'Not rated'}</span>
      </div>
      {error && <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </fieldset>
  );
}

/** Read-only rating: stars plus the number (never colour or stars alone). */
export function RatingDisplay({ value, max = 5, size = 'h-4 w-4' }) {
  if (value === null || value === undefined) return <span className="text-sm text-slate-400">No data available</span>;
  const rounded = Math.round(value);
  return (
    <span className="inline-flex items-center gap-1.5" aria-label={`${value} out of ${max}`}>
      <span className="flex" aria-hidden="true">
        {Array.from({ length: max }).map((_, i) => (
          <Star key={i} className={`${size} ${i < rounded ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} />
        ))}
      </span>
      <span className="text-sm font-medium text-slate-700 tabular">{Number(value).toFixed(1)}</span>
    </span>
  );
}
