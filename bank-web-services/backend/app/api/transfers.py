"""
REST endpoints: Fund transfer and transfer status.

POST creates a new resource (a transfer), so success is ``201 Created`` with
a ``Location`` header pointing at the new resource. NEFT transfers settle in
batches, so they return ``202 Accepted``: the request was accepted, but the
work is not finished yet - poll the Location URL for the final status.

POST is *not* idempotent: sending it twice would normally move money twice.
The ``Idempotency-Key`` header makes retries safe (see banking_service).
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Header, Path, Response
from sqlalchemy.orm import Session

from app.api.accounts import AccountId
from app.api.deps import ensure_consent, require_scope
from app.api.errors import problem_responses
from app.database import get_db
from app.schemas import TransferRequest, TransferResponse, money
from app.services import banking_service
from app.services.banking_service import TransferCommand, TransferResult
from app.utils.security import Principal

router = APIRouter(tags=["Transfers"])


def _to_response(result: TransferResult) -> TransferResponse:
    return TransferResponse(
        transfer_id=result.transfer_id,
        status=result.status,
        source_account=result.from_account,
        beneficiary_account=result.to_account,
        amount=money(result.amount),
        currency=result.currency,
        mode=result.mode,
        remarks=result.remarks,
        channel=result.channel,
        created_at=result.created_at.replace(microsecond=0),
        completed_at=result.completed_at.replace(microsecond=0) if result.completed_at else None,
        estimated_settlement_at=(result.estimated_settlement_at.replace(microsecond=0)
                                 if result.estimated_settlement_at else None),
    )


_TRANSFER_EXAMPLE = {
    "transferId": "TRX10001", "status": "COMPLETED", "sourceAccount": "1234567890",
    "beneficiaryAccount": "9876543210", "amount": "5000.00", "currency": "INR", "mode": "IMPS",
    "remarks": "Demo transfer", "channel": "REST/MOBILE", "createdAt": "2026-09-28T10:15:00+05:30",
    "completedAt": "2026-09-28T10:15:00+05:30", "estimatedSettlementAt": None,
}


@router.post(
    "/api/v1/accounts/{account_id}/transfers",
    response_model=TransferResponse,
    status_code=201,
    summary="Fund transfer (simulated)",
    description=(
        "Moves money between two **demo** accounts inside the simulator - no real payment system is "
        "contacted. Requires scope `payments:write`.\n\n"
        "* `IMPS` / `RTGS` / `INTERNAL` complete immediately -> **201 Created**\n"
        "* `NEFT` is settled in a (simulated) batch -> **202 Accepted**, poll `GET /api/v1/transfers/{id}`\n\n"
        "Send an `Idempotency-Key` header to make retries safe: the same key + same body returns the "
        "original result, the same key + a different body returns **409 Conflict**."
    ),
    responses={
        201: {"description": "Created - transfer completed. `Location` header points to the transfer."},
        202: {"description": "Accepted - NEFT transfer queued for batch settlement.",
              "content": {"application/json": {"example": {**_TRANSFER_EXAMPLE, "mode": "NEFT", "status": "PENDING",
                                                             "completedAt": None,
                                                             "estimatedSettlementAt": "2026-09-28T10:15:20+05:30"}}}},
        **problem_responses(400, 401, 403, 404, 409, 422, 429, 500, 503, 504),
    },
)
def create_transfer(
    account_id: AccountId,
    body: TransferRequest,
    response: Response,
    principal: Annotated[Principal, Depends(require_scope("payments:write"))],
    db: Annotated[Session, Depends(get_db)],
    idempotency_key: Annotated[str | None, Header(
        alias="Idempotency-Key", min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._:\-]+$",
        description="Unique key per logical transfer, e.g. DEMO-TRANSFER-001",
    )] = None,
) -> TransferResponse:
    ensure_consent(principal, account_id)
    result = banking_service.transfer_funds(db, TransferCommand(
        from_account=account_id,
        to_account=body.beneficiary_account,
        amount=body.amount,
        currency=body.currency,
        mode=body.mode,
        remarks=body.remarks,
        channel=f"REST/{principal.consumer_type}",
        idempotency_key=f"REST:{idempotency_key}" if idempotency_key else None,
    ))
    response.status_code = 202 if result.mode == "NEFT" else 201
    response.headers["Location"] = f"/api/v1/transfers/{result.transfer_id}"
    if result.replayed:
        # Same key + same body: this is the ORIGINAL result, no new money moved.
        response.headers["Idempotent-Replayed"] = "true"
    return _to_response(result)


@router.get(
    "/api/v1/transfers/{transfer_id}",
    response_model=TransferResponse,
    summary="Transfer status",
    description="Look up a transfer, e.g. to poll a pending NEFT transfer. Requires scope `payments:read`.",
    responses={200: {"content": {"application/json": {"example": _TRANSFER_EXAMPLE}}},
               **problem_responses(401, 403, 404, 429, 500, 503, 504,
                                   overrides={404: ("transfer-not-found", "Transfer not found",
                                                    "Transfer TRX99999 does not exist.", "TRANSFER_NOT_FOUND")})},
)
def get_transfer(
    transfer_id: Annotated[str, Path(pattern=r"^[A-Za-z0-9]{3,20}$", examples=["TRX10001"])],
    principal: Annotated[Principal, Depends(require_scope("payments:read"))],
    db: Annotated[Session, Depends(get_db)],
) -> TransferResponse:
    result = banking_service.get_transfer(db, transfer_id)
    if not (principal.has_consent(result.from_account) or principal.has_consent(result.to_account)):
        ensure_consent(principal, result.from_account)
    return _to_response(result)
