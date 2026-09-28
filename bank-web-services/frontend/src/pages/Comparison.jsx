import { useState } from 'react'
import { Braces, CircleCheck, FileCode, Play, Scale } from 'lucide-react'
import ApiMethodBadge from '../components/ApiMethodBadge'
import JsonViewer from '../components/JsonViewer'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import XmlViewer from '../components/XmlViewer'
import { COMPARISON_ROWS, OPERATION_MAPPING } from '../data/comparison'
import { DEMO_ACCOUNT } from '../data/demoClients'
import { sendRequest } from '../services/api'
import { getToken } from '../services/auth'
import { formatBytes, formatINR } from '../services/format'
import { buildEnvelope, parseSoapResponse, sendSoap } from '../services/soap'

/** Calls the SAME capability through both interfaces at once and shows the two payloads side by side. */
function LiveSideBySide() {
  const [account, setAccount] = useState(DEMO_ACCOUNT)
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const { token } = await getToken('ndb-mobile-app')
      const [rest, soap] = await Promise.all([
        sendRequest({ path: `/api/v1/accounts/${encodeURIComponent(account)}/balance`, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }),
        sendSoap(buildEnvelope({ consumer: 'ATM', operation: 'getBalance', params: { accountNumber: account } }), 'getBalance'),
      ])
      const soapParsed = soap.response ? parseSoapResponse(soap.response.rawText) : null
      setState({ rest, soap, restBalance: rest.response?.data?.availableBalance, soapBalance: soapParsed?.fields?.availableBalance })
    } catch (e) {
      setState({ error: e.message })
    }
    setLoading(false)
  }

  const same = state?.restBalance && state.restBalance === state.soapBalance
  return (
    <section className="card p-6" aria-labelledby="live-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="live-heading" className="text-lg font-semibold text-slate-900">Live: one capability, two interfaces</h2>
          <p className="text-sm text-slate-600">Fetches the balance through REST (as the mobile app) and SOAP (as the ATM) at the same time.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label htmlFor="cmp-account" className="label">Account</label>
            <input id="cmp-account" className="input w-40 font-mono" value={account} onChange={(e) => setAccount(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={run} disabled={loading}>
            <Play className="h-4 w-4" aria-hidden="true" /> {loading ? 'Calling…' : 'Call both'}
          </button>
        </div>
      </div>

      {state?.error && <Notice tone="error" className="mt-4">{state.error}</Notice>}
      {state?.rest && (
        <div className="mt-5 space-y-4" aria-live="polite">
          {same ? (
            <Notice tone="success" title={`Both interfaces report ${formatINR(state.restBalance)}`}>
              Same number, because both call <code className="font-mono">banking_service.get_balance()</code> on the same database.
              Only the representation differs.
            </Notice>
          ) : (
            <Notice tone="warning" title="Compare the two error styles">
              REST answered {state.rest.response?.status}; SOAP answered {state.soap.response?.status} with a SOAP Fault.
            </Notice>
          )}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[['REST · JSON', state.rest, Braces, 'text-indigo-700'], ['SOAP · XML', state.soap, FileCode, 'text-violet-700']].map(([title, r, IconComponent, color]) => (
              <div key={title} className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={`flex items-center gap-1.5 font-semibold ${color}`}><IconComponent className="h-4 w-4" aria-hidden="true" /> {title}</p>
                  {r.response && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <StatusBadge code={r.response.status} /> {r.response.durationMs} ms · {formatBytes(r.response.sizeBytes)}
                    </div>
                  )}
                </div>
                {r.networkError && <Notice tone="error">{r.networkError}</Notice>}
                {r.response && (title.startsWith('REST')
                  ? <JsonViewer data={r.response.data ?? r.response.rawText} title="Response" maxHeight="20rem" />
                  : <XmlViewer xml={r.response.rawText} title="Response" format={false} maxHeight="20rem" />)}
              </div>
            ))}
          </div>
          {state.rest.response && state.soap.response && (
            <p className="text-sm text-slate-600">
              Payload size: JSON <strong>{formatBytes(state.rest.response.sizeBytes)}</strong> vs XML{' '}
              <strong>{formatBytes(state.soap.response.sizeBytes)}</strong> - XML envelopes and namespaces add overhead.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default function Comparison() {
  return (
    <div className="space-y-6">
      <PageHeader icon={Scale} title="SOAP vs REST" subtitle="SOAP is a protocol. REST is an architectural style. They solve the same problem in different ways - and can live side by side." />

      <section className="card overflow-hidden" aria-label="Comparison table">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <caption className="sr-only">Comparison of SOAP and REST</caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="w-44 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 uppercase">Aspect</th>
                <th scope="col" className="bg-violet-50 px-4 py-3 text-violet-900">
                  <span className="inline-flex items-center gap-2"><FileCode className="h-4 w-4" aria-hidden="true" /> SOAP <span className="chip bg-violet-200/60 text-violet-900">Protocol</span></span>
                </th>
                <th scope="col" className="bg-indigo-50 px-4 py-3 text-indigo-900">
                  <span className="inline-flex items-center gap-2"><Braces className="h-4 w-4" aria-hidden="true" /> REST <span className="chip bg-indigo-200/60 text-indigo-900">Architectural style</span></span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.aspect} className="align-top">
                  <th scope="row" className="bg-slate-50/60 px-4 py-3 font-semibold text-slate-800">{row.aspect}</th>
                  <td className="px-4 py-3 text-slate-700">{row.soap}</td>
                  <td className="px-4 py-3 text-slate-700">{row.rest}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-6" aria-labelledby="mapping-heading">
        <h2 id="mapping-heading" className="text-lg font-semibold text-slate-900">Same capability, two interfaces, one implementation</h2>
        <div className="relative mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
              <tr><th scope="col" className="py-2 pr-4">Capability</th><th scope="col" className="py-2 pr-4">REST (mobile / fintech)</th>
                <th scope="col" className="py-2 pr-4">SOAP (ATM / branch)</th><th scope="col" className="py-2">Shared service function</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {OPERATION_MAPPING.map((m) => (
                <tr key={m.capability}>
                  <td className="py-3 pr-4 font-medium text-slate-900">{m.capability}</td>
                  <td className="py-3 pr-4"><span className="inline-flex items-center gap-2"><ApiMethodBadge method={m.rest.method} /><code className="font-mono text-xs">{m.rest.path}</code></span></td>
                  <td className="py-3 pr-4"><code className="font-mono text-xs text-violet-800">{m.soap}</code></td>
                  <td className="py-3"><code className="font-mono text-xs text-emerald-800">{m.service}</code></td>
                </tr>
              ))}
              <tr>
                <td className="py-3 pr-4 font-medium text-slate-900">Errors</td>
                <td className="py-3 pr-4 text-xs text-slate-700">HTTP status (400/404/422…) + problem JSON</td>
                <td className="py-3 pr-4 text-xs text-slate-700">SOAP Fault in XML, always HTTP 500</td>
                <td className="py-3"><code className="font-mono text-xs text-emerald-800">BankingError subclasses</code></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <LiveSideBySide />

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-violet-800"><FileCode className="h-4 w-4" aria-hidden="true" /> Choose SOAP when…</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {['Existing consumers already depend on a WSDL contract', 'You need WS-Security / formal enterprise standards',
              'Consumers are internal, stable systems (ATM switch, branch software)'].map((t) => (
              <li key={t} className="flex gap-2"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden="true" />{t}</li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="flex items-center gap-2 font-semibold text-indigo-800"><Braces className="h-4 w-4" aria-hidden="true" /> Choose REST when…</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {['Consumers are mobile apps, web apps or external partners', 'You want lightweight JSON, HTTP caching and simple tooling',
              'You need OAuth 2.0 scopes, consent and rate limits for third parties'].map((t) => (
              <li key={t} className="flex gap-2"><CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" aria-hidden="true" />{t}</li>
            ))}
          </ul>
        </div>
      </section>

      <Notice tone="warning" title="A common mistake">
        REST is <strong>not</strong> a protocol. It is an architectural style that usually runs on the HTTP protocol. SOAP is a protocol
        with its own message format.
      </Notice>

      <blockquote className="rounded-xl border-l-4 border-indigo-500 bg-white p-6 text-base font-medium text-slate-800 shadow-sm">
        SOAP and REST are not necessarily replacements for one another. In a hybrid modernization strategy, REST can serve new mobile and
        partner consumers while existing SOAP interfaces continue serving legacy consumers.
      </blockquote>
    </div>
  )
}
