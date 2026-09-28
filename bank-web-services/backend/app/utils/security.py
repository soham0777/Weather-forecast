"""
DEMO AUTHENTICATION - OAuth 2.0 client credentials + JWT access tokens.

This is a teaching implementation, not production security:
  * the demo clients and their secrets below are public, fictional values;
  * tokens are signed with HMAC-SHA256 (HS256) using a demo key from config;
  * there is no real customer login, OTP or consent screen.

Concepts it demonstrates:
  Authentication - "who is calling?"      -> a valid, unexpired, correctly signed token
  Authorization  - "what may they do?"    -> scopes such as payments:write
  Consent        - "which accounts?"      -> the token's consent.accounts claim

The JWT is built with the standard library so every step is visible:
base64url(header) + "." + base64url(payload) + "." + base64url(HMAC-SHA256 signature)
"""

import base64
import hashlib
import hmac
import json
import time
import uuid
from dataclasses import dataclass

from app.config import settings

ISSUER = "ndb-demo-auth-server"
AUDIENCE = "ndb-open-banking-api"
ALL_ACCOUNTS = "*"

SCOPES = {
    "accounts:read": "Read account balances",
    "transactions:read": "Read transaction history (mini statement)",
    "payments:write": "Initiate fund transfers",
    "payments:read": "Read the status of fund transfers",
}


@dataclass(frozen=True)
class DemoClient:
    client_id: str
    client_secret: str  # DEMO value, intentionally public
    name: str
    consumer_type: str  # MOBILE / FINTECH / BUDGETING
    scopes: tuple[str, ...]
    consented_accounts: tuple[str, ...]


DEMO_CLIENTS: dict[str, DemoClient] = {
    client.client_id: client
    for client in (
        # The bank's own (first-party) app. In the demo it may act on every demo
        # account so all scenarios can be tried from one place.
        DemoClient("ndb-mobile-app", "demo-mobile-secret", "NDB Mobile Banking App (Demo)", "MOBILE",
                   ("accounts:read", "transactions:read", "payments:write", "payments:read"), (ALL_ACCOUNTS,)),
        # Third-party providers only see the accounts the customer consented to.
        DemoClient("fintech-partner-demo", "demo-fintech-secret", "Demo Fintech Partner", "FINTECH",
                   ("accounts:read", "payments:write", "payments:read"), ("1234567890",)),
        DemoClient("budget-app-demo", "demo-budget-secret", "Demo Budgeting App", "BUDGETING",
                   ("accounts:read", "transactions:read"), ("1234567890",)),
    )
}


class TokenError(Exception):
    """The presented token is missing, malformed, tampered with or expired."""


@dataclass(frozen=True)
class Principal:
    """The authenticated API client behind a request."""

    client_id: str
    client_name: str
    consumer_type: str
    scopes: frozenset[str]
    consented_accounts: frozenset[str]

    def has_consent(self, account_number: str) -> bool:
        return ALL_ACCOUNTS in self.consented_accounts or account_number in self.consented_accounts


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def _sign(signing_input: bytes) -> bytes:
    return hmac.new(settings.demo_jwt_secret.encode(), signing_input, hashlib.sha256).digest()


def authenticate_client(client_id: str | None, client_secret: str | None) -> DemoClient | None:
    client = DEMO_CLIENTS.get(client_id or "")
    if client and hmac.compare_digest(client.client_secret, client_secret or ""):
        return client
    return None


def issue_token(client: DemoClient, scopes: list[str]) -> tuple[str, int]:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "iss": ISSUER,
        "aud": AUDIENCE,
        "sub": client.client_id,
        "client_name": client.name,
        "consumer_type": client.consumer_type,
        "scope": " ".join(scopes),
        "consent": {"accounts": list(client.consented_accounts)},
        "iat": now,
        "exp": now + settings.token_ttl_seconds,
        "jti": uuid.uuid4().hex,
        "demo": True,
    }
    signing_input = (
        _b64url_encode(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + _b64url_encode(json.dumps(payload, separators=(",", ":")).encode())
    )
    token = signing_input + "." + _b64url_encode(_sign(signing_input.encode()))
    return token, settings.token_ttl_seconds


def verify_token(token: str) -> Principal:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64))
        payload = json.loads(_b64url_decode(payload_b64))
        signature = _b64url_decode(signature_b64)
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        raise TokenError("The access token is malformed.")

    if header.get("alg") != "HS256":
        raise TokenError("Unsupported token algorithm.")
    expected = _sign(f"{header_b64}.{payload_b64}".encode())
    if not hmac.compare_digest(expected, signature):
        raise TokenError("The access token signature is invalid (was the token modified?).")
    if payload.get("iss") != ISSUER or payload.get("aud") != AUDIENCE:
        raise TokenError("The access token was not issued for this API.")
    if int(payload.get("exp", 0)) < time.time():
        raise TokenError("The access token has expired. Request a new one.")

    client = DEMO_CLIENTS.get(payload.get("sub", ""))
    if client is None:
        raise TokenError("The access token belongs to an unknown client.")
    return Principal(
        client_id=client.client_id,
        client_name=client.name,
        consumer_type=client.consumer_type,
        scopes=frozenset(str(payload.get("scope", "")).split()),
        consented_accounts=frozenset(payload.get("consent", {}).get("accounts", [])),
    )
