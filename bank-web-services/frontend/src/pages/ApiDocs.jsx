import { Fragment, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BookOpen, ChevronDown, ExternalLink, FileCode, ShieldCheck } from 'lucide-react'
import ApiMethodBadge from '../components/ApiMethodBadge'
import JsonViewer from '../components/JsonViewer'
import Notice from '../components/Notice'
import PageHeader from '../components/PageHeader'
import SecurityPanel from '../components/SecurityPanel'
import StatusBadge from '../components/StatusBadge'
import StatusCodeGuide from '../components/StatusCodeGuide'
import XmlViewer from '../components/XmlViewer'
import { DEFAULT_SOAP_PARAMS, SOAP_FAULT_CODES, SOAP_OPERATIONS, SOAP_RESPONSE_EXAMPLES } from '../data/soapOperations'
import { DOCS_URLS, api } from '../services/api'
import { NDB_NS, buildEnvelope } from '../services/soap'

const TABS = [
  { id: 'rest', label: 'REST Endpoints' },
  { id: 'soap', label: 'SOAP Operations' },
  { id: 'status', label: 'Status Codes' },
  { id: 'security', label: 'Security' },
]
const TAG_ORDER = ['Accounts', 'Transactions', 'Transfers', 'Demo Authentication', 'Health']

// ---------------------------------------------------------------------------
// Tiny helpers to render the OpenAPI document served by FastAPI.
// ---------------------------------------------------------------------------

function resolve(schema, spec) {
  if (schema?.$ref) return spec.components.schemas[schema.$ref.split('/').pop()]
  return schema
}

/** Build an example object from a JSON schema (uses the `examples` defined on the Pydantic models). */
function exampleFromSchema(schema, spec, depth = 0) {
  const s = resolve(schema, spec)
  if (!s || depth > 4) return null
  if (s.examples?.length) return s.examples[0]
  if (s.example !== undefined) return s.example
  if (s.anyOf) return exampleFromSchema(s.anyOf.find((x) => x.type !== 'null') || s.anyOf[0], spec, depth + 1)
  if (s.type === 'object' || s.properties) {
    return Object.fromEntries(Object.entries(s.properties || {}).map(([k, v]) => [k, exampleFromSchema(v, spec, depth + 1)]))
  }
  if (s.type === 'array') return [exampleFromSchema(s.items, spec, depth + 1)]
  if (s.enum) return s.enum[0]
  if (s.format === 'date-time') return '2026-09-28T10:15:00+05:30'
  if (s.format === 'date') return '2026-09-28'
  return { string: 'string', integer: 0, number: 0, boolean: true }[s.type] ?? null
}

function inline(text) {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith('`')) return <code key={i} className="rounded bg-slate-100 px-1 font-mono text-xs">{part.slice(1, -1)}</code>
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>
    return <Fragment key={i}>{part}</Fragment>
  })
}

/** Minimal Markdown renderer for OpenAPI descriptions: paragraphs, bullet lists, tables, `code`, **bold**. */
function Markdown({ text }) {
  if (!text) return null
  return text.trim().split(/\n\s*\n/).map((block, i) => {
    const lines = block.split('\n').map((l) => l.trim())
    if (lines.every((l) => l.startsWith('|'))) {
      const rows = lines.filter((l) => !/^\|[\s:|-]+\|$/.test(l)).map((l) => l.slice(1, -1).split('|').map((c) => c.trim()))
      return (
        <div key={i} className="relative overflow-x-auto">
          <table className="my-2 text-left text-xs">
            <thead><tr>{rows[0].map((c) => <th key={c} className="border-b border-slate-200 px-2 py-1 font-semibold">{inline(c)}</th>)}</tr></thead>
            <tbody>{rows.slice(1).map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className="border-b border-slate-100 px-2 py-1">{inline(c)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    }
    if (lines.every((l) => /^[*-] /.test(l))) {
      return <ul key={i} className="my-2 list-disc space-y-1 pl-5">{lines.map((l, j) => <li key={j}>{inline(l.slice(2))}</li>)}</ul>
    }
    return <p key={i} className="my-2">{inline(lines.join(' '))}</p>
  })
}

function RestOperation({ method, path, op, spec }) {
  const [open, setOpen] = useState(false)
  const scopes = (op.security || []).flatMap((s) => Object.values(s).flat())
  const parameters = (op.parameters || []).filter((p) => p.name !== 'X-Demo-Simulate')
  const bodyContent = op.requestBody?.content || {}
  const jsonBody = bodyContent['application/json']
  const formBody = bodyContent['application/x-www-form-urlencoded']
  const formSchema = formBody && resolve(formBody.schema, spec)

  return (
    <article className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-slate-50">
        <ApiMethodBadge method={method.toUpperCase()} />
        <code className="font-mono text-sm font-semibold break-all text-slate-900">{path}</code>
        <span className="flex-1 text-sm text-slate-600">{op.summary}</span>
        {scopes.map((s) => <span key={s} className="chip bg-slate-100 font-mono text-[11px] text-slate-600">{s}</span>)}
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <div className="space-y-4 border-t border-slate-100 p-4 text-sm text-slate-700">
          <Markdown text={op.description} />
          {parameters.length > 0 && (
            <div className="relative overflow-x-auto">
              <p className="label">Parameters</p>
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="text-slate-500"><tr><th className="py-1 pr-3">Name</th><th className="py-1 pr-3">In</th><th className="py-1 pr-3">Required</th><th className="py-1">Description</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {parameters.map((p) => (
                    <tr key={`${p.in}-${p.name}`}>
                      <td className="py-1.5 pr-3 font-mono font-semibold">{p.name}</td>
                      <td className="py-1.5 pr-3">{p.in}</td>
                      <td className="py-1.5 pr-3">{p.required ? 'yes' : 'no'}</td>
                      <td className="py-1.5">{p.description || resolve(p.schema, spec)?.pattern || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {jsonBody && <JsonViewer data={exampleFromSchema(jsonBody.schema, spec)} title="Request body example" maxHeight="16rem" />}
          {formSchema && (
            <p className="text-xs">Form fields (application/x-www-form-urlencoded):{' '}
              {Object.keys(formSchema.properties || {}).map((k) => <code key={k} className="mr-1 rounded bg-slate-100 px-1 font-mono">{k}</code>)}
            </p>
          )}
          <div className="space-y-3">
            <p className="label">Responses</p>
            {Object.entries(op.responses).map(([code, response]) => {
              const content = response.content?.['application/json'] || response.content?.['application/problem+json']
              const example = content?.example ?? (content?.schema && Number(code) < 300 ? exampleFromSchema(content.schema, spec) : undefined)
              return (
                <div key={code} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge code={Number(code)} />
                    <span className="text-xs text-slate-600">{response.description}</span>
                  </div>
                  {example != null && <JsonViewer data={example} title={`${code} example`} maxHeight="14rem" />}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </article>
  )
}

function RestTab() {
  const [spec, setSpec] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.openApi().then(setSpec).catch((e) => setError(e.message))
  }, [])

  if (error) return <Notice tone="error" title="Could not load the OpenAPI document">{error}</Notice>
  if (!spec) return <p className="text-sm text-slate-500">Loading the live OpenAPI contract from the backend…</p>

  const operations = Object.entries(spec.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({ path, method, op, tag: op.tags?.[0] })))

  return (
    <div className="space-y-6">
      <Notice tone="info">
        Rendered live from <code className="font-mono">/openapi.json</code> - the contract FastAPI generates from the code, so this
        page can never drift from the implementation. Base URL <code className="font-mono">{DOCS_URLS.openapi.replace('/openapi.json', '')}</code>.
      </Notice>
      {TAG_ORDER.map((tag) => {
        const ops = operations.filter((o) => o.tag === tag)
        if (!ops.length) return null
        return (
          <section key={tag} aria-label={tag} className="space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">{tag}</h2>
            {ops.map((o) => <RestOperation key={`${o.method}-${o.path}`} {...o} spec={spec} />)}
          </section>
        )
      })}
    </div>
  )
}

function SoapTab() {
  const [wsdl, setWsdl] = useState('')
  const [showWsdl, setShowWsdl] = useState(false)

  async function toggleWsdl() {
    setShowWsdl((v) => !v)
    if (!wsdl) setWsdl(await api.wsdl().catch(() => '<!-- Could not load the WSDL - is the backend running? -->'))
  }

  return (
    <div className="space-y-6">
      <Notice tone="info">
        Endpoint <code className="font-mono">POST {DOCS_URLS.soap}</code> · SOAP 1.1 · document/literal · namespace{' '}
        <code className="font-mono">{NDB_NS}</code>. Every operation calls the same shared banking service as REST.
      </Notice>
      {SOAP_OPERATIONS.map((op) => (
        <article key={op.id} className="card space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <ApiMethodBadge method="SOAP" />
            <h3 className="font-mono text-lg font-semibold text-slate-900">{op.id}</h3>
            <span className="text-sm text-slate-600">{op.description}</span>
          </div>
          <dl className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
            <div><dt className="font-semibold text-slate-500 uppercase">SOAPAction</dt><dd className="font-mono break-all">{NDB_NS}/{op.id}</dd></div>
            <div><dt className="font-semibold text-slate-500 uppercase">Business logic</dt><dd className="font-mono">{op.service}</dd></div>
            <div><dt className="font-semibold text-slate-500 uppercase">REST equivalent</dt><dd className="font-mono">{op.rest}</dd></div>
          </dl>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <XmlViewer xml={buildEnvelope({ consumer: 'ATM', operation: op.id, params: DEFAULT_SOAP_PARAMS })} title="Request example" format={false} maxHeight="20rem" />
            <XmlViewer xml={SOAP_RESPONSE_EXAMPLES[op.id]} title="Response example" maxHeight="20rem" />
          </div>
          <Link to="/soap" className="inline-flex text-sm font-medium text-indigo-700 underline">Send it for real in the SOAP Simulator</Link>
        </article>
      ))}

      <section className="card space-y-4 p-5">
        <h3 className="font-semibold text-slate-900">SOAP Faults</h3>
        <p className="text-sm text-slate-700">Errors come back as a <code className="font-mono">soap:Fault</code> with HTTP status 500 (SOAP 1.1). The machine-readable reason is in <code className="font-mono">detail/BankingFault/errorCode</code>.</p>
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase"><tr><th className="py-2 pr-3">errorCode</th><th className="py-2 pr-3">Meaning</th><th className="py-2">Same error in REST</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {SOAP_FAULT_CODES.map((f) => (
                <tr key={f.code}><td className="py-2 pr-3 font-mono text-xs">{f.code}</td><td className="py-2 pr-3 text-slate-700">{f.meaning}</td><td className="py-2"><StatusBadge code={f.rest} /></td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <XmlViewer xml={SOAP_RESPONSE_EXAMPLES.fault} title="Fault example" maxHeight="18rem" />
      </section>

      <section className="card p-5">
        <button type="button" onClick={toggleWsdl} aria-expanded={showWsdl} className="flex w-full items-center justify-between text-left">
          <span className="flex items-center gap-2 font-semibold text-slate-900"><FileCode className="h-4 w-4 text-violet-600" aria-hidden="true" /> Live WSDL contract (GET /soap?wsdl)</span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showWsdl ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {showWsdl && <div className="mt-4">{wsdl ? <XmlViewer xml={wsdl} title="WSDL" format={false} maxHeight="36rem" /> : <p className="text-sm text-slate-500">Loading…</p>}</div>}
      </section>
    </div>
  )
}

export default function ApiDocs() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = TABS.some((t) => t.id === searchParams.get('tab')) ? searchParams.get('tab') : 'rest'

  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} title="API Documentation" subtitle="REST endpoints, SOAP operations, request/response examples, status codes and security concepts.">
        <a href={DOCS_URLS.swagger} target="_blank" rel="noreferrer" className="btn-primary">
          Open Interactive Swagger Documentation <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
        <a href={DOCS_URLS.redoc} target="_blank" rel="noreferrer" className="btn-secondary">ReDoc <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
        <a href={DOCS_URLS.wsdl} target="_blank" rel="noreferrer" className="btn-secondary">WSDL <ExternalLink className="h-4 w-4" aria-hidden="true" /></a>
      </PageHeader>

      <div role="tablist" aria-label="Documentation sections" className="flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setSearchParams({ tab: t.id }, { replace: true })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
            {t.id === 'security' && <ShieldCheck className="mr-1 inline h-4 w-4" aria-hidden="true" />}{t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'rest' && <RestTab />}
        {tab === 'soap' && <SoapTab />}
        {tab === 'status' && <StatusCodeGuide />}
        {tab === 'security' && <SecurityPanel />}
      </div>
    </div>
  )
}
