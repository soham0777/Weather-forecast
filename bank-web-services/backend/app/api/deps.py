"""
Request pipeline shared by every REST business endpoint.

In a real bank these checks usually live in an API gateway in front of the
services. Here they are a FastAPI dependency, executed in this order:

    1. Error simulation  (X-Demo-Simulate header - demo only)
    2. Authentication    -> 401 Unauthorized
    3. Rate limiting     -> 429 Too Many Requests
    4. Authorization     -> 403 Forbidden (missing scope)
    5. (in the endpoint) consent for the specific account -> 403 Forbidden
"""

import asyncio
from typing import Annotated

from fastapi import Header, Request, Response, Security
from fastapi.openapi.models import OAuthFlowClientCredentials, OAuthFlows
from fastapi.security import OAuth2
from fastapi.security.utils import get_authorization_scheme_param

from app.api.errors import ProblemException
from app.utils.rate_limiter import rate_limiter
from app.utils.security import SCOPES, Principal, TokenError, verify_token

TOKEN_URL = "/api/v1/oauth/token"


class DemoClientCredentialsBearer(OAuth2):
    """Declares the OAuth 2.0 client-credentials flow in OpenAPI (so Swagger
    shows an "Authorize" button) and extracts the Bearer token."""

    def __init__(self):
        super().__init__(
            flows=OAuthFlows(clientCredentials=OAuthFlowClientCredentials(tokenUrl=TOKEN_URL, scopes=SCOPES)),
            scheme_name="DemoOAuth2",
            description="DEMO AUTHENTICATION - use client_id `ndb-mobile-app` and client_secret "
                        "`demo-mobile-secret` (fictional demo credentials).",
            auto_error=False,
        )

    async def __call__(self, request: Request) -> str | None:
        scheme, token = get_authorization_scheme_param(request.headers.get("Authorization"))
        if scheme.lower() != "bearer" or not token:
            return None
        return token


oauth2_scheme = DemoClientCredentialsBearer()

SIMULATION_HELP = (
    "DEMO ONLY. Ask the server to simulate an infrastructure failure: "
    "`500` (unexpected error), `503` (core banking unavailable) or `504` (upstream timeout). "
    "The failure is simulated - nothing is actually broken."
)


class SimulatedServerError(RuntimeError):
    """Raised on purpose by the error simulator."""


async def simulate_failure(value: str | None) -> None:
    if not value:
        return
    value = value.strip()
    if value == "500":
        # Raise a genuine unhandled exception so the global error handler is
        # exercised: the client gets a generic 500 without a stack trace.
        raise SimulatedServerError("Simulated unexpected server failure")
    if value == "503":
        raise ProblemException(503, "service-unavailable", "Service unavailable",
                               "The core banking system is temporarily unavailable (simulated maintenance "
                               "window). Retry after the time given in the Retry-After header.",
                               headers={"Retry-After": "30"}, code="SERVICE_UNAVAILABLE", simulated=True)
    if value == "504":
        await asyncio.sleep(1.5)  # the gateway waits for the upstream system ... then gives up
        raise ProblemException(504, "gateway-timeout", "Gateway timeout",
                               "The core banking host did not respond in time (simulated). "
                               "The request may or may not have been processed - check before retrying.",
                               code="GATEWAY_TIMEOUT", simulated=True)
    raise ProblemException(400, "invalid-simulation", "Invalid simulation value",
                           "X-Demo-Simulate accepts only 500, 503 or 504.", code="INVALID_REQUEST")


def _unauthorized(detail: str, error: str = "invalid_token") -> ProblemException:
    return ProblemException(
        401, "unauthorized", "Unauthorized", detail, code="UNAUTHORIZED",
        headers={"WWW-Authenticate": f'Bearer realm="ndb-demo", error="{error}"'},
    )


def require_scope(scope: str):
    """Build a dependency that admits only clients holding ``scope``."""

    async def dependency(
        request: Request,
        response: Response,
        token: Annotated[str | None, Security(oauth2_scheme, scopes=[scope])],
        x_demo_simulate: Annotated[str | None, Header(alias="X-Demo-Simulate", description=SIMULATION_HELP)] = None,
    ) -> Principal:
        await simulate_failure(x_demo_simulate)

        # 1. Authentication
        if not token:
            raise _unauthorized("Missing bearer token. Obtain a DEMO token from POST /api/v1/oauth/token "
                                "and send it as 'Authorization: Bearer <token>'.", error="invalid_request")
        try:
            principal = verify_token(token)
        except TokenError as exc:
            raise _unauthorized(str(exc))
        request.state.consumer = principal.client_name

        # 2. Rate limiting (per client)
        result = rate_limiter.hit(principal.client_id)
        limit_headers = {
            "X-RateLimit-Limit": str(result.limit),
            "X-RateLimit-Remaining": str(result.remaining),
            "X-RateLimit-Window": str(result.window),
        }
        if not result.allowed:
            raise ProblemException(
                429, "rate-limit-exceeded", "Too many requests",
                f"Rate limit of {result.limit} requests per {result.window} seconds exceeded for client "
                f"'{principal.client_id}'. Retry after {result.retry_after} seconds.",
                headers={**limit_headers, "Retry-After": str(result.retry_after)}, code="RATE_LIMITED",
            )
        response.headers.update(limit_headers)

        # 3. Authorization (scope)
        if scope not in principal.scopes:
            raise ProblemException(
                403, "insufficient-scope", "Forbidden",
                f"The access token for '{principal.client_name}' does not include the required scope '{scope}'.",
                headers={"WWW-Authenticate": f'Bearer error="insufficient_scope", scope="{scope}"'},
                code="INSUFFICIENT_SCOPE", requiredScope=scope,
            )
        return principal

    return dependency


def ensure_consent(principal: Principal, account_number: str) -> None:
    """Consent check: third-party clients may only touch consented accounts."""
    if not principal.has_consent(account_number):
        raise ProblemException(
            403, "consent-required", "Forbidden",
            f"'{principal.client_name}' has no customer consent to access account {account_number}.",
            code="CONSENT_REQUIRED",
        )
