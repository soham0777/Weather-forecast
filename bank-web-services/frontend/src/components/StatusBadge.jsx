import { STATUS_BY_CODE, statusCategory } from '../data/statusCodes'

const STYLES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  redirect: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  client: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  server: 'bg-red-50 text-red-700 ring-red-600/20',
  network: 'bg-slate-100 text-slate-700 ring-slate-500/20',
}

/** Colour-coded HTTP status: 2xx green, 4xx amber, 5xx red. */
export default function StatusBadge({ code, text, size = 'md' }) {
  const category = statusCategory(code)
  const label = code ? `${code} ${text || STATUS_BY_CODE[code]?.title || ''}`.trim() : text || 'No response'
  const sizing = size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-semibold whitespace-nowrap ring-1 ring-inset ${sizing} ${STYLES[category]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${category === 'success' ? 'bg-emerald-500' : category === 'client' ? 'bg-amber-500' : category === 'server' ? 'bg-red-500' : 'bg-slate-400'}`} />
      {label}
    </span>
  )
}
