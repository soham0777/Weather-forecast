"""DEMO AUTHENTICATION: 401 (who are you?) vs 403 (you may not do this)."""

import base64

from tests.conftest import DEMO_ACCOUNT, DEMO_BENEFICIARY, get_token

BALANCE = f"/api/v1/accounts/{DEMO_ACCOUNT}/balance"


def test_token_is_issued_with_scopes(client):
    response = client.post("/api/v1/oauth/token", data={
        "grant_type": "client_credentials", "client_id": "budget-app-demo", "client_secret": "demo-budget-secret",
    })
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "Bearer"
    assert set(body["scope"].split()) == {"accounts:read", "transactions:read"}
    assert body["access_token"].count(".") == 2  # header.payload.signature


def test_token_accepts_http_basic_client_authentication(client):
    credentials = base64.b64encode(b"ndb-mobile-app:demo-mobile-secret").decode()
    response = client.post("/api/v1/oauth/token", data={"grant_type": "client_credentials"},
                           headers={"Authorization": f"Basic {credentials}"})
    assert response.status_code == 200


def test_wrong_client_secret_is_rejected(client):
    response = client.post("/api/v1/oauth/token", data={
        "grant_type": "client_credentials", "client_id": "ndb-mobile-app", "client_secret": "wrong",
    })
    assert response.status_code == 401
    assert response.json()["error"] == "invalid_client"


def test_scope_outside_client_permissions_is_rejected(client):
    response = client.post("/api/v1/oauth/token", data={
        "grant_type": "client_credentials", "client_id": "budget-app-demo",
        "client_secret": "demo-budget-secret", "scope": "payments:write",
    })
    assert response.status_code == 400
    assert response.json()["error"] == "invalid_scope"


def test_missing_token_returns_401(client):
    response = client.get(BALANCE)
    assert response.status_code == 401
    assert response.json()["code"] == "UNAUTHORIZED"
    assert response.headers["WWW-Authenticate"].startswith("Bearer")


def test_tampered_token_returns_401(client):
    token = get_token(client)
    response = client.get(BALANCE, headers={"Authorization": f"Bearer {token[:-2]}xx"})
    assert response.status_code == 401
    assert "signature" in response.json()["detail"]


def test_missing_scope_returns_403(client):
    token = get_token(client, "budget-app-demo", "demo-budget-secret")
    response = client.post(f"/api/v1/accounts/{DEMO_ACCOUNT}/transfers",
                           json={"beneficiaryAccount": DEMO_BENEFICIARY, "amount": "10.00"},
                           headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    assert response.json()["code"] == "INSUFFICIENT_SCOPE"


def test_missing_consent_returns_403(client):
    token = get_token(client, "budget-app-demo", "demo-budget-secret")
    response = client.get(f"/api/v1/accounts/{DEMO_BENEFICIARY}/balance", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403
    assert response.json()["code"] == "CONSENT_REQUIRED"
