from datetime import timedelta

import pytest
from sqlalchemy import select, update

from app.database import SessionLocal
from app.models import Transaction, Transfer, utcnow
from tests.conftest import DEMO_ACCOUNT, DEMO_BENEFICIARY, DORMANT_ACCOUNT

TRANSFERS = f"/api/v1/accounts/{DEMO_ACCOUNT}/transfers"


def balance(client, auth, account=DEMO_ACCOUNT) -> str:
    return client.get(f"/api/v1/accounts/{account}/balance", headers=auth).json()["availableBalance"]


def transfer(client, auth, amount="500.00", beneficiary=DEMO_BENEFICIARY, headers=None, **extra):
    body = {"beneficiaryAccount": beneficiary, "amount": amount, "currency": "INR", "mode": "IMPS",
            "remarks": "Demo transfer", **extra}
    return client.post(TRANSFERS, json=body, headers={**auth, **(headers or {})})


def test_transfer_success(client, auth):
    response = transfer(client, auth)
    assert response.status_code == 201
    body = response.json()
    assert body["transferId"] == "TRX10001"
    assert body["status"] == "COMPLETED"
    assert body["amount"] == "500.00"
    assert body["currency"] == "INR"
    assert response.headers["Location"] == "/api/v1/transfers/TRX10001"

    # Balances moved by exactly Rs 500 (Decimal arithmetic, no float drift).
    assert balance(client, auth) == "44730.75"
    assert balance(client, auth, DEMO_BENEFICIARY) == "79000.00"

    # One DEBIT and one CREDIT ledger entry reference the transfer.
    with SessionLocal() as db:
        entries = db.scalars(select(Transaction).where(Transaction.reference == "TRX10001")).all()
    assert sorted(e.transaction_type for e in entries) == ["CREDIT", "DEBIT"]

    # The new resource can be fetched from the Location URL.
    status = client.get(response.headers["Location"], headers=auth)
    assert status.status_code == 200
    assert status.json()["status"] == "COMPLETED"


def test_transfer_shows_up_in_mini_statement(client, auth):
    transfer(client, auth, amount="123.45")
    latest = client.get(f"/api/v1/accounts/{DEMO_ACCOUNT}/transactions?limit=1", headers=auth).json()["transactions"][0]
    assert latest["type"] == "DEBIT"
    assert latest["amount"] == "123.45"
    assert latest["reference"] == "TRX10001"
    assert latest["balanceAfter"] == "45107.30"


def test_transfer_insufficient_balance_returns_422(client, auth):
    response = transfer(client, auth, amount="5000000.00")
    assert response.status_code == 422
    body = response.json()
    assert body["type"] == "https://bank.local/errors/insufficient-funds"
    assert body["title"] == "Insufficient funds"
    assert balance(client, auth) == "45230.75"  # nothing changed


@pytest.mark.parametrize("amount", ["0", "-100.00", "10.555", "abc"])
def test_transfer_invalid_amount_returns_400(client, auth, amount):
    response = transfer(client, auth, amount=amount)
    assert response.status_code == 400
    assert response.json()["code"] == "INVALID_AMOUNT"
    assert balance(client, auth) == "45230.75"


def test_transfer_unknown_beneficiary_returns_422(client, auth):
    response = transfer(client, auth, beneficiary="1111111111")
    assert response.status_code == 422
    assert response.json()["code"] == "BENEFICIARY_NOT_FOUND"


def test_transfer_unknown_source_returns_404(client, auth):
    response = client.post("/api/v1/accounts/0000000000/transfers",
                           json={"beneficiaryAccount": DEMO_BENEFICIARY, "amount": "10.00"}, headers=auth)
    assert response.status_code == 404


def test_transfer_business_rules(client, auth):
    assert transfer(client, auth, beneficiary=DEMO_ACCOUNT).json()["code"] == "SAME_ACCOUNT_TRANSFER"
    dormant = transfer(client, auth, beneficiary=DORMANT_ACCOUNT)
    assert dormant.status_code == 409
    assert dormant.json()["code"] == "ACCOUNT_INACTIVE"
    unsupported = transfer(client, auth, mode="SWIFT")
    assert unsupported.status_code == 400
    assert unsupported.json()["code"] == "UNSUPPORTED_TRANSFER_MODE"
    rtgs = transfer(client, auth, mode="RTGS")
    assert rtgs.status_code == 422
    assert rtgs.json()["code"] == "TRANSFER_LIMIT_VIOLATION"


def test_money_is_exact(client, auth):
    """0.10 + 0.20 must be exactly 0.30 - the classic float trap."""
    transfer(client, auth, amount="0.10")
    transfer(client, auth, amount=0.2)  # a JSON number is accepted and converted safely
    assert balance(client, auth) == "45230.45"


def test_idempotency_replays_original_result(client, auth):
    key = {"Idempotency-Key": "DEMO-TRANSFER-001"}
    first = transfer(client, auth, headers=key)
    second = transfer(client, auth, headers=key)
    assert first.status_code == second.status_code == 201
    assert second.json()["transferId"] == first.json()["transferId"]
    assert second.headers["Idempotent-Replayed"] == "true"
    assert "Idempotent-Replayed" not in first.headers
    assert balance(client, auth) == "44730.75"  # debited once, not twice
    with SessionLocal() as db:
        assert len(db.scalars(select(Transfer)).all()) == 1


def test_idempotency_key_reuse_with_different_body_returns_409(client, auth):
    key = {"Idempotency-Key": "DEMO-TRANSFER-002"}
    assert transfer(client, auth, amount="100.00", headers=key).status_code == 201
    conflict = transfer(client, auth, amount="200.00", headers=key)
    assert conflict.status_code == 409
    assert conflict.json()["code"] == "IDEMPOTENCY_CONFLICT"
    assert "DEMO-TRANSFER-002" in conflict.json()["detail"]
    assert balance(client, auth) == "45130.75"


def test_neft_is_accepted_then_settled(client, auth):
    response = transfer(client, auth, amount="1000.00", mode="NEFT")
    assert response.status_code == 202
    assert response.json()["status"] == "PENDING"
    assert response.json()["estimatedSettlementAt"]
    assert balance(client, auth) == "44230.75"  # sender debited immediately
    assert balance(client, auth, DEMO_BENEFICIARY) == "78500.00"  # beneficiary not yet credited

    # Pretend the NEFT batch window has passed.
    with SessionLocal() as db:
        db.execute(update(Transfer).values(created_at=utcnow() - timedelta(minutes=5)))
        db.commit()

    status = client.get(response.headers["Location"], headers=auth).json()
    assert status["status"] == "COMPLETED"
    assert balance(client, auth, DEMO_BENEFICIARY) == "79500.00"


def test_unknown_transfer_returns_404(client, auth):
    response = client.get("/api/v1/transfers/TRX99999", headers=auth)
    assert response.status_code == 404
    assert response.json()["code"] == "TRANSFER_NOT_FOUND"
