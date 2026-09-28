/** Nodes, layers and connections of the hybrid SOAP + REST architecture. */

export const LAYERS = [
  { id: 'channel', number: 1, name: 'Channel layer', hint: 'Who calls the bank' },
  { id: 'interface', number: 2, name: 'API / service layer', hint: 'How they call it' },
  { id: 'business', number: 3, name: 'Business layer', hint: 'Shared banking rules' },
  { id: 'data', number: 4, name: 'Data layer', hint: 'Where the money lives' },
]

export const NODES = {
  mobile: {
    layer: 'channel', label: 'Mobile App', icon: 'Smartphone', style: 'rest',
    title: 'Mobile banking app (modern consumer)',
    points: ['Calls REST endpoints with JSON', 'Authenticates with an OAuth 2.0 access token',
      'Needs small, fast payloads over mobile networks', 'Released often - benefits from a simple, evolvable API'],
    link: { to: '/rest', label: 'Try it in the REST Playground' },
  },
  fintech: {
    layer: 'channel', label: 'Fintech Partner', icon: 'Globe', style: 'rest',
    title: 'Fintech / budgeting partners (external consumers)',
    points: ['Third parties integrate through documented REST APIs (OpenAPI)', 'Limited by scopes and customer consent',
      'Rate limited to protect the bank', 'JSON is easy to consume in any language'],
    link: { to: '/rest', label: 'Try the Fintech / Budgeting clients' },
  },
  upi: {
    layer: 'channel', label: 'UPI App', sublabel: 'simulated', icon: 'Zap', style: 'rest',
    title: 'Payment apps (simulated - no real UPI connection)',
    points: ['Represents modern payment apps that expect JSON APIs', 'This simulator does NOT connect to NPCI or real UPI',
      'Uses the same REST transfer endpoint as other consumers'],
    link: { to: '/rest', label: 'Open the REST Playground' },
  },
  atm: {
    layer: 'channel', label: 'ATM Switch', icon: 'CreditCard', style: 'soap',
    title: 'ATM switch (legacy consumer)',
    points: ['Existing integration built years ago against the SOAP WSDL', 'Sends XML envelopes to one endpoint',
      'Rewriting it is costly and risky, so SOAP is retained', 'Retries use a reference number (RRN) for idempotency'],
    link: { to: '/soap', label: 'Send an ATM request in the SOAP Simulator' },
  },
  branch: {
    layer: 'channel', label: 'Branch Software', icon: 'Building2', style: 'soap',
    title: 'Branch / teller software (legacy consumer)',
    points: ['Desktop teller application using generated SOAP client code', 'Relies on the strict WSDL contract',
      'Keeps working unchanged while REST is introduced'],
    link: { to: '/soap', label: 'Send a Branch request in the SOAP Simulator' },
  },
  rest: {
    layer: 'interface', label: 'REST API', sublabel: 'JSON · /api/v1', icon: 'Braces', style: 'rest',
    title: 'REST API (FastAPI)',
    points: ['Resource-oriented URLs: /accounts/{id}/balance', 'HTTP methods: GET reads, POST creates',
      'JSON request and response bodies', 'Meaningful HTTP status codes (200, 201, 404, 422 …)',
      'OpenAPI contract → Swagger UI at /api-docs', 'Use cases: mobile, web, fintech partners, budgeting apps'],
    link: { to: '/rest', label: 'Open the REST Playground' },
  },
  soap: {
    layer: 'interface', label: 'SOAP Service', sublabel: 'XML · /soap', icon: 'FileCode', style: 'soap',
    title: 'SOAP 1.1 service',
    points: ['XML envelopes (soap:Envelope / Header / Body)', 'Operation-oriented: getBalance, getMiniStatement, transferFunds',
      'Formal WSDL contract at /soap?wsdl', 'Errors as SOAP Faults (HTTP 500)',
      'Legacy integration: ATM switch and branch software'],
    link: { to: '/soap', label: 'Open the SOAP Simulator' },
  },
  service: {
    layer: 'business', label: 'Banking Service', sublabel: 'banking_service.py', icon: 'Cpu', style: 'core',
    title: 'Shared banking service (business logic)',
    points: ['One implementation of every banking rule', 'get_balance() · get_mini_statement() · transfer_funds()',
      'Validates accounts, amounts, limits and balances', 'Uses Decimal for money - never float',
      'Runs each transfer in one atomic database transaction', 'Called by BOTH the REST and SOAP interfaces'],
    link: { to: '/comparison', label: 'See both interfaces return the same data' },
  },
  db: {
    layer: 'data', label: 'Core Banking DB', sublabel: 'SQLite (simulated)', icon: 'Database', style: 'core',
    title: 'Core banking data (SQLite simulator)',
    points: ['Tables: accounts, transactions, transfers, api_logs, idempotency_keys',
      'Money stored as integer paise - exact, no rounding drift', 'Fictional demo data only (python seed.py)'],
    link: { to: '/logs', label: 'Watch calls arrive in the API Logs' },
  },
}

export const EDGES = [
  ['mobile', 'rest'], ['fintech', 'rest'], ['upi', 'rest'],
  ['atm', 'soap'], ['branch', 'soap'],
  ['rest', 'service'], ['soap', 'service'],
  ['service', 'db'],
]

/** Every node reachable up- or downstream of `id` - the "path" to highlight. */
export function connectedNodes(id) {
  if (!id) return new Set()
  const result = new Set([id])
  const walk = (current, forward) => {
    EDGES.forEach(([from, to]) => {
      const [a, b] = forward ? [from, to] : [to, from]
      if (a === current && !result.has(b)) {
        result.add(b)
        walk(b, forward)
      }
    })
  }
  walk(id, true)
  walk(id, false)
  return result
}
