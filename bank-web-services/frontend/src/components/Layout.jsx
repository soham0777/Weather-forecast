import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router'
import {
  BookOpen, Braces, ExternalLink, FileCode, Landmark, LayoutDashboard, Menu, Network, Scale, ScrollText,
  TriangleAlert, X,
} from 'lucide-react'
import useHealth from '../hooks/useHealth'
import { DOCS_URLS } from '../services/api'
import { DEMO_ACCOUNT, DEMO_BENEFICIARY } from '../data/demoClients'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/rest', label: 'REST Playground', icon: Braces },
  { to: '/soap', label: 'SOAP Simulator', icon: FileCode },
  { to: '/architecture', label: 'Architecture', icon: Network },
  { to: '/comparison', label: 'SOAP vs REST', icon: Scale },
  { to: '/docs', label: 'API Documentation', icon: BookOpen },
  { to: '/logs', label: 'API Logs', icon: ScrollText },
]

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-indigo-500 p-2 text-white">
        <Landmark className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-white">National Digital Bank</p>
        <p className="text-xs text-slate-400">Web Services Platform</p>
      </div>
    </div>
  )
}

function SidebarContent({ onNavigate }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Brand />
      <nav aria-label="Main navigation" className="flex-1">
        <ul className="space-y-1">
          {NAV.map(({ to, label, icon: IconComponent, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
              >
                <IconComponent className="h-4 w-4" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-xs text-slate-300">
        <p className="mb-2 font-semibold tracking-wide text-amber-300 uppercase">Demo Data Only</p>
        <dl className="space-y-1.5">
          <div><dt className="text-slate-400">Demo Account</dt><dd className="font-mono text-sm text-white">{DEMO_ACCOUNT}</dd></div>
          <div><dt className="text-slate-400">Demo Beneficiary</dt><dd className="font-mono text-sm text-white">{DEMO_BENEFICIARY}</dd></div>
        </dl>
        <p className="mt-2 text-[11px] leading-snug text-slate-400">Fictional accounts - not real bank accounts.</p>
      </div>
    </div>
  )
}

function HealthIndicator() {
  const { status } = useHealth()
  const map = {
    checking: ['bg-slate-400', 'Checking…', 'text-slate-600'],
    up: ['bg-emerald-500', 'System Operational', 'text-emerald-700'],
    degraded: ['bg-amber-500', 'Degraded', 'text-amber-700'],
    down: ['bg-red-500', 'Backend Offline', 'text-red-700'],
  }
  const [dot, text, color] = map[status]
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold ${color}`}
      role="status" title={status === 'down' ? 'Start the FastAPI backend on port 8000' : 'GET /api/v1/health'}>
      <span className="relative flex h-2 w-2">
        {status === 'up' && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {text}
    </span>
  )
}

export default function Layout() {
  const [open, setOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-slate-900 shadow-xl">
            <button type="button" onClick={() => setOpen(false)} className="absolute top-4 right-3 rounded-md p-1 text-slate-300 hover:bg-slate-800"
              aria-label="Close navigation">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
            <button type="button" onClick={() => setOpen(true)} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation">
              <Menu className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-bold text-slate-900">National Digital Bank</p>
              <p className="truncate text-xs text-slate-500">Web Services Platform · SOAP + REST Integration Demonstrator</p>
            </div>
            <a href={DOCS_URLS.swagger} target="_blank" rel="noreferrer" className="btn-ghost hidden px-2 py-1 text-xs sm:inline-flex">
              Swagger <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <HealthIndicator />
          </div>
          <div className="flex items-center justify-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs font-semibold text-amber-900">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>EDUCATIONAL SIMULATOR — NOT A REAL BANKING SYSTEM <span className="hidden font-normal sm:inline">· All accounts and transactions are fictional demo data</span></span>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <Outlet />
        </main>
        <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-500 sm:px-6">
          National Digital Bank is a fictional institution. This simulator does not connect to any real bank, NPCI, UPI, RBI or ATM network.
        </footer>
      </div>
    </div>
  )
}
