/** SOAP vs REST - comparison rows. Note: SOAP is a protocol, REST is an architectural style. */
export const COMPARISON_ROWS = [
  {
    aspect: 'Nature',
    soap: 'A protocol - a W3C standard with strict rules for the message envelope.',
    rest: 'An architectural style - a set of constraints (resources, uniform interface, statelessness), not a protocol.',
  },
  {
    aspect: 'Message format',
    soap: 'XML only, always wrapped in a soap:Envelope with an optional Header and a Body.',
    rest: 'Any representation; JSON is the usual choice for mobile and web clients.',
  },
  {
    aspect: 'Interface style',
    soap: 'Operation-oriented: call getBalance, transferFunds … all on one URL (/soap).',
    rest: 'Resource-oriented: URLs name things (/accounts/1234567890/balance), HTTP methods say what to do.',
  },
  {
    aspect: 'Contract',
    soap: 'WSDL - a formal, machine-readable contract. Clients are often generated from it.',
    rest: 'Optional, commonly OpenAPI (Swagger). This project generates one automatically.',
  },
  {
    aspect: 'Typical consumers',
    soap: 'ATM switches, branch/teller software, older enterprise systems.',
    rest: 'Mobile apps, web apps, fintech partners, budgeting apps.',
  },
  {
    aspect: 'Transport',
    soap: 'Usually HTTP POST, but also defined over SMTP, JMS and others.',
    rest: 'HTTP, using its methods (GET, POST, PUT, DELETE) and status codes directly.',
  },
  {
    aspect: 'State model',
    soap: 'Can be stateless or stateful (WS-* extensions allow sessions/transactions).',
    rest: 'Stateless: every request carries everything needed (e.g. its Bearer token).',
  },
  {
    aspect: 'Security approach',
    soap: 'WS-Security (message-level signatures/encryption) plus transport security (TLS).',
    rest: 'TLS + OAuth 2.0 access tokens (often JWTs) with scopes; API keys for simpler cases.',
  },
  {
    aspect: 'Caching',
    soap: 'Not cacheable by standard HTTP caches - every call is a POST.',
    rest: 'GET responses can be cached with standard HTTP headers (Cache-Control, ETag).',
  },
  {
    aspect: 'Error reporting',
    soap: 'A SOAP Fault inside the XML body; SOAP 1.1 sends every fault with HTTP 500.',
    rest: 'Meaningful HTTP status codes (400, 404, 422 …) plus a JSON error body.',
  },
  {
    aspect: 'Typical use cases',
    soap: 'Formal B2B integrations, legacy banking channels, strict contracts and WS-* needs.',
    rest: 'Public/partner APIs, mobile back-ends, open banking, lightweight integrations.',
  },
  {
    aspect: 'Complexity',
    soap: 'Heavier: verbose XML, tooling usually required.',
    rest: 'Lighter: readable JSON, testable with a browser or curl.',
  },
  {
    aspect: 'Legacy compatibility',
    soap: 'Excellent - existing ATM and branch integrations already speak it; rewriting them is costly and risky.',
    rest: 'New consumers adopt it easily; old consumers would need to be rebuilt.',
  },
]

export const OPERATION_MAPPING = [
  {
    capability: 'Balance enquiry',
    rest: { method: 'GET', path: '/api/v1/accounts/{id}/balance' },
    soap: 'getBalance',
    service: 'banking_service.get_balance()',
  },
  {
    capability: 'Mini statement',
    rest: { method: 'GET', path: '/api/v1/accounts/{id}/transactions' },
    soap: 'getMiniStatement',
    service: 'banking_service.get_mini_statement()',
  },
  {
    capability: 'Fund transfer',
    rest: { method: 'POST', path: '/api/v1/accounts/{id}/transfers' },
    soap: 'transferFunds',
    service: 'banking_service.transfer_funds()',
  },
]
