import { Fragment, useCallback, useEffect, useState } from 'react'
import { ChevronDown, RefreshCw, ScrollText, Trash2 } from 'lucide-react'
import ApiMethodBadge from '../components/ApiMethodBadge'
import CodeBlock from '../components/CodeBlock'
import JsonViewer from '../components/JsonViewer'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import XmlViewer from '../components/XmlViewer'
import { api } from '../services/api'
import { formatDateTime } from '../services/format'

const INTERFACES = ['ALL', 'REST', 'SOAP']
const STATUSES = ['ALL', '2xx', '4xx', '5xx']

function Segmented({ label, options, value, onChange, render = (o) => o }) {
  return (
    <div>
      <p className="label">{label}</p>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5">
        {options.map((o) => (
          <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
            className={`rounded-md px-3 py-1 text-xs font-semibold ${value === o ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Show a logged payload in the best viewer: JSON, XML, or plain text (e.g. truncated or with header lines). */
function Payload({ title, text }) {
  if (!text) return <p className="text-xs text-slate-400">{title}: no body (e.g. a GET request)</p>
  const trimmed = text.trim()
  let json
  try {
    json = JSON.parse(trimmed)
  } catch {
    json = undefined // not JSON (XML, truncated text, or header lines + body)
  }
  if (json !== undefined && typeof json === 'object') return <JsonViewer data={json} title={title} maxHeight="18rem" />
  if (trimmed.startsWith('<')) return <XmlViewer xml={trimmed} title={title} maxHeight="18rem" />
  return <CodeBlock title={title} text={text} maxHeight="18rem" />
}

export default function ApiLogs() {
  const [iface, setIface] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [auto, setAuto] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    try {
      setData(await api.logs({ interface: iface, status, limit: 200 }))
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [iface, status])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- (re)load whenever the filters change
    load()
    if (!auto) return undefined
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [load, auto])

  async function clear() {
    if (!window.confirm('Delete all recorded API calls?')) return
    const res = await api.clearLogs()
    setMessage(res.response
      ? `DELETE /api/v1/logs → ${res.response.status} ${res.response.status === 204 ? 'No Content' : ''} (success, nothing to return)`
      : res.networkError)
    load()
  }

  const stats = data?.stats
  const tiles = stats ? [
    ['Total calls', stats.total, 'text-slate-900'], ['REST', stats.rest, 'text-indigo-700'], ['SOAP', stats.soap, 'text-violet-700'],
    ['2xx', stats.success, 'text-emerald-700'], ['4xx', stats.clientErrors, 'text-amber-700'], ['5xx', stats.serverErrors, 'text-red-700'],
    ['Avg duration', `${stats.averageDurationMs} ms`, 'text-slate-900'],
  ] : []

  return (
    <div className="space-y-6">
      <PageHeader icon={ScrollText} title="API Logs" subtitle="Every REST and SOAP banking call recorded by the backend middleware - interface, method or operation, status and duration.">
        <button type="button" className="btn-secondary" onClick={load}><RefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh</button>
        <button type="button" className="btn-danger" onClick={clear}><Trash2 className="h-4 w-4" aria-hidden="true" /> Clear logs</button>
      </PageHeader>

      {error && <Notice tone="error" title="Backend not reachable">{error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}

      {stats && (
        <section aria-label="Log statistics (all calls)" className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {tiles.map(([label, value, color]) => (
            <div key={label} className="card p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </section>
      )}

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <Segmented label="Interface" options={INTERFACES} value={iface} onChange={setIface} render={(o) => (o === 'ALL' ? 'All' : o)} />
          <Segmented label="Status" options={STATUSES} value={status} onChange={setStatus} render={(o) => (o === 'ALL' ? 'All' : o)} />
          <label className="ml-auto inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
            Auto-refresh (5 s)
          </label>
        </div>

        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[980px] table-fixed text-left text-sm">
            <caption className="sr-only">Recorded API calls, newest first</caption>
            <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr>
                <th scope="col" className="w-52 py-2 pr-3 font-medium">Timestamp</th>
                <th scope="col" className="w-20 py-2 pr-3 font-medium">Interface</th>
                <th scope="col" className="w-32 py-2 pr-3 font-medium">Method</th>
                <th scope="col" className="py-2 pr-3 font-medium">Endpoint</th>
                <th scope="col" className="w-52 py-2 pr-3 font-medium">Status</th>
                <th scope="col" className="w-20 py-2 pr-3 text-right font-medium">Duration</th>
                <th scope="col" className="w-44 py-2 pr-3 font-medium">Consumer</th>
                <th scope="col" className="w-24 py-2 font-medium"><span className="sr-only">Details</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data?.items.map((log) => (
                <Fragment key={log.id}>
                  <tr className="align-middle hover:bg-slate-50">
                    <td className="py-2 pr-3 text-xs whitespace-nowrap text-slate-600">{formatDateTime(log.timestamp)}</td>
                    <td className="py-2 pr-3">
                      <span className={`chip ${log.interfaceType === 'REST' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'}`}>{log.interfaceType}</span>
                    </td>
                    <td className="py-2 pr-3"><ApiMethodBadge method={log.method} /></td>
                    <td className="truncate py-2 pr-3 font-mono text-xs text-slate-800" title={log.endpoint}>{log.endpoint}</td>
                    <td className="py-2 pr-3"><StatusBadge code={log.statusCode} /></td>
                    <td className="py-2 pr-3 text-right font-mono text-xs">{log.durationMs} ms</td>
                    <td className="truncate py-2 pr-3 text-xs text-slate-600" title={log.consumer || ''}>{log.consumer || '—'}</td>
                    <td className="py-2">
                      <button type="button" onClick={() => setExpanded(expanded === log.id ? null : log.id)} aria-expanded={expanded === log.id}
                        className="btn-ghost px-2 py-1 text-xs" aria-label={`Details of call ${log.id}`}>
                        Details <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded === log.id ? 'rotate-180' : ''}`} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr>
                      <td colSpan={8} className="bg-slate-50 p-4">
                        <p className="mb-3 text-xs text-slate-500">Request ID <code className="font-mono">{log.requestId}</code></p>
                        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
                          <Payload title="Request" text={log.requestSummary} />
                          <Payload title="Response" text={log.responseSummary} />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {data && !data.items.length && (
                <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-500">No calls match these filters yet. Use the REST Playground or the SOAP Simulator.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
