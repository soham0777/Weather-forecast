import { useId } from 'react';

const base = `block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm
  placeholder:text-slate-400 focus:outline-none focus:ring-2 disabled:bg-slate-100 disabled:text-slate-500`;
const ok = 'border-slate-300 focus:border-brand-600 focus:ring-brand-600/20';
const bad = 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20';

/**
 * Label + control + hint/error. Pass a render function to receive the ids/aria props:
 * <FormField label="Name" required error={...}>{(p) => <Input {...p} />}</FormField>
 */
export function FormField({ label, required, error, hint, children, className = '' }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const controlProps = {
    id,
    invalid: Boolean(error),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
    required,
  };
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="ml-0.5 text-rose-600" aria-hidden="true">*</span>}
        </label>
      )}
      {children(controlProps)}
      {hint && !error && <p id={hintId} className="mt-1.5 text-xs text-slate-500">{hint}</p>}
      {error && <p id={errorId} className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function Input({ invalid, className = '', ...props }) {
  return <input className={`${base} ${invalid ? bad : ok} ${className}`} {...props} />;
}

export function Select({ invalid, className = '', children, ...props }) {
  return (
    <select className={`${base} ${invalid ? bad : ok} pr-8 ${className}`} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ invalid, className = '', rows = 4, ...props }) {
  return <textarea rows={rows} className={`${base} ${invalid ? bad : ok} ${className}`} {...props} />;
}

/** Shows "120 / 3000" under long text fields. */
export function CharCount({ value = '', max, min }) {
  const length = value?.length || 0;
  const tooShort = min && length > 0 && length < min;
  return (
    <p className={`mt-1 text-right text-xs ${length > max || tooShort ? 'text-rose-600' : 'text-slate-400'}`}>
      {tooShort ? `${min - length} more characters needed · ` : ''}{length} / {max}
    </p>
  );
}
