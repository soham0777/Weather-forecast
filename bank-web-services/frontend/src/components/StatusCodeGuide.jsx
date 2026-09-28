import { useState } from 'react'
import { STATUS_CODES } from '../data/statusCodes'

const GROUPS = [
  { id: 'all', label: 'All' },
  { id: 'success', label: '2xx Success' },
  { id: 'client', label: '4xx Client errors' },
  { id: 'server', label: '5xx Server errors' },
]

const CARD_TONE = {
  success: 'border-l-emerald-500',
  client: 'border-l-amber-500',
  server: 'border-l-red-500',
}
const CODE_TONE = {
  success: 'text-emerald-700',
  client: 'text-amber-700',
  server: 'text-red-700',
}

/** Every HTTP status code the simulator demonstrates, with realistic banking examples. */
export default function StatusCodeGuide() {
  const [group, setGroup] = useState('all')
  const codes = STATUS_CODES.filter((s) => group === 'all' || s.category === group)

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Status code group" className="flex flex-wrap gap-2">
        {GROUPS.map((g) => (
          <button key={g.id} type="button" role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${group === g.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {codes.map((s) => (
          <article key={s.code} className={`card border-l-4 p-4 ${CARD_TONE[s.category]}`}>
            <h3 className="flex items-baseline gap-2">
              <span className={`font-mono text-2xl font-bold ${CODE_TONE[s.category]}`}>{s.code}</span>
              <span className="font-semibold text-slate-900">{s.title}</span>
            </h3>
            <p className="mt-2 text-sm text-slate-700">{s.meaning}</p>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div><dt className="inline font-semibold text-slate-500 uppercase">Banking example · </dt><dd className="inline text-slate-700">{s.example}</dd></div>
              <div><dt className="inline font-semibold text-slate-500 uppercase">Try it · </dt><dd className="inline text-slate-700">{s.trigger}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}
