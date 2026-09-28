import { useState } from 'react'
import ApiMethodBadge from './ApiMethodBadge'
import CodeBlock from './CodeBlock'
import CopyButton from './CopyButton'
import JsonViewer from './JsonViewer'
import XmlViewer from './XmlViewer'

function curlCommand({ method, url, headers, body }) {
  const lines = [`curl -X ${method} "${url}"`]
  Object.entries(headers || {}).forEach(([k, v]) => lines.push(`  -H "${k}: ${String(v).replace(/"/g, '\\"')}"`))
  if (body) lines.push(`  --data '${body.replace(/'/g, "'\\''")}'`)
  return lines.join(' \\\n')
}

function rawHttp({ method, url, headers, body }) {
  const u = new URL(url)
  const lines = [`${method} ${u.pathname}${u.search} HTTP/1.1`, `Host: ${u.host}`]
  Object.entries(headers || {}).forEach(([k, v]) => lines.push(`${k}: ${v}`))
  return lines.join('\n') + (body ? `\n\n${body}` : '\n')
}

/** Shows exactly what is (or was) sent: method, URL, headers, body - plus raw HTTP and cURL views. */
export default function RequestViewer({ request, bodyLanguage = 'json', label = 'Request' }) {
  const [tab, setTab] = useState('details')
  if (!request) return null
  const headers = Object.entries(request.headers || {})
  const tabs = [['details', 'Details'], ['raw', 'Raw HTTP'], ['curl', 'cURL']]

  return (
    <section aria-label={label} className="space-y-3">
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

      {tab === 'details' && (
        <>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <ApiMethodBadge method={request.method} />
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-800 sm:text-sm" title={request.url}>{request.url}</code>
            <CopyButton text={request.url} label="URL" />
          </div>
          {headers.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full table-fixed text-left text-xs">
                <caption className="sr-only">Request headers</caption>
                <thead className="bg-slate-50 text-slate-500">
                  <tr><th scope="col" className="w-1/3 px-3 py-1.5 font-medium">Header</th><th scope="col" className="px-3 py-1.5 font-medium">Value</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {headers.map(([k, v]) => (
                    <tr key={k}>
                      <td className="px-3 py-1.5 font-semibold text-slate-700">{k}</td>
                      <td className="truncate px-3 py-1.5 text-slate-600" title={String(v)}>{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {request.body && (bodyLanguage === 'xml'
            ? <XmlViewer xml={request.body} title="Request body" format={false} maxHeight="22rem" />
            : <JsonViewer data={request.body} title="Request body" maxHeight="22rem" />)}
        </>
      )}
      {tab === 'raw' && <CodeBlock title="Raw HTTP request" language="http" text={rawHttp(request)} />}
      {tab === 'curl' && <CodeBlock title="cURL" language="shell" text={curlCommand(request)} />}
    </section>
  )
}
