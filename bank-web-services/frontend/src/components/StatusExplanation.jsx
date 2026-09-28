import { GraduationCap } from 'lucide-react'
import { STATUS_BY_CODE, statusCategory } from '../data/statusCodes'

const TONE = {
  success: 'border-emerald-200 bg-emerald-50/60',
  client: 'border-amber-200 bg-amber-50/60',
  server: 'border-red-200 bg-red-50/60',
  redirect: 'border-sky-200 bg-sky-50/60',
  network: 'border-slate-200 bg-slate-50',
}

/** "What happened?" - explains the status code (and the server's problem details, if any). */
export default function StatusExplanation({ code, problem, extra }) {
  const info = STATUS_BY_CODE[code]
  const category = statusCategory(code)
  return (
    <div className={`rounded-lg border p-4 text-sm ${TONE[category]}`} aria-live="polite">
      <div className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
        <GraduationCap className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        What happened? {code ? `${code} ${info?.title ?? ''}` : ''}
      </div>
      {info ? <p className="text-slate-700">{info.meaning}</p> : code ? <p className="text-slate-700">HTTP status {code}.</p> : null}
      {problem?.detail && (
        <p className="mt-2 text-slate-800">
          <span className="font-medium">Server says:</span> {problem.detail}
          {problem.code && <span className="ml-1 font-mono text-xs text-slate-500">({problem.code})</span>}
        </p>
      )}
      {problem?.simulated && (
        <p className="mt-2 text-xs font-medium text-amber-800">This failure was simulated on purpose - the application is not actually broken.</p>
      )}
      {extra && <div className="mt-2 text-slate-700">{extra}</div>}
    </div>
  )
}
