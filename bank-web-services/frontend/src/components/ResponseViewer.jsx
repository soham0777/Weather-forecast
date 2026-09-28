import { useState } from 'react'
import { Clock, HardDrive, Hash, Server } from 'lucide-react'
import CodeBlock from './CodeBlock'
import JsonViewer from './JsonViewer'
import Notice from './Notice'
import StatusBadge from './StatusBadge'
import XmlViewer from './XmlViewer'
import { formatBytes } from '../services/format'

/** Status, timing, headers and the syntax-highlighted body of a real HTTP response. */
export default function ResponseViewer({ result, label = 'Response', children }) {
  const [tab, setTab] = useState('body')
  if (!result) return null
  if (result.networkError) {
    return (
      <Notice tone="error" title="No response from the server">
        {result.networkError}
      </Notice>
    )
  }
  const { response } = result
  const isXml = response.contentType.includes('xml')
  const headers = Object.entries(response.headers).sort(([a], [b]) => a.localeCompare(b))
  const tabs = [['body', 'Body'], ['headers', `Headers (${headers.length})`]]

  return (
    <section aria-label={label} className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <div role="tablist" aria-label={`${label} view`} className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
          {tabs.map(([id, name]) => (
            <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`rounded-md px-2.5 py-1 font-medium ${tab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>
              {name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <StatusBadge code={response.status} text={response.statusText} size="lg" />
        <span className="inline-flex items-center gap-1" title="Round-trip time measured in the browser">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" /> <strong className="text-slate-900">{result.response.durationMs} ms</strong> total
        </span>
        {response.headers['x-process-time-ms'] && (
          <span className="inline-flex items-center gap-1" title="Time spent inside the FastAPI server">
            <Server className="h-3.5 w-3.5" aria-hidden="true" /> {response.headers['x-process-time-ms']} ms server
          </span>
        )}
        <span className="inline-flex items-center gap-1"><HardDrive className="h-3.5 w-3.5" aria-hidden="true" /> {formatBytes(response.sizeBytes)}</span>
        {response.headers['x-request-id'] && (
          <span className="inline-flex items-center gap-1 font-mono"><Hash className="h-3.5 w-3.5" aria-hidden="true" />{response.headers['x-request-id']}</span>
        )}
      </div>

      {tab === 'body' && (
        response.rawText
          ? isXml
            ? <XmlViewer xml={response.rawText} title="Response body" format={false} />
            : response.data !== undefined
              ? <JsonViewer data={response.data} title="Response body" />
              : <CodeBlock title="Response body" text={response.rawText} />
          : <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
              Empty body{response.status === 204 ? ' - 204 No Content means there is intentionally nothing to return.' : '.'}
            </p>
      )}
      {tab === 'headers' && (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full table-fixed text-left text-xs">
            <caption className="sr-only">Response headers</caption>
            <thead className="bg-slate-50 text-slate-500">
              <tr><th scope="col" className="w-2/5 px-3 py-1.5 font-medium">Header</th><th scope="col" className="px-3 py-1.5 font-medium">Value</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {headers.map(([k, v]) => (
                <tr key={k}>
                  <td className="px-3 py-1.5 font-semibold text-slate-700">{k}</td>
                  <td className="px-3 py-1.5 break-all text-slate-600">{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
            Browsers only expose headers the server lists in Access-Control-Expose-Headers (CORS).
          </p>
        </div>
      )}
      {children}
    </section>
  )
}
