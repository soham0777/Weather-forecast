"""
Consistent JSON errors for the REST interface ("Problem Details", RFC 9457).

Every REST error looks like::

    {
      "type": "https://bank.local/errors/insufficient-funds",
      "title": "Insufficient funds",
      "status": 422,
      "detail": "Available balance ... is insufficient ...",
      "code": "INSUFFICIENT_FUNDS",
      "instance": "/api/v1/accounts/1234567890/transfers",
      "requestId": "3f2a9c1b7d4e"
    }

Stack traces, SQL errors and file paths are never included.

Status-code conventions used by this API:
  400 Bad Request          - the request itself is malformed (bad JSON, bad amount format)
  401 Unauthorized         - no / invalid / expired access token
  403 Forbidden            - valid token, but missing scope or consent
  404 Not Found            - the resource in the URL does not exist
  409 Conflict             - clashes with current state (reused Idempotency-Key, inactive account)
  422 Unprocessable Entity - well-formed, but breaks a business rule (insufficient funds)
  429 Too Many Requests    - rate limit exceeded
  5xx                      - server-side problems (simulated in this demo)
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.services.banking_service import BankingError

logger = logging.getLogger("ndb.errors")

ERROR_BASE_URI = "https://bank.local/errors/"
PROBLEM_JSON = "application/problem+json"

# BankingError.code -> (HTTP status, type slug, title)
BANKING_ERROR_MAP: dict[str, tuple[int, str, str]] = {
    "INVALID_REQUEST": (400, "invalid-request", "Invalid request"),
    "INVALID_AMOUNT": (400, "invalid-amount", "Invalid amount"),
    "UNSUPPORTED_CURRENCY": (400, "unsupported-currency", "Unsupported currency"),
    "UNSUPPORTED_TRANSFER_MODE": (400, "unsupported-transfer-mode", "Unsupported transfer mode"),
    "ACCOUNT_NOT_FOUND": (404, "account-not-found", "Account not found"),
    "TRANSFER_NOT_FOUND": (404, "transfer-not-found", "Transfer not found"),
    "ACCOUNT_INACTIVE": (409, "account-inactive", "Account not active"),
    "IDEMPOTENCY_CONFLICT": (409, "idempotency-conflict", "Idempotency-Key reused with a different request"),
    "BENEFICIARY_NOT_FOUND": (422, "beneficiary-not-found", "Beneficiary not found"),
    "SAME_ACCOUNT_TRANSFER": (422, "same-account-transfer", "Source and beneficiary are the same"),
    "TRANSFER_LIMIT_VIOLATION": (422, "transfer-limit", "Transfer limit violation"),
    "INSUFFICIENT_FUNDS": (422, "insufficient-funds", "Insufficient funds"),
}


class ProblemException(Exception):
    """Raise anywhere in the REST layer to return a problem+json response."""

    def __init__(self, status: int, slug: str, title: str, detail: str,
                 headers: dict[str, str] | None = None, code: str | None = None, **extra):
        self.status = status
        self.slug = slug
        self.title = title
        self.detail = detail
        self.headers = headers or {}
        self.code = code
        self.extra = extra
        super().__init__(detail)


def problem_body(request: Request | None, status: int, slug: str, title: str, detail: str,
                 code: str | None = None, **extra) -> dict:
    body = {
        "type": ERROR_BASE_URI + slug,
        "title": title,
        "status": status,
        "detail": detail,
    }
    if code:
        body["code"] = code
    if request is not None:
        body["instance"] = request.url.path
        request_id = getattr(request.state, "request_id", None)
        if request_id:
            body["requestId"] = request_id
    body.update(extra)
    return body


def problem_response(request: Request | None, status: int, slug: str, title: str, detail: str,
                     headers: dict[str, str] | None = None, code: str | None = None, **extra) -> JSONResponse:
    return JSONResponse(
        problem_body(request, status, slug, title, detail, code, **extra),
        status_code=status,
        headers=headers,
        media_type=PROBLEM_JSON,
    )


def banking_error_to_problem(exc: BankingError) -> ProblemException:
    status, slug, title = BANKING_ERROR_MAP.get(exc.code, (400, "banking-error", "Request could not be processed"))
    return ProblemException(status, slug, title, exc.message, code=exc.code)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ProblemException)
    async def _problem(request: Request, exc: ProblemException):
        return problem_response(request, exc.status, exc.slug, exc.title, exc.detail,
                                headers=exc.headers, code=exc.code, **exc.extra)

    @app.exception_handler(BankingError)
    async def _banking(request: Request, exc: BankingError):
        problem = banking_error_to_problem(exc)
        return problem_response(request, problem.status, problem.slug, problem.title, problem.detail,
                                code=problem.code)

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        # FastAPI's default is 422; this API reserves 422 for business-rule
        # failures and uses 400 for requests that are syntactically invalid.
        errors = []
        for err in exc.errors():
            loc = err.get("loc", ())
            if err.get("type") == "json_invalid":
                position = f" near character {loc[1]}" if len(loc) > 1 else ""
                errors.append({"field": "body", "message": f"Malformed JSON{position}"})
                continue
            errors.append({"field": ".".join(str(part) for part in loc), "message": err.get("msg", "Invalid value")})
        first = errors[0] if errors else {"field": "request", "message": "Invalid request"}
        return problem_response(
            request, 400, "validation-error", "Bad request",
            f"{first['field']}: {first['message']}", code="VALIDATION_ERROR", errors=errors,
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        titles = {404: "Not found", 405: "Method not allowed"}
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed"
        if exc.status_code == 404 and detail == "Not Found":
            detail = f"No endpoint matches {request.method} {request.url.path}."
        return problem_response(request, exc.status_code, f"http-{exc.status_code}",
                                titles.get(exc.status_code, "HTTP error"), detail,
                                headers=getattr(exc, "headers", None))


# ---------------------------------------------------------------------------
# OpenAPI documentation helpers: example error bodies shown in Swagger / ReDoc.
# ---------------------------------------------------------------------------

_EXAMPLES = {
    400: ("invalid-amount", "Invalid amount", "Amount must be greater than zero.", "INVALID_AMOUNT"),
    401: ("unauthorized", "Unauthorized", "Missing bearer token. Obtain a DEMO token from /api/v1/oauth/token.", "UNAUTHORIZED"),
    403: ("insufficient-scope", "Forbidden", "The access token does not include the required scope 'payments:write'.", "INSUFFICIENT_SCOPE"),
    404: ("account-not-found", "Account not found", "Account 0000000000 does not exist.", "ACCOUNT_NOT_FOUND"),
    409: ("idempotency-conflict", "Idempotency-Key reused with a different request",
          'Idempotency-Key "DEMO-TRANSFER-001" was already used with a different request body.', "IDEMPOTENCY_CONFLICT"),
    422: ("insufficient-funds", "Insufficient funds",
          "Available balance is insufficient for this transfer.", "INSUFFICIENT_FUNDS"),
    429: ("rate-limit-exceeded", "Too many requests", "Rate limit of 30 requests per 60 seconds exceeded.", "RATE_LIMITED"),
    500: ("internal-error", "Internal server error",
          "An unexpected error occurred. Quote the requestId when contacting support.", "INTERNAL_ERROR"),
    503: ("service-unavailable", "Service unavailable", "Core banking system is unavailable (simulated).", "SERVICE_UNAVAILABLE"),
    504: ("gateway-timeout", "Gateway timeout", "Core banking host did not respond in time (simulated).", "GATEWAY_TIMEOUT"),
}

_DESCRIPTIONS = {
    400: "Bad Request - malformed input",
    401: "Unauthorized - missing, invalid or expired token",
    403: "Forbidden - token lacks the required scope or consent",
    404: "Not Found - account/transfer does not exist",
    409: "Conflict - clashes with current state",
    422: "Unprocessable Entity - business rule violated",
    429: "Too Many Requests - rate limit exceeded (see Retry-After)",
    500: "Internal Server Error",
    503: "Service Unavailable",
    504: "Gateway Timeout",
}


def problem_responses(*statuses: int, overrides: dict[int, tuple[str, str, str, str]] | None = None) -> dict:
    responses = {}
    for status in statuses:
        slug, title, detail, code = (overrides or {}).get(status, _EXAMPLES[status])
        responses[status] = {
            "description": _DESCRIPTIONS[status],
            "content": {PROBLEM_JSON: {"example": {
                "type": ERROR_BASE_URI + slug, "title": title, "status": status, "detail": detail, "code": code,
            }}},
        }
    return responses
