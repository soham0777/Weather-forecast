"""
REST endpoint: Balance enquiry.

REST is resource-oriented: the account is a resource identified by a URL,
and the HTTP method (GET) says what to do with it. GET is safe and
idempotent - calling it never changes data.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path
from sqlalchemy.orm import Session

from app.api.deps import ensure_consent, require_scope
from app.api.errors import problem_responses
from app.database import get_db
from app.schemas import BalanceResponse, money
from app.services import banking_service
from app.utils.security import Principal

router = APIRouter(prefix="/api/v1/accounts", tags=["Accounts"])

AccountId = Annotated[str, Path(
    pattern=r"^\d{6,18}$",
    description="Account number (demo accounts: 1234567890, 9876543210)",
    examples=["1234567890"],
)]


@router.get(
    "/{account_id}/balance",
    response_model=BalanceResponse,
    summary="Balance enquiry",
    description="Returns the available and ledger balance of an account. Requires scope `accounts:read`.",
    responses=problem_responses(400, 401, 403, 404, 429, 500, 503, 504),
)
def get_balance(
    account_id: AccountId,
    principal: Annotated[Principal, Depends(require_scope("accounts:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> BalanceResponse:
    ensure_consent(principal, account_id)
    info = banking_service.get_balance(db, account_id)  # shared business logic
    return BalanceResponse(
        account_id=info.account_number,
        currency=info.currency,
        available_balance=money(info.available_balance),
        ledger_balance=money(info.ledger_balance),
        as_of=info.as_of.replace(microsecond=0),
    )
