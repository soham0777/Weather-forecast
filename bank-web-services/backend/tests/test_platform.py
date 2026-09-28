"""Cross-cutting behaviour: rate limiting, error simulation, logs, CORS, demo utilities."""

from app.utils.rate_limiter import rate_limiter
from tests.conftest import DEMO_ACCOUNT

BALANCE = f"/api/v1/accounts/{DEMO_ACCOUNT}/balance"


def test_rate_limit_returns_429_with_retry_after(client, auth, monkeypatch):
    monkeypatch.setattr(rate_limiter, "limit", 3)
    statuses = [client.get(BALANCE, headers=auth).status_code for _ in range(4)]
    assert statuses == [200, 200, 200, 429]
    limited = client.get(BALANCE, headers=auth)
    assert limited.status_code == 429
    assert int(limited.headers["Retry-After"]) > 0
    assert limited.json()["code"] == "RATE_LIMITED"

    assert client.post("/api/v1/demo/rate-limit/reset").status_code == 204
    assert client.get(BALANCE, headers=auth).status_code == 200


def test_simulated_500_hides_internal_details(client, auth):
    response = client.get(BALANCE, headers={**auth, "X-Demo-Simulate": "500"})
    assert response.status_code == 500
    body = response.json()
    assert body["title"] == "Internal server error"
    assert body["requestId"] == response.headers["X-Request-ID"]
    for secret in ("Traceback", "SimulatedServerError", ".py", "sqlite"):
        assert secret not in response.text


def test_simulated_503_and_504(client, auth):
    unavailable = client.get(BALANCE, headers={**auth, "X-Demo-Simulate": "503"})
    assert unavailable.status_code == 503
    assert unavailable.headers["Retry-After"] == "30"
    timeout = client.get(BALANCE, headers={**auth, "X-Demo-Simulate": "504"})
    assert timeout.status_code == 504
    assert client.get(BALANCE, headers={**auth, "X-Demo-Simulate": "418"}).status_code == 400
    # The application is not actually broken:
    assert client.get(BALANCE, headers=auth).status_code == 200


def test_api_calls_are_logged(client, auth):
    client.delete("/api/v1/logs")
    client.get(BALANCE, headers=auth)
    client.get("/api/v1/accounts/0000000000/balance", headers=auth)
    logs = client.get("/api/v1/logs?interface=REST").json()
    assert logs["stats"]["total"] == 2
    latest, earlier = logs["items"][0], logs["items"][1]
    assert (latest["statusCode"], earlier["statusCode"]) == (404, 200)
    assert earlier["method"] == "GET"
    assert earlier["endpoint"] == BALANCE
    assert earlier["consumer"] == "NDB Mobile Banking App (Demo)"
    assert '"availableBalance"' in earlier["responseSummary"]
    assert client.get("/api/v1/logs?status=4xx").json()["items"][0]["statusCode"] == 404


def test_clear_logs_returns_204(client, auth):
    client.get(BALANCE, headers=auth)
    response = client.delete("/api/v1/logs")
    assert response.status_code == 204
    assert response.content == b""
    assert client.get("/api/v1/logs").json()["stats"]["total"] == 0


def test_cors_allows_only_configured_origin(client):
    preflight = {"Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization"}
    allowed = client.options(BALANCE, headers={"Origin": "http://localhost:5173", **preflight})
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options(BALANCE, headers={"Origin": "http://evil.example", **preflight})
    assert "access-control-allow-origin" not in denied.headers


def test_demo_overview_and_reset(client, auth):
    overview = client.get("/api/v1/demo/overview").json()
    assert overview["restApis"] == 3
    assert overview["soapOperations"] == 3
    assert overview["demoAccounts"] >= 2
    assert overview["transactions"] >= 10

    client.post(f"/api/v1/accounts/{DEMO_ACCOUNT}/transfers",
                json={"beneficiaryAccount": "9876543210", "amount": "1.00"}, headers=auth)
    reset = client.post("/api/v1/demo/reset")
    assert reset.status_code == 200
    accounts = {a["accountNumber"]: a for a in client.get("/api/v1/demo/accounts").json()}
    assert accounts[DEMO_ACCOUNT]["availableBalance"] == "45230.75"
