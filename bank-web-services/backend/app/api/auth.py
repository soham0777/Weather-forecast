"""
DEMO AUTHENTICATION - OAuth 2.0 token endpoint (client credentials grant).

A partner's server sends its client_id / client_secret and receives a short
lived Bearer access token (a JWT) listing the scopes it was granted. Errors
follow the OAuth 2.0 format (RFC 6749 section 5.2), not problem+json.
"""

import base64
from typing import Annotated

from fastapi import APIRouter, Form, Request
from fastapi.responses import JSONResponse

from app.schemas import TokenResponse
from app.utils.security import authenticate_client, issue_token

router = APIRouter(prefix="/api/v1/oauth", tags=["Demo Authentication"])


def _oauth_error(status: int, error: str, description: str) -> JSONResponse:
    headers = {"Cache-Control": "no-store"}
    if status == 401:
        headers["WWW-Authenticate"] = 'Basic realm="ndb-demo"'
    return JSONResponse({"error": error, "error_description": description}, status_code=status, headers=headers)


@router.post(
    "/token",
    response_model=TokenResponse,
    summary="Get a DEMO access token",
    description=(
        "Client credentials grant. Demo clients (fictional credentials):\n\n"
        "| client_id | client_secret | scopes |\n|---|---|---|\n"
        "| `ndb-mobile-app` | `demo-mobile-secret` | all |\n"
        "| `fintech-partner-demo` | `demo-fintech-secret` | accounts:read payments:write payments:read |\n"
        "| `budget-app-demo` | `demo-budget-secret` | accounts:read transactions:read |\n\n"
        "Credentials may be sent in the form body or as HTTP Basic authentication."
    ),
    responses={400: {"description": "invalid_request / invalid_scope / unsupported_grant_type"},
               401: {"description": "invalid_client"}},
)
def token(
    request: Request,
    grant_type: Annotated[str, Form(examples=["client_credentials"])],
    client_id: Annotated[str | None, Form(examples=["ndb-mobile-app"])] = None,
    client_secret: Annotated[str | None, Form(examples=["demo-mobile-secret"])] = None,
    scope: Annotated[str | None, Form(description="Space-separated scopes (optional)")] = None,
):
    if grant_type != "client_credentials":
        return _oauth_error(400, "unsupported_grant_type", "Only the client_credentials grant is supported.")

    # Swagger UI may send the credentials as HTTP Basic authentication instead.
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("basic "):
        try:
            client_id, _, client_secret = base64.b64decode(auth[6:]).decode().partition(":")
        except (ValueError, UnicodeDecodeError):
            return _oauth_error(400, "invalid_request", "Malformed Basic authorization header.")

    client = authenticate_client(client_id, client_secret)
    if client is None:
        return _oauth_error(401, "invalid_client", "Unknown client_id or wrong client_secret.")

    requested = scope.split() if scope else list(client.scopes)
    not_allowed = [s for s in requested if s not in client.scopes]
    if not_allowed:
        return _oauth_error(400, "invalid_scope", f"Client may not request: {' '.join(not_allowed)}")

    access_token, expires_in = issue_token(client, requested)
    return JSONResponse(
        TokenResponse(access_token=access_token, expires_in=expires_in, scope=" ".join(requested)).model_dump(),
        headers={"Cache-Control": "no-store"},
    )
