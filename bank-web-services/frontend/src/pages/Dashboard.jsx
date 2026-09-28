import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Activity, ArrowRight, Braces, Cpu, Database, FileCode, Layers, ListChecks, Quote, RefreshCw, RotateCcw, Target,
  Users,
} from 'lucide-react'
import ApiMethodBadge from '../components/ApiMethodBadge'
import HybridFlow from '../components/HybridFlow'
import Notice from '../components/Notice'
import StatusBadge from '../components/StatusBadge'
import { api } from '../services/api'
import { formatDateTime, formatINR } from '../services/format'

const WHAT_WHY = [
  { icon: Target, label: 'What', title: 'Bank Web Services Platform',
    text: 'A working simulator of a bank exposing the same capabilities through SOAP and REST.' },
  { icon: Layers, label: 'Why', title: 'Modernise without breaking',
    text: 'Shows the migration from legacy SOAP integrations to modern REST APIs - side by side.' },
  { icon: Users, label: 'How', title: 'Right interface per consumer',
    text: 'REST → mobile & fintech partners.  SOAP → ATM switch & branch software.' },
  { icon: Cpu, label: 'Core', title: 'Shared Banking Service',
    text: 'One business layer and one database behind both interfaces - no duplicated logic.' },
]

const WORKFLOW = [
  { text: 'Open this dashboard - note the balance of account 1234567890.', to: '/' },
  { text: 'Go to the REST Playground.', to: '/rest' },
  { text: 'Run GET /api/v1/accounts/1234567890/balance → 200 OK.', to: '/rest?endpoint=balance' },
  { text: 'Run GET /api/v1/accounts/1234567890/transactions → 200 OK.', to: '/rest?endpoint=transactions' },
  { text: 'Run POST …/transfers with amount 500 → 201 Created.', to: '/rest?endpoint=transfer' },
  { text: 'Run the balance again - it decreased by ₹500.', to: '/rest?endpoint=balance' },
  { text: 'Open the SOAP Simulator → ATM Switch → Get Balance → Send.', to: '/soap' },
  { text: 'Open Architecture: ATM → SOAP, Mobile/Fintech → REST, shared service → DB.', to: '/architecture' },
  { text: 'Open SOAP vs REST and compare both styles live.', to: '/comparison' },
]

function Stat({ label, value, icon: IconComponent, tone = 'indigo' }) {
  const tones = { indigo: 'bg-indigo-50 text-indigo-600', violet: 'bg-violet-50 text-violet-600',
    emerald: 'bg-emerald-50 text-emerald-600', slate: 'bg-slate-100 text-slate-600' }
  return (
    <div className="card flex items-center gap-3 p-4">
      <div className={`rounded-lg p-2 ${tones[tone]}`}><IconComponent className="h-5 w-5" aria-hidden="true" /></div>
      <div>
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [recent, setRecent] = useState([])
  const [error, setError] = useState('')
  const [resetting, setResetting] = useState(false)

  const load = useCallback(async () => {
    try {
      const [o, a, l] = await Promise.all([api.overview(), api.demoAccounts(), api.logs({ limit: 6 })])
      setOverview(o)
      setAccounts(a)
      setRecent(l.items)
      setError('')
    } catch (e) {
      setError(e.message)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load from the API
    load()
  }, [load])

  async function resetDemo() {
    if (!window.confirm('Restore all demo accounts and transactions to their original state?')) return
    setResetting(true)
    await api.resetDemo()
    await load()
    setResetting(false)
  }

  const online = overview && !error
  return (
    <div className="space-y-8">
      <section className="card overflow-hidden">
        <div className="grid grid-cols-1 gap-6 p-6 sm:p-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <p className="text-xs font-semibold tracking-widest text-indigo-600 uppercase">Educational simulator</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">National Digital Bank</h1>
            <p className="mt-1 text-lg font-medium text-slate-600">Web Services Integration Platform</p>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
              A legacy bank keeps its <strong>SOAP</strong> services for ATM switches and branch software, and introduces
              <strong> REST</strong> APIs for its mobile app and fintech partners. Both call the same banking service and database.
              Every request on this site hits the real backend - nothing is mocked.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/rest" className="btn-primary"><Braces className="h-4 w-4" aria-hidden="true" /> REST Playground</Link>
              <Link to="/soap" className="btn-secondary"><FileCode className="h-4 w-4" aria-hidden="true" /> SOAP Simulator</Link>
              <a href="#demo-workflow" className="btn-ghost"><ListChecks className="h-4 w-4" aria-hidden="true" /> Guided demo</a>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-xs font-semibold text-indigo-700 uppercase">REST → Mobile / Fintech</p>
              <p className="mt-1 text-sm text-indigo-950">Resource URLs, HTTP verbs, JSON, OAuth 2.0 tokens.</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-semibold text-violet-700 uppercase">SOAP → ATM / Branch</p>
              <p className="mt-1 text-sm text-violet-950">XML envelopes, named operations, WSDL contract.</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2 lg:col-span-1">
              <p className="text-xs font-semibold text-emerald-700 uppercase">Core → Shared Banking Service</p>
              <p className="mt-1 text-sm text-emerald-950">One business layer, one database, two interfaces.</p>
            </div>
          </div>
        </div>
      </section>

      {error && <Notice tone="error" title="Backend not reachable">{error}</Notice>}

      <section aria-label="Platform statistics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Stat label="REST APIs" value={overview?.restApis ?? '—'} icon={Braces} />
        <Stat label="SOAP Operations" value={overview?.soapOperations ?? '—'} icon={FileCode} tone="violet" />
        <Stat label="Demo Accounts" value={overview?.demoAccounts ?? '—'} icon={Users} tone="slate" />
        <Stat label="Transactions" value={overview?.transactions ?? '—'} icon={Database} tone="slate" />
        <div className="card col-span-2 flex items-center gap-3 p-4 md:col-span-1">
          <div className={`rounded-lg p-2 ${online ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
            <Activity className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">System Status</p>
            <p className={`text-xl font-bold ${online ? 'text-emerald-700' : 'text-red-700'}`}>{online ? 'Operational' : 'Offline'}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {WHAT_WHY.map(({ icon: IconComponent, label, title, text }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center gap-2 text-indigo-600">
              <IconComponent className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-bold tracking-widest uppercase">{label}</span>
            </div>
            <p className="mt-2 font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Hybrid architecture</h2>
            <p className="text-sm text-slate-600">Two interfaces, one banking service.</p>
          </div>
          <Link to="/architecture" className="btn-secondary text-xs">Interactive diagram <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </div>
        <HybridFlow />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Demo accounts</h2>
              <p className="text-sm text-slate-600">Live from the database · <span className="font-semibold text-amber-700">Demo Data Only</span></p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost px-2 text-xs" onClick={load} aria-label="Refresh demo accounts">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Refresh
              </button>
              <button type="button" className="btn-secondary px-3 text-xs" onClick={resetDemo} disabled={resetting}>
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> {resetting ? 'Resetting…' : 'Reset demo data'}
              </button>
            </div>
          </div>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <caption className="sr-only">Fictional demo accounts</caption>
              <thead className="border-b border-slate-200 text-xs text-slate-500 uppercase">
                <tr>
                  <th scope="col" className="py-2 pr-3 font-medium">Account</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Customer (fictional)</th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">Available</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((a) => (
                  <tr key={a.accountNumber}>
                    <td className="py-2.5 pr-3 font-mono text-slate-900">{a.accountNumber}</td>
                    <td className="py-2.5 pr-3 text-slate-700">{a.customerName}<span className="block text-xs text-slate-500">{a.accountType}</span></td>
                    <td className="py-2.5 pr-3 text-right font-mono font-semibold text-slate-900">{formatINR(a.availableBalance)}</td>
                    <td className="py-2.5">
                      <span className={`chip ${a.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{a.status}</span>
                    </td>
                  </tr>
                ))}
                {!accounts.length && (
                  <tr><td colSpan={4} className="py-6 text-center text-slate-500">{error ? 'Unavailable - backend offline.' : 'Loading…'}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section id="demo-workflow" className="card scroll-mt-28 p-6">
          <h2 className="text-lg font-semibold text-slate-900">Guided demo workflow</h2>
          <p className="mb-4 text-sm text-slate-600">Follow these steps in class - each one talks to the real backend.</p>
          <ol className="space-y-2">
            {WORKFLOW.map((step, i) => (
              <li key={step.text}>
                <Link to={step.to} className="group flex items-start gap-3 rounded-lg p-2 hover:bg-slate-50">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                  <span className="flex-1 text-sm text-slate-700 group-hover:text-slate-900">{step.text}</span>
                  <ArrowRight className="mt-0.5 h-4 w-4 text-slate-300 group-hover:text-indigo-600" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent API activity</h2>
            <p className="text-sm text-slate-600">{overview ? `${overview.apiCalls} calls recorded` : 'REST and SOAP calls'}</p>
          </div>
          <Link to="/logs" className="btn-secondary text-xs">All logs <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></Link>
        </div>
        {recent.length ? (
          <ul className="divide-y divide-slate-100">
            {recent.map((log) => (
              <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
                <span className={`chip ${log.interfaceType === 'REST' ? 'bg-indigo-50 text-indigo-700' : 'bg-violet-50 text-violet-700'}`}>{log.interfaceType}</span>
                <ApiMethodBadge method={log.method} />
                <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{log.endpoint}</code>
                <StatusBadge code={log.statusCode} />
                <span className="w-14 text-right font-mono text-xs text-slate-500">{log.durationMs} ms</span>
                <span className="hidden text-xs text-slate-400 md:inline">{formatDateTime(log.timestamp)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No API calls yet - try the REST Playground or the SOAP Simulator.</p>
        )}
      </section>

      <blockquote className="rounded-xl border-l-4 border-indigo-500 bg-white p-6 shadow-sm">
        <Quote className="mb-2 h-5 w-5 text-indigo-400" aria-hidden="true" />
        <p className="text-base leading-relaxed font-medium text-slate-800 sm:text-lg">
          SOAP and REST are not necessarily replacements for one another. In a hybrid modernization strategy, REST can serve new
          mobile and partner consumers while existing SOAP interfaces continue serving legacy consumers.
        </p>
      </blockquote>
    </div>
  )
}
