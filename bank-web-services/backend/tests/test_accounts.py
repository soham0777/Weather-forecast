from datetime import date, timedelta

from tests.conftest import DEMO_ACCOUNT


def test_balance_success(client, auth):
    response = client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/balance", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert body["accountId"] == DEMO_ACCOUNT
    assert body["currency"] == "INR"
    assert body["availableBalance"] == "45230.75"  # money is a string, never a float
    assert body["ledgerBalance"] == "47230.75"
    assert body["asOf"].endswith("+05:30")
    assert response.headers["X-RateLimit-Limit"]


def test_balance_unknown_account_returns_404(client, auth):
    response = client.get("/api/v1/accounts/0000000000/balance", headers=auth)
    assert response.status_code == 404
    body = response.json()
    assert body["type"] == "https://bank.local/errors/account-not-found"
    assert body["title"] == "Account not found"
    assert body["status"] == 404
    assert "traceback" not in response.text.lower()


def test_balance_malformed_account_number_returns_400(client, auth):
    response = client.get("/api/v1/accounts/ABC/balance", headers=auth)
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"


def test_transactions_retrieval(client, auth):
    response = client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/transactions", headers=auth)
    assert response.status_code == 200
    body = response.json()
    assert body["accountId"] == DEMO_ACCOUNT
    assert body["count"] == 10 == len(body["transactions"])  # default limit
    first = body["transactions"][0]
    assert set(first) >= {"transactionId", "date", "type", "amount", "currency", "description", "balanceAfter"}
    assert first["transactionId"].startswith("TXN")
    posted = [t["postedAt"] for t in body["transactions"]]
    assert posted == sorted(posted, reverse=True)  # newest first
    assert first["balanceAfter"] == "45230.75"  # latest entry matches the current balance


def test_transactions_limit_and_type_filter(client, auth):
    response = client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/transactions?limit=50&type=CREDIT", headers=auth)
    assert response.status_code == 200
    transactions = response.json()["transactions"]
    assert len(transactions) == 3
    assert all(t["type"] == "CREDIT" for t in transactions)

    response = client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/transactions?limit=3", headers=auth)
    assert response.json()["count"] == 3


def test_transactions_date_filter(client, auth):
    since = (date.today() - timedelta(days=7)).isoformat()
    response = client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/transactions?fromDate={since}&limit=100", headers=auth)
    assert response.status_code == 200
    assert all(t["date"] >= since for t in response.json()["transactions"])


def test_transactions_invalid_parameters_return_400(client, auth):
    url = f"/api/v1/accounts/{DEMO_ACCOUNT}/transactions"
    assert client.get(f"{url}?limit=0", headers=auth).status_code == 400
    assert client.get(f"{url}?type=REFUND", headers=auth).status_code == 400
    response = client.get(f"{url}?fromDate=2026-09-10&toDate=2026-09-01", headers=auth)
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_REQUEST"


def test_transactions_unknown_account_returns_404(client, auth):
    assert client.get("/api/v1/accounts/0000000000/transactions", headers=auth).status_code == 404
