import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Braces, CircleCheck, CircleX, FlaskConical, History, Play, RefreshCw, Repeat, Send, Wallet } from 'lucide-react'
import ApiMethodBadge from '../components/ApiMethodBadge'
import AuthPanel from '../components/AuthPanel'
import Icon from '../components/Icon'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import RateLimitDemo from '../components/RateLimitDemo'
import RequestViewer from '../components/RequestViewer'
import ResponseViewer from '../components/ResponseViewer'
import StatusExplanation from '../components/StatusExplanation'
import { DEFAULT_FORM, FAILURE_SIMULATIONS, REST_ENDPOINTS } from '../data/restEndpoints'
import { DEMO_CLIENTS } from '../data/demoClients'
import { STATUS_BY_CODE } from '../data/statusCodes'
import { buildUrl, sendRequest } from '../services/api'
import { getToken } from '../services/auth'
import { formatINR, paiseToString, randomKey, toPaise } from '../services/format'

function transferBody(form) {
  return {
    beneficiaryAccount: form.beneficiary,
    amount: form.amount,
    currency: 'INR',
    mode: form.mode,
    remarks: form.remarks,
  }
}

/** Translate the form into a concrete HTTP request for one endpoint. */
function buildRequest({ endpointId, form, token, idemKey, simulate, body }) {
  const headers = { Accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (simulate) headers['X-Demo-Simulate'] = simulate
  const account = encodeURIComponent(form.accountId.trim())
  switch (endpointId) {
    case 'balance':
      return { method: 'GET', path: `/api/v1/accounts/${account}/balance`, headers }
    case 'transactions':
      return {
        method: 'GET', path: `/api/v1/accounts/${account}/transactions`, headers,
        params: { limit: form.limit, fromDate: form.fromDate, toDate: form.toDate, type: form.type },
      }
    case 'transfer':
      headers['Content-Type'] = 'application/json'
      if (idemKey) headers['Idempotency-Key'] = idemKey
      return {
        method: 'POST', path: `/api/v1/accounts/${account}/transfers`, headers,
        data: body ?? JSON.stringify(transferBody(form), null, 2),
      }
    case 'transferStatus':
      return { method: 'GET', path: `/api/v1/transfers/${encodeURIComponent(form.transferId.trim())}`, headers }
    default:
      return null
  }
}

function Field({ id, label, children, hint }) {
  return (
    <div>
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

export default function RestPlayground() {
  const [searchParams, setSearchParams] = useSearchParams()
  const endpoint = REST_ENDPOINTS.find((e) => e.id === searchParams.get('endpoint')) || null

  const [clientId, setClientId] = useState('ndb-mobile-app')
  const [tokens, setTokens] = useState({})
  const [tokenError, setTokenError] = useState('')
  const [tokenLoading, setTokenLoading] = useState(false)

  const [form, setForm] = useState(DEFAULT_FORM)
  const [scenarioId, setScenarioId] = useState('normal')
  const [simulate, setSimulate] = useState('')
  const [idemKey, setIdemKey] = useState(() => randomKey('DEMO-TRANSFER'))
  const [autoKey, setAutoKey] = useState(true)
  const [rawMode, setRawMode] = useState(false)
  const [rawBody, setRawBody] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [lastBalances, setLastBalances] = useState({})
  const [lastTransfer, setLastTransfer] = useState(null)
  const resultRef = useRef(null)
  const panelRef = useRef(null)

  const scenario = endpoint?.scenarios.find((s) => s.id === scenarioId) || endpoint?.scenarios[0]
  const effectiveClientId = scenario?.client || clientId

  const ensureToken = useCallback(async (id, force = false) => {
    if (id === 'anonymous') return null
    const info = await getToken(id, { force })
    setTokens((t) => ({ ...t, [id]: info }))
    return info
  }, [])

  // Fetch (or refresh) the token for the client shown in the auth panel.
  const loadToken = useCallback(async (id, force = false) => {
    setTokenLoading(true)
    try {
      await ensureToken(id, force)
      setTokenError('')
    } catch (e) {
      setTokenError(e.message)
    }
    setTokenLoading(false)
  }, [ensureToken])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch a token whenever the client changes
    loadToken(clientId)
  }, [clientId, loadToken])

  const generatedBody = JSON.stringify(transferBody(form), null, 2)

  // Live preview of the request that "Send" will produce.
  let preview = null
  if (endpoint) {
    const previewToken = effectiveClientId === 'anonymous' ? null : tokens[effectiveClientId]?.token ?? '<token requested on Send>'
    const req = buildRequest({
      endpointId: endpoint.id, form, token: previewToken, idemKey, simulate,
      body: rawMode && endpoint.id === 'transfer' ? rawBody : undefined,
    })
    preview = { ...req, url: buildUrl(req.path, req.params), body: req.data }
  }

  function selectEndpoint(id) {
    setSearchParams({ endpoint: id }, { replace: true })
    setScenarioId('normal')
    setResult(null)
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function applyScenario(id) {
    const next = endpoint.scenarios.find((s) => s.id === id)
    setScenarioId(id)
    if (next.client && next.client !== 'anonymous') ensureToken(next.client).catch(() => {})
    setForm((f) => ({ ...DEFAULT_FORM, transferId: f.transferId, ...(next.patch || {}) }))
    setRawMode(false)
    setResult(null)
  }

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  /** Send a real request. `overrides` lets follow-up buttons replay or chain requests. */
  async function send(overrides = {}) {
    const endpointId = overrides.endpointId || endpoint.id
    const activeScenario = overrides.endpointId && overrides.endpointId !== endpoint?.id ? null : scenario
    const f = overrides.form || form
    const cid = overrides.clientId || activeScenario?.client || clientId
    setLoading(true)

    let token
    try {
      token = (await ensureToken(cid))?.token ?? null
    } catch (e) {
      setResult({ endpointId, networkError: e.message })
      setLoading(false)
      return
    }
    const req = buildRequest({
      endpointId, form: f, token,
      idemKey: endpointId === 'transfer' ? overrides.idemKey ?? idemKey : undefined,
      simulate: overrides.simulate ?? simulate,
      body: overrides.body ?? (rawMode && endpointId === 'transfer' && !overrides.endpointId ? rawBody : undefined),
    })
    const res = await sendRequest(req)
    const status = res.response?.status
    const data = res.response?.data
    let balanceNote = null

    if (endpointId === 'balance' && status === 200) {
      const previous = lastBalances[data.accountId]
      if (previous !== undefined && previous !== data.availableBalance) {
        const delta = toPaise(data.availableBalance) - toPaise(previous)
        balanceNote = { previous, current: data.availableBalance, delta: paiseToString(delta) }
      }
      setLastBalances((b) => ({ ...b, [data.accountId]: data.availableBalance }))
    }
    if (endpointId === 'transfer' && (status === 201 || status === 202)) {
      const replayed = res.response.headers['idempotent-replayed'] === 'true'
      if (!replayed) {
        setLastTransfer({ transferId: data.transferId, key: req.headers['Idempotency-Key'], body: req.data, status })
        if (autoKey && overrides.idemKey === undefined) setIdemKey(randomKey('DEMO-TRANSFER'))
      }
      setForm((fm) => ({ ...fm, transferId: data.transferId }))
    }

    const expect = overrides.expect ?? activeScenario?.expect
    setResult({ ...res, endpointId, expect, balanceNote })
    setLoading(false)
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50)
  }

  function followUp(action) {
    if (action === 'balance' || action === 'status') {
      const id = action === 'balance' ? 'balance' : 'transferStatus'
      const nextForm = { ...form, transferId: lastTransfer?.transferId ?? form.transferId }
      setSearchParams({ endpoint: id }, { replace: true })
      setScenarioId('normal')
      setForm(nextForm)
      send({ endpointId: id, form: nextForm, expect: 200 })
    } else if (action === 'replay') {
      send({ endpointId: 'transfer', idemKey: lastTransfer.key, body: lastTransfer.body, expect: lastTransfer.status })
    } else if (action === 'conflict') {
      const body = JSON.parse(lastTransfer.body)
      const cents = toPaise(body.amount)
      body.amount = cents !== null ? paiseToString(cents + 100n) : '1.00'
      send({ endpointId: 'transfer', idemKey: lastTransfer.key, body: JSON.stringify(body, null, 2), expect: 409 })
    }
  }

  const status = result?.response?.status
  const problem = result?.response?.data && status >= 400 ? result.response.data : null
  const replayed = result?.response?.headers?.['idempotent-replayed'] === 'true'
  const clientName = DEMO_CLIENTS.find((c) => c.id === effectiveClientId)?.name

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Braces}
        title="REST API Playground"
        subtitle="Call the modern REST interface exactly like a mobile app or fintech partner would: resource URLs, HTTP methods, JSON and status codes."
        badges={<>
          <span className="chip bg-indigo-50 text-indigo-700">JSON over HTTP</span>
          <span className="chip bg-indigo-50 text-indigo-700">Resource-oriented</span>
          <span className="chip bg-slate-100 text-slate-700">OpenAPI contract</span>
        </>}
      />

      <AuthPanel clientId={clientId} onChange={setClientId} tokenInfo={tokens[clientId]} error={tokenError}
        loading={tokenLoading} onRefresh={() => loadToken(clientId, true)} />

      <section aria-label="REST endpoints" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REST_ENDPOINTS.map((e) => {
          const active = endpoint?.id === e.id
          return (
            <article key={e.id} className={`card flex flex-col p-5 transition-shadow ${active ? 'ring-2 ring-indigo-500' : 'hover:shadow-md'}`}>
              <div className="mb-3 flex items-center justify-between">
                <div className={`rounded-lg p-2 ${e.secondary ? 'bg-slate-100 text-slate-600' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Icon name={e.icon} className="h-5 w-5" />
                </div>
                <span className="chip bg-slate-100 font-mono text-[11px] text-slate-600">{e.scope}</span>
              </div>
              <h2 className="font-semibold text-slate-900">{e.title}</h2>
              <div className="mt-2 flex items-start gap-2">
                <ApiMethodBadge method={e.method} />
                <code className="font-mono text-xs text-slate-700">{e.path.split('/').map((part, i) => <span key={i}>{i > 0 && <>/<wbr /></>}{part}</span>)}</code>
              </div>
              <p className="mt-2 flex-1 text-sm text-slate-600">{e.description}</p>
              <button type="button" className={`${active ? 'btn-secondary' : 'btn-primary'} mt-4`} onClick={() => selectEndpoint(e.id)}
                aria-label={`Try API: ${e.title}`}>
                <Play className="h-4 w-4" aria-hidden="true" /> {active ? 'Selected' : 'Try API'}
              </button>
            </article>
          )
        })}
      </section>

      {!endpoint && (
        <Notice title="Pick an endpoint above and press “Try API”">
          Suggested order for the class demo: Balance Enquiry → Mini Statement → Fund Transfer (₹500) → Balance Enquiry again.
        </Notice>
      )}

      {endpoint && (
        <section ref={panelRef} className="card scroll-mt-28 p-5 sm:p-6" aria-labelledby="request-panel-heading">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <ApiMethodBadge method={endpoint.method} className="text-sm" />
            <h2 id="request-panel-heading" className="text-lg font-semibold text-slate-900">{endpoint.title}</h2>
            <code className="font-mono text-sm text-slate-500">{endpoint.path}</code>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {/* ---------------- Request builder ---------------- */}
            <div className="min-w-0 space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="scenario" label="Scenario">
                  <select id="scenario" className="input" value={scenario.id} onChange={(e) => applyScenario(e.target.value)}>
                    {endpoint.scenarios.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                </Field>
                <Field id="simulate" label="Simulate failure (demo)" hint="Adds the X-Demo-Simulate header.">
                  <select id="simulate" className="input" value={simulate} onChange={(e) => setSimulate(e.target.value)}>
                    {FAILURE_SIMULATIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </Field>
              </div>

              {(scenario.explain || scenario.client) && (
                <Notice tone="info" title={`Expected: ${scenario.expect} ${STATUS_BY_CODE[scenario.expect]?.title ?? ''}`}>
                  {scenario.explain}
                  {scenario.client && <> Sent with the <strong>{clientName}</strong> token.</>}
                </Notice>
              )}

              <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <legend className="sr-only">Request parameters</legend>
                {endpoint.id !== 'transferStatus' && (
                  <Field id="accountId" label={endpoint.id === 'transfer' ? 'Source account (path)' : 'Account ID (path)'}>
                    <input id="accountId" className="input font-mono" value={form.accountId} onChange={update('accountId')} />
                  </Field>
                )}
                {endpoint.id === 'transactions' && (
                  <>
                    <Field id="limit" label="limit"><input id="limit" type="number" className="input" value={form.limit} onChange={update('limit')} /></Field>
                    <Field id="fromDate" label="fromDate"><input id="fromDate" type="date" className="input" value={form.fromDate} onChange={update('fromDate')} /></Field>
                    <Field id="toDate" label="toDate"><input id="toDate" type="date" className="input" value={form.toDate} onChange={update('toDate')} /></Field>
                    <Field id="type" label="type">
                      <select id="type" className="input" value={form.type} onChange={update('type')}>
                        <option value="">Any</option><option value="DEBIT">DEBIT</option><option value="CREDIT">CREDIT</option>
                      </select>
                    </Field>
                  </>
                )}
                {endpoint.id === 'transfer' && !rawMode && (
                  <>
                    <Field id="beneficiary" label="Beneficiary account">
                      <input id="beneficiary" className="input font-mono" value={form.beneficiary} onChange={update('beneficiary')} />
                    </Field>
                    <Field id="amount" label="Amount (INR, as a string)">
                      <input id="amount" className="input font-mono" inputMode="decimal" value={form.amount} onChange={update('amount')} />
                    </Field>
                    <Field id="mode" label="Mode">
                      <select id="mode" className="input" value={form.mode} onChange={update('mode')}>
                        <option value="IMPS">IMPS - instant (201)</option>
                        <option value="NEFT">NEFT - batch (202)</option>
                        <option value="RTGS">RTGS - min ₹2,00,000</option>
                        <option value="INTERNAL">INTERNAL - same bank</option>
                      </select>
                    </Field>
                    <Field id="remarks" label="Remarks">
                      <input id="remarks" className="input" value={form.remarks} onChange={update('remarks')} maxLength={100} />
                    </Field>
                  </>
                )}
                {endpoint.id === 'transferStatus' && (
                  <Field id="transferId" label="Transfer ID (path)" hint="Pre-filled with your most recent transfer.">
                    <input id="transferId" className="input font-mono" value={form.transferId} onChange={update('transferId')} />
                  </Field>
                )}
              </fieldset>

              {endpoint.id === 'transfer' && (
                <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <Field id="idemKey" label="Idempotency-Key header" hint="Same key + same body = safe retry (no double debit). Same key + different body = 409.">
                    <div className="flex gap-2">
                      <input id="idemKey" className="input font-mono" value={idemKey} onChange={(e) => setIdemKey(e.target.value)} placeholder="(none)" />
                      <button type="button" className="btn-secondary px-3" onClick={() => setIdemKey(randomKey('DEMO-TRANSFER'))} aria-label="Generate a new idempotency key">
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </Field>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-700">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={autoKey} onChange={(e) => setAutoKey(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
                      New key after each successful transfer
                    </label>
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" checked={rawMode} className="h-4 w-4 rounded border-slate-300"
                        onChange={(e) => { setRawMode(e.target.checked); setRawBody(generatedBody) }} />
                      Edit raw JSON body
                    </label>
                  </div>
                  {rawMode && (
                    <div>
                      <label htmlFor="rawBody" className="label">Raw JSON body</label>
                      <textarea id="rawBody" rows={8} spellCheck={false} className="input font-mono text-xs"
                        value={rawBody} onChange={(e) => setRawBody(e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              <RequestViewer request={preview} label="Request preview" />

              <button type="button" className="btn-primary w-full py-2.5" onClick={() => send()} disabled={loading}>
                <Send className="h-4 w-4" aria-hidden="true" /> {loading ? 'Sending…' : `Send ${endpoint.method} request`}
              </button>
            </div>

            {/* ---------------- Response ---------------- */}
            <div ref={resultRef} className="min-w-0 scroll-mt-28 space-y-4">
              {!result && (
                <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                  <FlaskConical className="mb-2 h-6 w-6 text-slate-400" aria-hidden="true" />
                  The real response from FastAPI will appear here - status code, timing, headers and JSON.
                </div>
              )}
              {result && (
                <ResponseViewer result={result} label={`Response · ${REST_ENDPOINTS.find((e) => e.id === result.endpointId)?.title}`}>
                  {result.response && (
                    <>
                      {result.expect && (
                        <p className={`flex items-center gap-1.5 text-sm font-medium ${result.expect === status ? 'text-emerald-700' : 'text-amber-700'}`}>
                          {result.expect === status
                            ? <><CircleCheck className="h-4 w-4" aria-hidden="true" /> Matches the expected {result.expect} for this scenario.</>
                            : <><CircleX className="h-4 w-4" aria-hidden="true" /> Scenario expected {result.expect}, server returned {status}.</>}
                        </p>
                      )}
                      <StatusExplanation code={status} problem={problem} />

                      {result.balanceNote && (
                        <Notice tone="success" title={`Balance changed by ${formatINR(result.balanceNote.delta)}`}>
                          {formatINR(result.balanceNote.previous)} → {formatINR(result.balanceNote.current)} since your previous balance
                          enquiry. The transfer really updated the database.
                        </Notice>
                      )}
                      {result.endpointId === 'balance' && status === 200 && !result.balanceNote && (
                        <p className="text-sm text-slate-600">
                          Available balance: <strong className="font-mono">{formatINR(result.response.data.availableBalance)}</strong>.
                          After a transfer, run this again to see the change.
                        </p>
                      )}

                      {result.endpointId === 'transfer' && replayed && (
                        <Notice tone="success" title="Idempotent replay - no new transfer">
                          The server recognised the Idempotency-Key and returned the <strong>original</strong> result
                          ({result.response.data.transferId}) with <code className="font-mono">Idempotent-Replayed: true</code>. No money moved twice.
                        </Notice>
                      )}
                      {result.endpointId === 'transfer' && (status === 201 || status === 202) && lastTransfer && (
                        <div className="space-y-2 rounded-lg border border-slate-200 p-4">
                          <p className="text-sm font-semibold text-slate-900">Next steps</p>
                          {status === 202 && (
                            <p className="text-sm text-slate-600">NEFT settles in a simulated batch (~20 s). Poll the transfer status until it is COMPLETED.</p>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={() => followUp('balance')}>
                              <Wallet className="h-3.5 w-3.5" aria-hidden="true" /> Check balance now
                            </button>
                            <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => followUp('status')}>
                              <History className="h-3.5 w-3.5" aria-hidden="true" /> Transfer status
                            </button>
                            {lastTransfer.key && (
                              <>
                                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => followUp('replay')}>
                                  <Repeat className="h-3.5 w-3.5" aria-hidden="true" /> Resend with same key
                                </button>
                                <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={() => followUp('conflict')}>
                                  <Repeat className="h-3.5 w-3.5" aria-hidden="true" /> Same key, different amount
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </ResponseViewer>
              )}
              {result?.request && result.response && (
                <details className="rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-700">Request details (exactly what was sent)</summary>
                  <div className="mt-3"><RequestViewer request={{ ...result.request }} label="Sent request" /></div>
                </details>
              )}
            </div>
          </div>
        </section>
      )}

      <RateLimitDemo clientId={clientId} />

      <p className="text-sm text-slate-600">
        What does each status code mean? See the <Link to="/docs?tab=status" className="font-medium text-indigo-700 underline">status code guide</Link>{' '}
        and the <Link to="/docs?tab=security" className="font-medium text-indigo-700 underline">security concepts</Link>.
      </p>
    </div>
  )
}
