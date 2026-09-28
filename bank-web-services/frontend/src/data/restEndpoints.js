/**
 * REST endpoints shown as cards in the REST Playground, plus the
 * error scenarios each one can demonstrate. Scenarios only change the
 * *request* that is sent - the response always comes from the backend.
 */
import { DEMO_ACCOUNT, DEMO_BENEFICIARY } from './demoClients'

export const REST_ENDPOINTS = [
  {
    id: 'balance',
    method: 'GET',
    path: '/api/v1/accounts/{id}/balance',
    title: 'Balance Enquiry',
    description: 'Available and ledger balance of an account.',
    scope: 'accounts:read',
    icon: 'Wallet',
    scenarios: [
      { id: 'normal', label: 'Normal request (200)', expect: 200 },
      { id: 'unknown', label: 'Unknown account (404)', expect: 404, patch: { accountId: '0000000000' },
        explain: 'Account 0000000000 does not exist, so the resource in the URL cannot be found.' },
      { id: 'badformat', label: 'Malformed account number (400)', expect: 400, patch: { accountId: 'ABC123' },
        explain: 'Account numbers must be 6-18 digits; the request is rejected before any lookup.' },
      { id: 'notoken', label: 'Missing token (401)', expect: 401, client: 'anonymous',
        explain: 'No Authorization header is sent, so the API cannot tell who is calling.' },
      { id: 'noconsent', label: 'No customer consent (403)', expect: 403, client: 'budget-app-demo',
        patch: { accountId: DEMO_BENEFICIARY },
        explain: 'The Budgeting App only has consent for 1234567890, not for 9876543210.' },
    ],
  },
  {
    id: 'transactions',
    method: 'GET',
    path: '/api/v1/accounts/{id}/transactions',
    title: 'Mini Statement',
    description: 'Recent transactions, newest first. Filter with limit, fromDate, toDate and type.',
    scope: 'transactions:read',
    icon: 'ScrollText',
    scenarios: [
      { id: 'normal', label: 'Normal request (200)', expect: 200 },
      { id: 'credits', label: 'Only credits (type=CREDIT)', expect: 200, patch: { type: 'CREDIT', limit: '20' } },
      { id: 'badlimit', label: 'Invalid limit (400)', expect: 400, patch: { limit: '500' },
        explain: 'limit must be between 1 and 100.' },
      { id: 'baddates', label: 'fromDate after toDate (400)', expect: 400,
        patch: { fromDate: '2026-09-20', toDate: '2026-09-01' },
        explain: 'The date range is impossible, so the request is invalid.' },
      { id: 'unknown', label: 'Unknown account (404)', expect: 404, patch: { accountId: '0000000000' },
        explain: 'There is no account 0000000000.' },
    ],
  },
  {
    id: 'transfer',
    method: 'POST',
    path: '/api/v1/accounts/{id}/transfers',
    title: 'Fund Transfer',
    description: 'Simulated transfer between two demo accounts. Supports Idempotency-Key.',
    scope: 'payments:write',
    icon: 'ArrowLeftRight',
    scenarios: [
      { id: 'normal', label: 'Normal IMPS transfer (201)', expect: 201 },
      { id: 'neft', label: 'NEFT transfer (202 Accepted)', expect: 202, patch: { mode: 'NEFT' },
        explain: 'NEFT settles in batches: the transfer is accepted now and completed later. Poll Transfer Status.' },
      { id: 'invalid', label: 'Invalid amount (400)', expect: 400, patch: { amount: '-100' },
        explain: 'A transfer amount must be greater than zero.' },
      { id: 'insufficient', label: 'Insufficient balance (422)', expect: 422, patch: { amount: '5000000.00' },
        explain: 'The request is valid, but ₹50,00,000 is more than the available balance - a business rule fails.' },
      { id: 'beneficiary', label: 'Unknown beneficiary (422)', expect: 422, patch: { beneficiary: '1111111111' },
        explain: 'The URL resource exists and the JSON is valid, but the beneficiary account does not exist.' },
      { id: 'dormant', label: 'Dormant beneficiary (409)', expect: 409, patch: { beneficiary: '1122334455' },
        explain: 'Account 1122334455 is DORMANT - its current state conflicts with receiving money.' },
      { id: 'scope', label: 'Missing scope (403)', expect: 403, client: 'budget-app-demo',
        explain: 'The Budgeting App token has no payments:write scope - it is authenticated but not authorised.' },
      { id: 'notoken', label: 'Missing token (401)', expect: 401, client: 'anonymous',
        explain: 'No Authorization header, so the caller is not authenticated.' },
      { id: 'unknown', label: 'Unknown source account (404)', expect: 404, patch: { accountId: '0000000000' },
        explain: 'The source account in the URL does not exist.' },
    ],
  },
  {
    id: 'transferStatus',
    method: 'GET',
    path: '/api/v1/transfers/{transferId}',
    title: 'Transfer Status',
    description: 'Look up a transfer - e.g. poll a pending NEFT transfer until it completes.',
    scope: 'payments:read',
    icon: 'History',
    secondary: true,
    scenarios: [
      { id: 'normal', label: 'Look up transfer (200)', expect: 200 },
      { id: 'unknown', label: 'Unknown transfer (404)', expect: 404, patch: { transferId: 'TRX99999' },
        explain: 'No transfer with that ID exists.' },
    ],
  },
]

export const DEFAULT_FORM = {
  accountId: DEMO_ACCOUNT,
  limit: '10',
  fromDate: '',
  toDate: '',
  type: '',
  beneficiary: DEMO_BENEFICIARY,
  amount: '500.00',
  mode: 'IMPS',
  remarks: 'Demo transfer',
  transferId: 'TRX10001',
}

export const FAILURE_SIMULATIONS = [
  { value: '', label: 'None - real processing' },
  { value: '500', label: '500 Internal Server Error' },
  { value: '503', label: '503 Service Unavailable' },
  { value: '504', label: '504 Gateway Timeout (~1.5 s)' },
]
