import { ArrowDown } from 'lucide-react'
import Icon from './Icon'

function Chip({ icon, label, tone }) {
  const tones = {
    rest: 'border-indigo-200 bg-white text-indigo-900',
    soap: 'border-violet-200 bg-white text-violet-900',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm ${tones[tone]}`}>
      <Icon name={icon} className="h-3.5 w-3.5" /> {label}
    </span>
  )
}

function Arrow({ label, tone }) {
  const color = tone === 'rest' ? 'text-indigo-500' : tone === 'soap' ? 'text-violet-500' : 'text-slate-400'
  return (
    <div className={`flex flex-col items-center py-1 ${color}`}>
      <ArrowDown className="h-5 w-5" aria-hidden="true" />
      {label && <span className="mt-0.5 rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-semibold ring-1 ring-current">{label}</span>}
      {label && <ArrowDown className="h-5 w-5" aria-hidden="true" />}
    </div>
  )
}

function Box({ icon, title, subtitle, tone }) {
  const tones = {
    rest: 'border-indigo-300 bg-indigo-50 text-indigo-950',
    soap: 'border-violet-300 bg-violet-50 text-violet-950',
    core: 'border-emerald-300 bg-emerald-50 text-emerald-950',
    data: 'border-slate-300 bg-slate-100 text-slate-900',
  }
  return (
    <div className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-center ${tones[tone]}`}>
      <Icon name={icon} className="h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-bold">{title}</p>
        {subtitle && <p className="text-xs opacity-75">{subtitle}</p>}
      </div>
    </div>
  )
}

/** The hybrid architecture at a glance: two lanes converging on one banking service. */
export default function HybridFlow() {
  return (
    <figure aria-label="Hybrid SOAP and REST architecture diagram">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
          <p className="mb-3 text-center text-xs font-semibold tracking-wide text-indigo-700 uppercase">New consumers (introduced)</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Chip icon="Smartphone" label="Mobile App" tone="rest" />
            <Chip icon="Globe" label="Fintech Partner" tone="rest" />
            <Chip icon="Zap" label="UPI App (simulated)" tone="rest" />
          </div>
          <Arrow label="REST / JSON" tone="rest" />
          <Box icon="Braces" title="API Layer" subtitle="FastAPI REST · /api/v1" tone="rest" />
        </div>
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
          <p className="mb-3 text-center text-xs font-semibold tracking-wide text-violet-700 uppercase">Legacy consumers (retained)</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Chip icon="CreditCard" label="ATM Switch" tone="soap" />
            <Chip icon="Building2" label="Branch Software" tone="soap" />
          </div>
          <Arrow label="SOAP / XML" tone="soap" />
          <Box icon="FileCode" title="SOAP Service" subtitle="SOAP 1.1 · /soap · WSDL" tone="soap" />
        </div>
      </div>
      <div className="grid grid-cols-2">
        <Arrow tone="rest" />
        <Arrow tone="soap" />
      </div>
      <Box icon="Cpu" title="Banking Service — shared business logic" subtitle="banking_service.py · one implementation for both interfaces" tone="core" />
      <Arrow />
      <Box icon="Database" title="Core Banking / SQLite" subtitle="accounts · transactions · transfers · api_logs" tone="data" />
    </figure>
  )
}
