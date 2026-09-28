const STYLES = {
  GET: 'bg-sky-100 text-sky-800',
  POST: 'bg-emerald-100 text-emerald-800',
  PUT: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-red-100 text-red-800',
  SOAP: 'bg-violet-100 text-violet-800',
}

/** HTTP method (REST) or "SOAP" badge. */
export default function ApiMethodBadge({ method, className = '' }) {
  const key = (method || '').toUpperCase()
  const style = STYLES[key] || STYLES.SOAP
  return (
    <span className={`inline-flex min-w-12 justify-center rounded px-2 py-0.5 font-mono text-xs font-bold ${style} ${className}`}>
      {method}
    </span>
  )
}
