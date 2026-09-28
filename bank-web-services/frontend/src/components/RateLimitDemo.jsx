import { useState } from 'react'
import { Gauge, RotateCcw, Zap } from 'lucide-react'
import Notice from './Notice'
import { api, sendRequest } from '../services/api'
import { getToken } from '../services/auth'
import { DEMO_ACCOUNT } from '../data/demoClients'

/**
 * Fires a burst of real balance requests until the server's in-memory rate
 * limiter starts answering 429 Too Many Requests.
 */
export default function RateLimitDemo({ clientId }) {
  const [results, setResults] = useState([])
  const [summary, setSummary] = useState(null)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')

  const effectiveClient = clientId === 'anonymous' ? 'ndb-mobile-app' : clientId

  async function run() {
    setRunning(true)
    setResults([])
    setSummary(null)
    setMessage('')
    try {
      const { token } = await getToken(effectiveClient)
      const call = () => sendRequest({
        path: `/api/v1/accounts/${DEMO_ACCOUNT}/balance`,
        headers: { Authorization: `Bearer ${token}` },
      })
      const probe = await call()
      if (!probe.response) throw new Error(probe.networkError)
      const limit = Number(probe.response.headers['x-ratelimit-limit'] || 30)
      const remaining = Number(probe.response.headers['x-ratelimit-remaining'] ?? limit)
      const burst = await Promise.all(Array.from({ length: remaining + 5 }, call))
      const all = [probe, ...burst]
      setResults(all.map((r) => r.response?.status ?? 0))
      const limited = all.filter((r) => r.response?.status === 429)
      setSummary({
        limit,
        window: probe.response.headers['x-ratelimit-window'] || '60',
        ok: all.filter((r) => r.response?.status === 200).length,
        limited: limited.length,
        retryAfter: limited.at(-1)?.response.headers['retry-after'],
        detail: limited.at(-1)?.response.data?.detail,
      })
    } catch (e) {
      setMessage(e.message)
    }
    setRunning(false)
  }

  async function reset() {
    const r = await api.resetRateLimit()
    setMessage(r.response ? `Rate limiter reset - server answered ${r.response.status} No Content.` : r.networkError)
    setResults([])
    setSummary(null)
  }

  return (
    <section className="card p-5" aria-labelledby="ratelimit-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          <h2 id="ratelimit-heading" className="font-semibold text-slate-900">Rate limiting demo (429)</h2>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={run} disabled={running}>
            <Zap className="h-3.5 w-3.5" aria-hidden="true" /> {running ? 'Sending…' : 'Send burst'}
          </button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={reset} disabled={running}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset limiter
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Sends real balance requests until the per-client limit is exceeded. Each square is one response.
      </p>
      {results.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1" aria-label="Burst results">
          {results.map((status, i) => (
            <span key={i} title={`Request ${i + 1}: ${status}`}
              className={`flex h-6 w-9 items-center justify-center rounded font-mono text-[10px] font-bold ${
                status === 200 ? 'bg-emerald-100 text-emerald-800' : status === 429 ? 'bg-amber-200 text-amber-900' : 'bg-red-100 text-red-800'}`}>
              {status || 'ERR'}
            </span>
          ))}
        </div>
      )}
      {summary && (
        <Notice tone="warning" className="mt-3" title={`${summary.ok} × 200 OK, then ${summary.limited} × 429 Too Many Requests`}>
          Limit: {summary.limit} requests per {summary.window} s per client. The server sent
          <code className="mx-1 font-mono">Retry-After: {summary.retryAfter}</code>
          - the client should wait that many seconds. {summary.detail}
        </Notice>
      )}
      {message && <p className="mt-3 text-sm text-slate-600" role="status">{message}</p>}
    </section>
  )
}
