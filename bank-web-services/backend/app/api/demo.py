"""
Simulator utilities (NOT part of a bank's API).

They let the teaching UI show live numbers on the dashboard and reset the
demo data between classes. Disable them with ENABLE_DEMO_ENDPOINTS=false.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.health import DISCLAIMER
from app.database import get_db
from app.models import Account, ApiLog, Transaction, Transfer
from app.schemas import DemoAccount, OverviewResponse, money
from app.seed_data import reset_demo_data
from app.services import banking_service
from app.utils.rate_limiter import rate_limiter

router = APIRouter(prefix="/api/v1/demo", tags=["Demo utilities"])

REST_BANKING_APIS = 3  # balance, mini statement, fund transfer
SOAP_OPERATIONS = 3  # getBalance, getMiniStatement, transferFunds


@router.get("/overview", response_model=OverviewResponse, summary="Dashboard statistics")
def overview(db: Annotated[Session, Depends(get_db)]) -> OverviewResponse:
    banking_service.settle_due_transfers(db)
    return OverviewResponse(
        bank_name="National Digital Bank",
        disclaimer=DISCLAIMER,
        rest_apis=REST_BANKING_APIS,
        soap_operations=SOAP_OPERATIONS,
        demo_accounts=db.scalar(select(func.count(Account.id))),
        transactions=db.scalar(select(func.count(Transaction.id))),
        transfers=db.scalar(select(func.count(Transfer.id))),
        api_calls=db.scalar(select(func.count(ApiLog.id))),
        system_status="OPERATIONAL",
    )


@router.get("/accounts", response_model=list[DemoAccount], summary="List the fictional demo accounts")
def demo_accounts(db: Annotated[Session, Depends(get_db)]) -> list[DemoAccount]:
    return [
        DemoAccount(
            account_number=a.account_number, customer_name=a.customer_name, account_type=a.account_type,
            status=a.status, currency=a.currency, available_balance=money(a.available_balance),
            ledger_balance=money(a.ledger_balance),
        )
        for a in banking_service.list_accounts(db)
    ]


@router.post("/reset", summary="Restore the original demo data")
def reset() -> dict:
    summary = reset_demo_data()
    rate_limiter.reset()
    return {"message": "Demo data restored to its original state.", **summary}


@router.post("/rate-limit/reset", status_code=204, summary="Clear the in-memory rate limiter")
def reset_rate_limit() -> Response:
    rate_limiter.reset()
    return Response(status_code=204)
