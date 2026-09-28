/**
 * HTTP status codes demonstrated by the simulator, with plain-language
 * explanations and a realistic banking example for each.
 */
export const STATUS_CODES = [
  {
    code: 200, title: 'OK', category: 'success',
    meaning: 'The request succeeded and the response body contains the result.',
    example: 'GET /accounts/1234567890/balance returns the current balance.',
    trigger: 'REST Playground → Balance Enquiry → Normal request.',
  },
  {
    code: 201, title: 'Created', category: 'success',
    meaning: 'A new resource was created. The Location header points to it.',
    example: 'POST /accounts/1234567890/transfers with mode IMPS creates transfer TRX10001.',
    trigger: 'REST Playground → Fund Transfer → Normal request (IMPS).',
  },
  {
    code: 202, title: 'Accepted', category: 'success',
    meaning: 'The request was accepted but processing is not finished yet. Poll for the final status.',
    example: 'An NEFT transfer is queued for the next (simulated) settlement batch.',
    trigger: 'REST Playground → Fund Transfer → scenario "NEFT transfer (202)". Then poll Transfer Status.',
  },
  {
    code: 204, title: 'No Content', category: 'success',
    meaning: 'The action succeeded and there is intentionally nothing to return.',
    example: 'DELETE /api/v1/logs clears the API log.',
    trigger: 'API Logs → "Clear logs".',
  },
  {
    code: 400, title: 'Bad Request', category: 'client',
    meaning: 'The request itself is malformed: invalid JSON, a wrong format or an invalid value.',
    example: 'Transfer amount "-100" or "10.555" (more than 2 decimals).',
    trigger: 'Fund Transfer → scenario "Invalid amount (400)".',
  },
  {
    code: 401, title: 'Unauthorized', category: 'client',
    meaning: 'Authentication failed: the access token is missing, invalid, tampered with or expired.',
    example: 'Calling the balance API without an Authorization: Bearer header.',
    trigger: 'Choose the "No token" client, or scenario "Missing token (401)".',
  },
  {
    code: 403, title: 'Forbidden', category: 'client',
    meaning: 'You are authenticated, but not allowed to do this (missing scope or no customer consent).',
    example: 'The Budgeting App (read-only) tries to make a transfer - it lacks payments:write.',
    trigger: 'Fund Transfer → scenario "Missing scope (403)".',
  },
  {
    code: 404, title: 'Not Found', category: 'client',
    meaning: 'The resource named in the URL does not exist.',
    example: 'GET /accounts/0000000000/balance - there is no such account.',
    trigger: 'Balance Enquiry → scenario "Unknown account (404)".',
  },
  {
    code: 409, title: 'Conflict', category: 'client',
    meaning: 'The request conflicts with the current state of the resource.',
    example: 'Reusing Idempotency-Key DEMO-TRANSFER-001 with a different amount, or paying a DORMANT account.',
    trigger: 'Fund Transfer → send, then "Same key, different amount".',
  },
  {
    code: 422, title: 'Unprocessable Entity', category: 'client',
    meaning: 'The request is well-formed but breaks a business rule.',
    example: 'Transferring ₹50,00,000 when the available balance is ₹45,230.75 (insufficient funds).',
    trigger: 'Fund Transfer → scenario "Insufficient balance (422)".',
  },
  {
    code: 429, title: 'Too Many Requests', category: 'client',
    meaning: 'The client exceeded its rate limit. The Retry-After header says how long to wait.',
    example: 'More than 30 requests in 60 seconds from the same API client.',
    trigger: 'REST Playground → "Rate limiting demo" → Send burst.',
  },
  {
    code: 500, title: 'Internal Server Error', category: 'server',
    meaning: 'Something unexpected failed on the server. Details are logged, never shown to the client.',
    example: 'An unhandled exception - the client only gets a generic message and a requestId.',
    trigger: 'Any REST request with "Simulate failure: 500". (SOAP faults also use HTTP 500.)',
  },
  {
    code: 503, title: 'Service Unavailable', category: 'server',
    meaning: 'The service is temporarily unavailable (maintenance, overload). Retry later.',
    example: 'Core banking is in its end-of-day batch window.',
    trigger: 'Any REST request with "Simulate failure: 503".',
  },
  {
    code: 504, title: 'Gateway Timeout', category: 'server',
    meaning: 'A gateway waited for an upstream system that did not answer in time.',
    example: 'The API gateway gave up waiting for the core banking host after a timeout.',
    trigger: 'Any REST request with "Simulate failure: 504" (takes ~1.5 s).',
  },
]

export const STATUS_BY_CODE = Object.fromEntries(STATUS_CODES.map((s) => [s.code, s]))

export function statusCategory(code) {
  if (!code) return 'network'
  if (code < 300) return 'success'
  if (code < 400) return 'redirect'
  if (code < 500) return 'client'
  return 'server'
}
