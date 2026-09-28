import { useState } from 'react'
import { ChevronDown, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react'
import CopyButton from './CopyButton'
import Icon from './Icon'
import JsonViewer from './JsonViewer'
import Notice from './Notice'
import { DEMO_CLIENTS } from '../data/demoClients'
import { decodeJwt } from '../services/auth'

/** DEMO AUTHENTICATION: pick an API client and see the OAuth 2.0 token it receives. */
export default function AuthPanel({ clientId, onChange, tokenInfo, error, loading, onRefresh }) {
  const [showClaims, setShowClaims] = useState(false)
  const client = DEMO_CLIENTS.find((c) => c.id === clientId)
  const decoded = tokenInfo ? decodeJwt(tokenInfo.token) : null

  return (
    <section className="card p-5" aria-labelledby="auth-heading">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          <h2 id="auth-heading" className="font-semibold text-slate-900">Calling as…</h2>
          <span className="chip bg-amber-100 font-bold text-amber-800">DEMO AUTHENTICATION</span>
        </div>
        <p className="text-xs text-slate-500">OAuth 2.0 client credentials → JWT Bearer token</p>
      </div>

      <div role="radiogroup" aria-label="API client" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {DEMO_CLIENTS.map((c) => {
          const active = c.id === clientId
          return (
            <button key={c.id} type="button" role="radio" aria-checked={active} onClick={() => onChange(c.id)}
              className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                active ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
              <Icon name={c.icon} className={`h-4 w-4 shrink-0 ${active ? 'text-indigo-600' : 'text-slate-500'}`} />
              <span className="font-medium text-slate-900">{c.name}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p className="text-slate-600">{client.description}</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase">Scopes</span>
            {client.scopes.length ? client.scopes.map((s) => (
              <span key={s} className="chip bg-slate-100 font-mono text-slate-700">{s}</span>
            )) : <span className="text-xs text-slate-400">none</span>}
          </div>
          <p className="text-xs text-slate-500"><span className="font-semibold uppercase">Consent</span> · {client.consent}</p>
          {client.clientSecret && (
            <p className="text-xs text-slate-500">
              client_id <code className="font-mono text-slate-700">{client.id}</code> · client_secret{' '}
              <code className="font-mono text-slate-700">{client.clientSecret}</code> <span className="text-amber-700">(demo value)</span>
            </p>
          )}
        </div>

        <div className="min-w-0 space-y-2">
          {error && <Notice tone="error">{error}</Notice>}
          {!client.clientSecret && (
            <Notice tone="warning">No token will be sent. Protected endpoints will answer <strong>401 Unauthorized</strong>.</Notice>
          )}
          {client.clientSecret && tokenInfo && (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                <KeyRound className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700" title={tokenInfo.token}>{tokenInfo.token}</code>
                <CopyButton text={tokenInfo.token} label="Token" />
                <button type="button" onClick={onRefresh} disabled={loading} className="btn-ghost px-2 py-1 text-xs" aria-label="Request a new token">
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Issued by <code className="font-mono">POST /api/v1/oauth/token</code> · expires{' '}
                {new Date(tokenInfo.expiresAt).toLocaleTimeString('en-IN')}
              </p>
              <button type="button" onClick={() => setShowClaims((v) => !v)} aria-expanded={showClaims}
                className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 hover:text-indigo-900">
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showClaims ? 'rotate-180' : ''}`} aria-hidden="true" />
                {showClaims ? 'Hide' : 'Show'} decoded JWT (header + payload)
              </button>
              {showClaims && decoded && <JsonViewer data={decoded} title="Decoded JWT (signature not shown)" maxHeight="18rem" />}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
