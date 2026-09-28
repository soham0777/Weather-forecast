"""
REST endpoint: Mini statement / transaction history.

Filtering, paging and sorting of a collection resource are expressed with
query parameters (``?limit=10&type=DEBIT``) rather than new operations.
"""

from datetime import date
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.accounts import AccountId
from app.api.deps import ensure_consent, require_scope
from app.api.errors import problem_responses
from app.database import get_db
from app.schemas import TransactionItem, TransactionListResponse, money
from app.services import banking_service
from app.utils.security import Principal

router = APIRouter(prefix="/api/v1/accounts", tags=["Transactions"])


@router.get(
    "/{account_id}/transactions",
    response_model=TransactionListResponse,
    summary="Mini statement (transaction history)",
    description="Most recent transactions first. Requires scope `transactions:read`.",
    responses=problem_responses(
        400, 401, 403, 404, 429, 500, 503, 504,
        overrides={400: ("validation-error", "Bad request", "query.limit: Input should be less than or equal to 100",
                         "VALIDATION_ERROR")},
    ),
)
def get_transactions(
    account_id: AccountId,
    principal: Annotated[Principal, Depends(require_scope("transactions:read"))],
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100, description="Maximum number of entries (1-100)")] = 10,
    from_date: Annotated[date | None, Query(alias="fromDate", description="Inclusive start date, YYYY-MM-DD")] = None,
    to_date: Annotated[date | None, Query(alias="toDate", description="Inclusive end date, YYYY-MM-DD")] = None,
    txn_type: Annotated[Literal["DEBIT", "CREDIT"] | None, Query(alias="type", description="DEBIT or CREDIT")] = None,
) -> TransactionListResponse:
    ensure_consent(principal, account_id)
    statement = banking_service.get_mini_statement(db, account_id, limit, from_date, to_date, txn_type)
    items = [
        TransactionItem(
            transaction_id=e.transaction_id,
            date=e.posted_at.date(),
            posted_at=e.posted_at,
            type=e.type,
            amount=money(e.amount),
            currency=e.currency,
            description=e.description,
            balance_after=money(e.balance_after),
            reference=e.reference,
        )
        for e in statement.entries
    ]
    return TransactionListResponse(
        account_id=statement.account_number, currency=statement.currency, count=len(items), transactions=items,
    )
