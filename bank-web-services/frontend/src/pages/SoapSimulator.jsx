import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { ExternalLink, FileCode, FlaskConical, PencilLine, RefreshCw, Send } from 'lucide-react'
import CodeBlock from '../components/CodeBlock'
import Icon from '../components/Icon'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import StatusBadge from '../components/StatusBadge'
import XmlViewer from '../components/XmlViewer'
import { DEFAULT_SOAP_PARAMS, SOAP_FAULT_CODES, SOAP_OPERATIONS } from '../data/soapOperations'
import { DOCS_URLS } from '../services/api'
import { formatDateTime, formatINR, randomRrn } from '../services/format'
import { CONSUMERS, buildEnvelope, parseSoapResponse, sendSoap, soapHeaders } from '../services/soap'

const COMMON_SCENARIOS = [
  { id: 'malformed', label: 'Malformed XML (Client fault)' },
  { id: 'server', label: 'Core banking outage (Server fault)', simulate: '503' },
]

const mask = (account) => (account ? `XXXXXX${String(account).slice(-4)}` : '')

/** What the legacy consumer would show its user, built from the parsed XML response. */
function ConsumerView({ consumer, operation, parsed, receivedAt }) {
  if (!parsed) return null
  if (consumer === 'ATM') {
    const line = '-'.repeat(32)
    const rows = ['  NATIONAL DIGITAL BANK (DEMO)', `${CONSUMERS.ATM.terminalId}  ${new Date(receivedAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}`, line]
    if (parsed.fault) {
      rows.push('TRANSACTION DECLINED', `REASON: ${parsed.fault.errorCode || parsed.fault.faultcode}`)
    } else if (operation === 'getBalance') {
      const f = parsed.fields
      rows.push('BALANCE ENQUIRY', `A/C        ${mask(f.accountNumber)}`, `AVAIL BAL  ${formatINR(f.availableBalance)}`, `LEDGER BAL ${formatINR(f.ledgerBalance)}`)
    } else if (operation === 'getMiniStatement') {
      rows.push(`MINI STATEMENT  A/C ${mask(parsed.fields.accountNumber)}`)
      parsed.entries.forEach((e) => rows.push(`${e.date.slice(5)} ${e.type === 'DEBIT' ? 'DR' : 'CR'} ${formatINR(e.amount).padStart(14)}`))
      rows.push(line, `AVAIL BAL  ${formatINR(parsed.fields.availableBalance)}`)
    } else {
      const f = parsed.fields
      rows.push('FUND TRANSFER', `TXN ID     ${f.transferId}`, `TO A/C     ${mask(f.toAccount)}`, `AMOUNT     ${formatINR(f.amount)}`,
        `STATUS     ${f.status}`, `AVAIL BAL  ${formatINR(f.availableBalance)}`)
    }
    rows.push(line, '* SIMULATOR - NOT A REAL ATM *')
    return (
      <div>
        <p className="label">What the ATM prints</p>
        <pre className="mx-auto max-w-xs rounded-md border border-dashed border-slate-300 bg-amber-50/40 p-4 font-mono text-xs leading-relaxed text-slate-800 shadow-inner">
          {rows.join('\n')}
        </pre>
      </div>
    )
  }
  return (
    <div>
      <p className="label">What the teller sees (branch software)</p>
      {parsed.fault ? (
        <Notice tone="error" title={`Error ${parsed.fault.errorCode}`}>{parsed.fault.errorMessage}</Notice>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Parsed SOAP response fields</caption>
            <tbody className="divide-y divide-slate-100">
              {Object.entries(parsed.fields).filter(([k]) => k !== 'entries').map(([k, v]) => (
                <tr key={k}><th scope="row" className="w-1/2 bg-slate-50 px-3 py-1.5 font-mono text-xs font-medium text-slate-600">{k}</th><td className="px-3 py-1.5 font-mono text-xs">{v}</td></tr>
              ))}
            </tbody>
          </table>
          {parsed.entries.length > 0 && (
            <table className="w-full border-t border-slate-200 text-left text-xs">
              <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-1.5">Date</th><th className="px-3 py-1.5">Type</th><th className="px-3 py-1.5 text-right">Amount</th><th className="hidden px-3 py-1.5 sm:table-cell">Description</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {parsed.entries.map((e) => (
                  <tr key={e.transactionId}><td className="px-3 py-1.5 font-mono">{e.date}</td><td className="px-3 py-1.5">{e.type}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{formatINR(e.amount)}</td><td className="hidden truncate px-3 py-1.5 sm:table-cell">{e.description}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

export default function SoapSimulator() {
  const [consumer, setConsumer] = useState('ATM')
  const [operationId, setOperationId] = useState('getBalance')
  const [params, setParams] = useState(() => ({ ...DEFAULT_SOAP_PARAMS, referenceId: randomRrn() }))
  const [scenarioId, setScenarioId] = useState('normal')
  const [editMode, setEditMode] = useState(false)
  const [editedXml, setEditedXml] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const resultRef = useRef(null)

  const operation = SOAP_OPERATIONS.find((o) => o.id === operationId)
  const scenarios = [...operation.scenarios, ...COMMON_SCENARIOS]
  const scenario = scenarios.find((s) => s.id === scenarioId) || scenarios[0]

  const envelope = buildEnvelope({ consumer, operation: operationId, params })
  // The "malformed" scenario chops off the closing tag so the XML is not well-formed.
  const generatedXml = scenario.id === 'malformed' ? envelope.replace('</soap:Envelope>', '') : envelope
  const requestXml = editMode ? editedXml : generatedXml
  const headers = soapHeaders(operationId, scenario.simulate)

  function chooseOperation(id) {
    setOperationId(id)
    setScenarioId('normal')
    setParams((p) => ({ ...DEFAULT_SOAP_PARAMS, referenceId: p.referenceId }))
    setEditMode(false)
    setResult(null)
  }

  function chooseScenario(id) {
    const next = scenarios.find((s) => s.id === id)
    setScenarioId(id)
    setParams((p) => ({ ...DEFAULT_SOAP_PARAMS, referenceId: p.referenceId, ...(next.patch || {}) }))
    setEditMode(false)
  }

  async function send() {
    setLoading(true)
    const res = await sendSoap(requestXml, operationId, { simulate: scenario.simulate })
    setResult({
      ...res,
      operation: operationId,
      consumer,
      receivedAt: new Date().toISOString(),
      parsed: res.response ? parseSoapResponse(res.response.rawText) : null,
    })
    if (operationId === 'transferFunds' && res.response?.status === 200) {
      setParams((p) => ({ ...p, referenceId: randomRrn() })) // next transfer gets a new RRN
    }
    setLoading(false)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const fault = result?.parsed?.fault
  const faultInfo = fault && SOAP_FAULT_CODES.find((f) => f.code === fault.errorCode)
  const httpPreamble = [`POST /soap HTTP/1.1`, `Host: ${new URL(DOCS_URLS.soap).host}`,
    ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`)].join('\n')

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileCode}
        title="Legacy SOAP Service Simulator"
        subtitle="Play the role of an ATM switch or branch system: build a SOAP 1.1 XML envelope, POST it to /soap and inspect the XML reply."
        badges={<>
          <span className="chip bg-violet-50 text-violet-700">XML envelopes</span>
          <span className="chip bg-violet-50 text-violet-700">Operation-oriented</span>
          <span className="chip bg-slate-100 text-slate-700">WSDL contract</span>
        </>}
      >
        <a href={DOCS_URLS.wsdl} target="_blank" rel="noreferrer" className="btn-secondary">
          View WSDL <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </PageHeader>

      <Notice tone="info" title="Why SOAP is still here">
        SOAP is retained for existing legacy consumers such as ATM switches and branch software in this educational architecture.
        Their integrations were generated from the WSDL years ago and keep working unchanged - while new mobile and partner
        consumers use REST. Both reach the <strong>same banking service</strong>.
      </Notice>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* ---------------- Request side ---------------- */}
        <section className="card min-w-0 space-y-6 p-5 sm:p-6" aria-label="SOAP request builder">
          <div>
            <p className="label">1 · Consumer</p>
            <div role="radiogroup" aria-label="Consumer" className="grid grid-cols-2 gap-3">
              {Object.values(CONSUMERS).map((c) => {
                const active = consumer === c.id
                return (
                  <button key={c.id} type="button" role="radio" aria-checked={active} onClick={() => setConsumer(c.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${active ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <span className="flex items-center gap-2 font-semibold text-slate-900">
                      <Icon name={c.id === 'ATM' ? 'CreditCard' : 'Building2'} className="h-4 w-4 text-violet-600" /> {c.name}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-slate-500">{c.terminalId}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="label">2 · Operation</p>
            <div role="radiogroup" aria-label="Operation" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {SOAP_OPERATIONS.map((op) => {
                const active = operationId === op.id
                return (
                  <button key={op.id} type="button" role="radio" aria-checked={active} onClick={() => chooseOperation(op.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${active ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500' : 'border-slate-200 hover:bg-slate-50'}`}>
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Icon name={op.icon} className="h-4 w-4 text-violet-600" /> {op.label}
                    </span>
                    <span className="mt-1 block font-mono text-xs text-slate-500">{op.id}</span>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">{operation.description} Calls <code className="font-mono">{operation.service}</code>.</p>
          </div>

          <div className="space-y-4">
            <p className="label">3 · Parameters</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {operation.params.map((p) => (
                <div key={p.name}>
                  <label htmlFor={`soap-${p.name}`} className="mb-1 block text-xs font-medium text-slate-600">
                    {p.label} <span className="font-mono text-slate-400">&lt;ndb:{p.name}&gt;</span>
                  </label>
                  <div className="flex gap-2">
                    <input id={`soap-${p.name}`} className="input font-mono" value={params[p.name] ?? ''} disabled={editMode}
                      onChange={(e) => setParams((prev) => ({ ...prev, [p.name]: e.target.value }))} />
                    {p.name === 'referenceId' && (
                      <button type="button" className="btn-secondary px-3" onClick={() => setParams((prev) => ({ ...prev, referenceId: randomRrn() }))}
                        aria-label="Generate a new reference number" disabled={editMode}>
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {operationId === 'transferFunds' && (
              <p className="text-xs text-slate-500">
                The RRN acts as an idempotency key: an ATM that retries with the same referenceId gets the original result - never a double debit.
              </p>
            )}
            <div>
              <label htmlFor="soap-scenario" className="mb-1 block text-xs font-medium text-slate-600">Scenario</label>
              <select id="soap-scenario" className="input" value={scenario.id} onChange={(e) => chooseScenario(e.target.value)}>
                {scenarios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900">SOAP REQUEST</h2>
              <label className="inline-flex items-center gap-2 text-xs text-slate-700">
                <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={editMode}
                  onChange={(e) => { setEditMode(e.target.checked); setEditedXml(generatedXml) }} />
                <PencilLine className="h-3.5 w-3.5" aria-hidden="true" /> Edit XML by hand
              </label>
            </div>
            <CodeBlock title="HTTP request line & headers" language="http" text={httpPreamble} maxHeight="10rem" />
            {editMode ? (
              <div>
                <label htmlFor="soap-xml" className="sr-only">SOAP request XML</label>
                <textarea id="soap-xml" rows={16} spellCheck={false} className="input font-mono text-xs"
                  value={editedXml} onChange={(e) => setEditedXml(e.target.value)} />
              </div>
            ) : (
              <XmlViewer xml={generatedXml} title="SOAP envelope (request body)" format={false} />
            )}
          </div>

          <button type="button" className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            onClick={send} disabled={loading}>
            <span className="inline-flex items-center gap-2"><Send className="h-4 w-4" aria-hidden="true" /> {loading ? 'Sending…' : 'Send SOAP Request'}</span>
          </button>
        </section>

        {/* ---------------- Response side ---------------- */}
        <section ref={resultRef} className="card min-w-0 scroll-mt-28 space-y-5 p-5 sm:p-6" aria-label="SOAP response" aria-live="polite">
          <h2 className="text-sm font-semibold text-slate-900">SOAP RESPONSE</h2>
          {!result && (
            <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
              <FlaskConical className="mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
              Press “Send SOAP Request”. The XML reply from the real SOAP endpoint will appear here.
            </div>
          )}
          {result?.networkError && <Notice tone="error" title="No response from the server">{result.networkError}</Notice>}
          {result?.response && (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Status</dt>
                  <dd className="mt-1"><StatusBadge code={result.response.status} text={fault ? 'SOAP Fault' : result.response.statusText || 'OK'} /></dd></div>
                <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Response time</dt>
                  <dd className="mt-1 font-mono font-semibold">{result.response.durationMs} ms</dd></div>
                <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Operation</dt>
                  <dd className="mt-1 font-mono text-xs font-semibold break-all">{result.operation}</dd></div>
                <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">Consumer</dt>
                  <dd className="mt-1 text-xs font-semibold">{CONSUMERS[result.consumer].name}</dd></div>
              </dl>

              {fault ? (
                <Notice tone="error" title={`SOAP Fault · ${fault.faultcode} · ${fault.errorCode}`}>
                  <p>{fault.faultstring}</p>
                  <p className="mt-2 text-xs">
                    SOAP 1.1 returns <strong>every</strong> fault with HTTP 500 - the real reason lives inside the XML
                    (<code className="font-mono">faultcode</code> + <code className="font-mono">detail</code>).
                    {faultInfo && <> The REST API reports the same problem as <strong>HTTP {faultInfo.rest}</strong>.</>}
                  </p>
                </Notice>
              ) : (
                <Notice tone="success" title="HTTP 200 · SOAP response received">
                  Same data as the REST API - produced by <code className="font-mono">{operation.service}</code>, only wrapped in XML.
                  Equivalent REST call: <code className="font-mono">{operation.rest}</code>.
                </Notice>
              )}

              <XmlViewer xml={result.response.rawText} title="SOAP envelope (response body)" format={false} />
              <ConsumerView consumer={result.consumer} operation={result.operation} parsed={result.parsed} receivedAt={result.receivedAt} />
              <p className="text-xs text-slate-500">
                Received {formatDateTime(result.receivedAt)} · request id{' '}
                <code className="font-mono">{result.response.headers['x-request-id']}</code> ·{' '}
                <Link to="/logs" className="text-indigo-700 underline">see it in API Logs</Link>
              </p>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
