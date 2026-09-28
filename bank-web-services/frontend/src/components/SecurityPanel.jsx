import { Fingerprint, Gauge, KeyRound, ListChecks, Repeat, ShieldCheck, Ticket, UserCheck } from 'lucide-react'

const CONCEPTS = [
  {
    icon: Fingerprint, title: 'Authentication', question: 'Who is calling?',
    text: 'Each REST request carries an access token in the Authorization: Bearer header. No or invalid token → 401 Unauthorized.',
    demo: 'Token signature, issuer, audience and expiry are verified on every call.',
  },
  {
    icon: ShieldCheck, title: 'Authorization', question: 'What may they do?',
    text: 'A valid token is not enough - it must also carry the right permission for the operation. Missing permission → 403 Forbidden.',
    demo: 'The Budgeting App can read balances but gets 403 when it tries to transfer money.',
  },
  {
    icon: KeyRound, title: 'OAuth 2.0 (concept)', question: 'How do partners get tokens?',
    text: 'The client credentials grant lets a partner server exchange its client_id/secret for a short-lived token. Mobile apps would normally use Authorization Code + PKCE with a customer login and OTP.',
    demo: 'POST /api/v1/oauth/token issues DEMO tokens for three fictional clients. No real OTPs are used.',
  },
  {
    icon: Ticket, title: 'JWT (concept)', question: 'What is inside a token?',
    text: 'A JSON Web Token = base64url(header).base64url(payload).signature. The signature (HMAC-SHA256 here) makes any modification detectable.',
    demo: 'Open “Show decoded JWT” in the REST Playground to read the claims: sub, scope, consent, exp …',
  },
  {
    icon: ListChecks, title: 'API scopes', question: 'Least privilege',
    text: 'Scopes split permissions into small pieces so each client gets only what it needs.',
    demo: 'accounts:read · transactions:read · payments:write · payments:read',
  },
  {
    icon: Gauge, title: 'Rate limiting', question: 'Protect the bank',
    text: 'Each client may send a limited number of requests per time window. Beyond it → 429 Too Many Requests with Retry-After.',
    demo: 'In-memory sliding window: 30 requests per 60 s per client (configurable).',
  },
  {
    icon: UserCheck, title: 'Consent', question: 'Which accounts?',
    text: 'In open banking, customers explicitly consent to which accounts a third party may access.',
    demo: 'Fintech and Budgeting clients only have consent for 1234567890; other accounts → 403.',
  },
  {
    icon: Repeat, title: 'Idempotency', question: 'Safe retries',
    text: 'Networks fail. If a client retries a POST, the bank must not move money twice. An Idempotency-Key identifies one logical transfer.',
    demo: 'Same key + same body → original result (Idempotent-Replayed: true). Same key + different body → 409. SOAP uses the ATM reference number (RRN).',
  },
]

/** Security concepts demonstrated by the simulator (DEMO AUTHENTICATION - not production security). */
export default function SecurityPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>DEMO AUTHENTICATION.</strong> These mechanisms are simplified for teaching. The demo client secrets are public,
        fictional values - never real secrets. Production banking security also needs TLS everywhere, HSMs, fraud monitoring,
        strong customer authentication and much more.
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CONCEPTS.map(({ icon: IconComponent, title, question, text, demo }) => (
          <article key={title} className="card p-4">
            <div className="flex items-center gap-2">
              <IconComponent className="h-5 w-5 text-indigo-600" aria-hidden="true" />
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <span className="text-xs text-slate-500">— {question}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{text}</p>
            <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600"><span className="font-semibold">In this demo:</span> {demo}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
