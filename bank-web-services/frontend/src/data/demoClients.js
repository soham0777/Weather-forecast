/**
 * DEMO AUTHENTICATION clients.
 *
 * These fictional client credentials match backend/app/utils/security.py.
 * They are intentionally public demo values - never real secrets.
 */
export const DEMO_CLIENTS = [
  {
    id: 'ndb-mobile-app',
    clientSecret: 'demo-mobile-secret',
    name: 'Mobile Banking App',
    description: "The bank's own app. In this demo it is linked to every demo account.",
    scopes: ['accounts:read', 'transactions:read', 'payments:write', 'payments:read'],
    consent: 'All demo accounts',
    icon: 'Smartphone',
  },
  {
    id: 'fintech-partner-demo',
    clientSecret: 'demo-fintech-secret',
    name: 'Fintech Partner',
    description: 'Third-party payments partner. Customer consented to account 1234567890 only.',
    scopes: ['accounts:read', 'payments:write', 'payments:read'],
    consent: '1234567890',
    icon: 'Globe',
  },
  {
    id: 'budget-app-demo',
    clientSecret: 'demo-budget-secret',
    name: 'Budgeting App',
    description: 'Read-only budgeting app. Cannot move money (no payments:write scope).',
    scopes: ['accounts:read', 'transactions:read'],
    consent: '1234567890',
    icon: 'Wallet',
  },
  {
    id: 'anonymous',
    clientSecret: null,
    name: 'No token',
    description: 'Sends the request without an Authorization header - expect 401 Unauthorized.',
    scopes: [],
    consent: '—',
    icon: 'Lock',
  },
]

export const DEMO_ACCOUNT = '1234567890'
export const DEMO_BENEFICIARY = '9876543210'
