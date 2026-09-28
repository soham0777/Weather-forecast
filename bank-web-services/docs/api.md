# REST API Reference

> **EDUCATIONAL SIMULATOR — NOT A REAL BANKING SYSTEM.** All accounts are fictional demo data.
> Demo account **1234567890** · demo beneficiary **9876543210**.

Base URL: `http://localhost:8000` · Interactive docs: [Swagger UI `/api-docs`](http://localhost:8000/api-docs) ·
[ReDoc `/redoc`](http://localhost:8000/redoc) · contract: `/openapi.json`

Conventions:

* JSON bodies use **camelCase**.
* **Money is always a string** with two decimals (`"45230.75"`). Numbers are accepted on input, but floating point
  must never be used for money.
* Timestamps are ISO 8601 in India Standard Time (`2026-09-28T16:07:15+05:30`).
* Every response carries `X-Request-ID` and `X-Process-Time-Ms`.

## 1. DEMO AUTHENTICATION - get a token

OAuth 2.0 **client credentials** grant. The credentials below are public, fictional demo values.

| client_id | client_secret | scopes | consent |
|---|---|---|---|
| `ndb-mobile-app` | `demo-mobile-secret` | `accounts:read transactions:read payments:write payments:read` | all demo accounts |
| `fintech-partner-demo` | `demo-fintech-secret` | `accounts:read payments:write payments:read` | `1234567890` |
| `budget-app-demo` | `demo-budget-secret` | `accounts:read transactions:read` | `1234567890` |

```bash
curl -X POST http://localhost:8000/api/v1/oauth/token \
  -d grant_type=client_credentials -d client_id=ndb-mobile-app -d client_secret=demo-mobile-secret
```

```json
{ "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3Mi...", "token_type": "Bearer",
  "expires_in": 3600, "scope": "accounts:read transactions:read payments:write payments:read", "demo": true }
```

Send it on every call: `Authorization: Bearer <access_token>`. The token is a JWT (HS256); its payload contains
`sub`, `scope`, `consent.accounts`, `iat`, `exp`. In the examples below, `$TOKEN` holds the access token.

## 2. Balance enquiry

`GET /api/v1/accounts/{account_id}/balance` · scope `accounts:read`

```bash
curl http://localhost:8000/api/v1/accounts/1234567890/balance -H "Authorization: Bearer $TOKEN"
```

**200 OK**

```json
{
  "accountId": "1234567890",
  "currency": "INR",
  "availableBalance": "45230.75",
  "ledgerBalance": "47230.75",
  "asOf": "2026-09-28T16:07:15+05:30"
}
```

`ledgerBalance` includes a ₹2,000 cheque that has not cleared yet, so it is not *available*.

Errors: `400` malformed account number · `401` · `403` (no consent) · `404` unknown account · `429` · `5xx` (simulated)

## 3. Mini statement

`GET /api/v1/accounts/{account_id}/transactions` · scope `transactions:read`

| Query parameter | Type | Default | Meaning |
|---|---|---|---|
| `limit` | 1–100 | 10 | maximum number of entries |
| `fromDate` | `YYYY-MM-DD` | – | inclusive start date (IST) |
| `toDate` | `YYYY-MM-DD` | – | inclusive end date (IST) |
| `type` | `DEBIT` / `CREDIT` | – | filter by direction |

```bash
curl "http://localhost:8000/api/v1/accounts/1234567890/transactions?limit=2" -H "Authorization: Bearer $TOKEN"
```

**200 OK** (newest first)

```json
{
  "accountId": "1234567890",
  "currency": "INR",
  "count": 2,
  "transactions": [
    { "transactionId": "TXN1021", "date": "2026-09-27", "postedAt": "2026-09-27T17:40:00+05:30", "type": "DEBIT",
      "amount": "500.00", "currency": "INR", "description": "ATM WDL/ATM-MUM-0107", "balanceAfter": "45230.75",
      "reference": null },
    { "transactionId": "TXN1020", "date": "2026-09-26", "postedAt": "2026-09-26T13:25:00+05:30", "type": "DEBIT",
      "amount": "1200.00", "currency": "INR", "description": "UPI Payment/DEMO MERCHANT", "balanceAfter": "45730.75",
      "reference": null }
  ]
}
```

Errors: `400` (limit out of range, bad date, `fromDate` after `toDate`, unknown type) · `401` · `403` · `404` · `429`

## 4. Fund transfer (simulated)

`POST /api/v1/accounts/{account_id}/transfers` · scope `payments:write` · optional header `Idempotency-Key`

```bash
curl -i -X POST http://localhost:8000/api/v1/accounts/1234567890/transfers \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: DEMO-TRANSFER-001" \
  -d '{"beneficiaryAccount":"9876543210","amount":"5000.00","currency":"INR","mode":"IMPS","remarks":"Demo transfer"}'
```

**201 Created** · `Location: /api/v1/transfers/TRX10001`

```json
{
  "transferId": "TRX10001",
  "status": "COMPLETED",
  "sourceAccount": "1234567890",
  "beneficiaryAccount": "9876543210",
  "amount": "5000.00",
  "currency": "INR",
  "mode": "IMPS",
  "remarks": "Demo transfer",
  "channel": "REST/MOBILE",
  "createdAt": "2026-09-28T16:07:15+05:30",
  "completedAt": "2026-09-28T16:07:15+05:30",
  "estimatedSettlementAt": null
}
```

| Mode | Behaviour | Status code |
|---|---|---|
| `IMPS` (default) | instant | **201 Created**, `COMPLETED` |
| `INTERNAL` | same-bank transfer, instant | **201 Created** |
| `RTGS` | instant, minimum ₹2,00,000 | **201 Created** (or 422 below the minimum) |
| `NEFT` | batch settlement (simulated 20 s) | **202 Accepted**, `PENDING` → poll `Location` |

Validation (in `banking_service.transfer_funds`, identical for SOAP):

| Problem | Status | `code` |
|---|---|---|
| Malformed JSON / missing field | 400 | `VALIDATION_ERROR` |
| Amount ≤ 0, non-numeric, > 2 decimals | 400 | `INVALID_AMOUNT` |
| Currency other than INR | 400 | `UNSUPPORTED_CURRENCY` |
| Mode not IMPS/NEFT/RTGS/INTERNAL | 400 | `UNSUPPORTED_TRANSFER_MODE` |
| Source account unknown | 404 | `ACCOUNT_NOT_FOUND` |
| Source or beneficiary DORMANT | 409 | `ACCOUNT_INACTIVE` |
| Idempotency-Key reused with a different body | 409 | `IDEMPOTENCY_CONFLICT` |
| Beneficiary unknown | 422 | `BENEFICIARY_NOT_FOUND` |
| Source = beneficiary | 422 | `SAME_ACCOUNT_TRANSFER` |
| RTGS below ₹2,00,000 or above ₹1 crore | 422 | `TRANSFER_LIMIT_VIOLATION` |
| Available balance too low | 422 | `INSUFFICIENT_FUNDS` |

### Idempotency

* Same `Idempotency-Key` **and** same body → the **original** response (same `transferId`) with header
  `Idempotent-Replayed: true`. No money moves again.
* Same key, **different** body → `409 Conflict`.
* No key → every POST creates a new transfer.

## 5. Transfer status

`GET /api/v1/transfers/{transfer_id}` · scope `payments:read` → **200** (same body as above) or **404**
`TRANSFER_NOT_FOUND`. Use it to poll a `PENDING` NEFT transfer until it becomes `COMPLETED`.

## 6. Health

| Endpoint | Response |
|---|---|
| `GET /health` | `{"status": "UP"}` |
| `GET /api/v1/health` | status, version, environment, components (`restApi`, `soapService`, `bankingService`, `database`), disclaimer; **503** if the database is down |

## 7. Error format (RFC 9457 problem details)

Content type `application/problem+json`. No stack traces, SQL or file paths are ever included.

```json
{
  "type": "https://bank.local/errors/insufficient-funds",
  "title": "Insufficient funds",
  "status": 422,
  "detail": "Available balance Rs 44730.65 is insufficient for a transfer of Rs 5000000.00.",
  "code": "INSUFFICIENT_FUNDS",
  "instance": "/api/v1/accounts/1234567890/transfers",
  "requestId": "67cd8a599e21"
}
```

Validation errors add `"errors": [{"field": "query.limit", "message": "Input should be less than or equal to 100"}]`.

## 8. Status codes demonstrated

| Code | Where to see it |
|---|---|
| 200 OK | any successful GET |
| 201 Created | IMPS transfer (with `Location`) |
| 202 Accepted | NEFT transfer |
| 204 No Content | `DELETE /api/v1/logs`, `POST /api/v1/demo/rate-limit/reset` |
| 400 Bad Request | invalid amount, bad query parameter, malformed JSON |
| 401 Unauthorized | missing / tampered / expired token |
| 403 Forbidden | missing scope (budgeting app transferring) or no consent |
| 404 Not Found | unknown account or transfer |
| 409 Conflict | idempotency key reuse, dormant account |
| 422 Unprocessable Entity | insufficient funds, unknown beneficiary |
| 429 Too Many Requests | > 30 requests / 60 s per client (`Retry-After`) |
| 500 / 503 / 504 | `X-Demo-Simulate: 500 \| 503 \| 504` (simulated, nothing breaks) |

## 9. Rate limiting

Sliding window per API client (`RATE_LIMIT_REQUESTS` per `RATE_LIMIT_WINDOW_SECONDS`, default 30 / 60 s).
Successful responses carry `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Window`; a `429` adds
`Retry-After` (seconds).

## 10. Error simulation (demo only)

Header `X-Demo-Simulate` on any REST banking endpoint (and on `/soap`):

| Value | Result |
|---|---|
| `500` | a real exception is raised; the global handler returns a generic 500 with only a `requestId` |
| `503` | `503 Service Unavailable` + `Retry-After: 30` (simulated maintenance window) |
| `504` | waits ~1.5 s, then `504 Gateway Timeout` |

## 11. Simulator utilities (not part of a bank API)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/demo/overview` | dashboard statistics |
| `GET /api/v1/demo/accounts` | list the fictional demo accounts |
| `POST /api/v1/demo/reset` | restore the original demo data |
| `POST /api/v1/demo/rate-limit/reset` | clear the rate limiter (204) |
| `GET /api/v1/logs?interface=REST\|SOAP&status=2xx\|4xx\|5xx&limit=100` | recorded API calls + statistics |
| `DELETE /api/v1/logs` | clear the log (204) |

Disable them with `ENABLE_DEMO_ENDPOINTS=false`.
