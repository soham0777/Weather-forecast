import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, CircleCheck, MousePointerClick, Network } from 'lucide-react'
import ArchitectureDiagram from '../components/ArchitectureDiagram'
import Icon from '../components/Icon'
import PageHeader from '../components/PageHeader'
import { NODES } from '../data/architecture'

const JOURNEYS = [
  {
    title: 'Mobile app → REST → Banking Service → Database',
    tone: 'indigo',
    steps: [
      ['Mobile App', 'GET /api/v1/accounts/1234567890/balance with Authorization: Bearer <JWT>'],
      ['REST layer', 'Validates the token, rate limit and scope accounts:read; parses the URL'],
      ['Banking Service', 'get_balance("1234567890") applies the business rules'],
      ['Database', 'SELECT from accounts - amounts stored as exact integer paise'],
      ['Response', '200 OK with JSON {"availableBalance": "45230.75", …}'],
    ],
  },
  {
    title: 'ATM switch → SOAP → Banking Service → Database',
    tone: 'violet',
    steps: [
      ['ATM Switch', 'POST /soap with a soap:Envelope and SOAPAction: …/getBalance'],
      ['SOAP layer', 'Parses the XML safely, reads ConsumerInfo header, picks the operation'],
      ['Banking Service', 'The very same get_balance("1234567890") function'],
      ['Database', 'Same SQLite tables, same row'],
      ['Response', '200 OK with <ndb:getBalanceResponse> … <ndb:availableBalance>45230.75</…>'],
    ],
  },
]

const TONES = {
  indigo: { badge: 'bg-indigo-600', border: 'border-indigo-200' },
  violet: { badge: 'bg-violet-600', border: 'border-violet-200' },
}

export default function Architecture() {
  const [selected, setSelected] = useState('rest')
  const node = NODES[selected]

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Network}
        title="Hybrid Architecture"
        subtitle="Four layers. Two interfaces. One banking service. Click any box to see its role and the path its requests take."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="card p-4 sm:p-6" aria-label="Interactive architecture diagram">
          <p className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <MousePointerClick className="h-4 w-4" aria-hidden="true" /> Click a component - its request path is highlighted.
          </p>
          <ArchitectureDiagram selected={selected} onSelect={setSelected} />
          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> REST / JSON path</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> SOAP / XML path</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Shared core</span>
          </div>
        </section>

        <aside className="card p-6" aria-live="polite" aria-label="Component details">
          <div className="flex items-center gap-2">
            <Icon name={node.icon} className="h-6 w-6 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">{node.title}</h2>
          </div>
          <ul className="mt-4 space-y-2.5">
            {node.points.map((point) => (
              <li key={point} className="flex gap-2 text-sm text-slate-700">
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" /> {point}
              </li>
            ))}
          </ul>
          <Link to={node.link.to} className="btn-primary mt-6 w-full">
            {node.link.label} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </aside>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2" aria-label="Request journeys">
        {JOURNEYS.map((journey) => (
          <div key={journey.title} className={`card border-t-4 p-6 ${TONES[journey.tone].border}`}>
            <h2 className="font-semibold text-slate-900">{journey.title}</h2>
            <ol className="mt-4 space-y-3">
              {journey.steps.map(([who, what], i) => (
                <li key={who} className="flex gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${TONES[journey.tone].badge}`}>{i + 1}</span>
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">{who}</p>
                    <p className="font-mono text-xs break-words text-slate-600">{what}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-semibold text-violet-800">Why RETAIN SOAP?</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>ATM switches and branch software already work against the WSDL contract.</li>
            <li>Changing them means re-certifying hardware/vendor integrations - expensive and risky.</li>
            <li>Their needs (strict contract, XML tooling) are already met.</li>
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-semibold text-indigo-800">Why INTRODUCE REST?</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
            <li>Mobile apps and fintech partners expect lightweight JSON over HTTP.</li>
            <li>OAuth 2.0 scopes, rate limits and consent fit external partners.</li>
            <li>Easy to document (OpenAPI), test and adopt - faster partner onboarding.</li>
          </ul>
        </div>
      </section>
    </div>
  )
}
