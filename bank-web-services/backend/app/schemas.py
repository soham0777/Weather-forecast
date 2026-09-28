"""
Pydantic schemas - the JSON contract of the REST interface.

Python uses snake_case; the JSON uses camelCase (``available_balance`` ->
``availableBalance``) through an alias generator.

Money is always sent as a *string* ("45230.75"). JSON numbers are binary
floating point in most clients (JavaScript included), which cannot represent
amounts like 0.10 exactly.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


def money(value: Decimal | None) -> str | None:
    return None if value is None else f"{value:.2f}"


# --- Balance -----------------------------------------------------------------

class BalanceResponse(CamelModel):
    account_id: str = Field(examples=["1234567890"])
    currency: str = Field(examples=["INR"])
    available_balance: str = Field(description="Spendable balance", examples=["45230.75"])
    ledger_balance: str = Field(description="Book balance incl. uncleared cheques", examples=["47230.75"])
    as_of: datetime


# --- Mini statement ----------------------------------------------------------

class TransactionItem(CamelModel):
    transaction_id: str = Field(examples=["TXN1001"])
    date: date
    posted_at: datetime
    type: Literal["DEBIT", "CREDIT"]
    amount: str = Field(examples=["1200.00"])
    currency: str = Field(examples=["INR"])
    description: str = Field(examples=["UPI Payment/DEMO MERCHANT"])
    balance_after: str = Field(examples=["45230.75"])
    reference: str | None = Field(default=None, examples=["TRX10001"])


class TransactionListResponse(CamelModel):
    account_id: str
    currency: str
    count: int
    transactions: list[TransactionItem]


# --- Transfers ---------------------------------------------------------------

class TransferRequest(CamelModel):
    beneficiary_account: str = Field(description="Beneficiary account number (6-18 digits)", examples=["9876543210"])
    amount: Decimal | str = Field(
        description="Amount in rupees with at most 2 decimals. Send it as a string - numbers are accepted, "
                    "but floating point should never be used for money.",
        examples=["5000.00"],
    )
    currency: str = Field(default="INR", examples=["INR"], json_schema_extra={"enum": ["INR"]})
    mode: str = Field(
        default="IMPS",
        description="IMPS (instant, 201), NEFT (batch settlement, 202 Accepted), RTGS (min Rs 2,00,000), "
                    "INTERNAL (same-bank transfer)",
        examples=["IMPS"],
        json_schema_extra={"enum": ["IMPS", "NEFT", "RTGS", "INTERNAL"]},
    )
    remarks: str | None = Field(default=None, examples=["Demo transfer"])

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        json_schema_extra={"examples": [{
            "beneficiaryAccount": "9876543210", "amount": "5000.00", "currency": "INR",
            "mode": "IMPS", "remarks": "Demo transfer",
        }]},
    )


class TransferResponse(CamelModel):
    transfer_id: str = Field(examples=["TRX10001"])
    status: Literal["COMPLETED", "PENDING"] = Field(examples=["COMPLETED"])
    source_account: str = Field(examples=["1234567890"])
    beneficiary_account: str = Field(examples=["9876543210"])
    amount: str = Field(examples=["5000.00"])
    currency: str = Field(examples=["INR"])
    mode: str = Field(examples=["IMPS"])
    remarks: str | None = None
    channel: str = Field(examples=["REST/MOBILE"])
    created_at: datetime
    completed_at: datetime | None = None
    estimated_settlement_at: datetime | None = Field(default=None, description="Only for pending NEFT transfers")


# --- Auth (DEMO) ---------------------------------------------------------------

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int
    scope: str
    demo: bool = True


# --- Health ------------------------------------------------------------------

class HealthResponse(CamelModel):
    status: str = Field(examples=["UP"])
    service: str
    version: str
    environment: str
    timestamp: datetime
    components: dict[str, str]
    disclaimer: str


# --- Logs & demo utilities ----------------------------------------------------------

class ApiLogItem(CamelModel):
    id: int
    timestamp: datetime
    interface_type: str
    method: str
    endpoint: str
    status_code: int
    duration_ms: int
    consumer: str | None = None
    request_id: str | None = None
    request_summary: str | None = None
    response_summary: str | None = None


class ApiLogStats(CamelModel):
    total: int
    rest: int
    soap: int
    success: int
    client_errors: int
    server_errors: int
    average_duration_ms: float


class ApiLogList(CamelModel):
    items: list[ApiLogItem]
    stats: ApiLogStats


class DemoAccount(CamelModel):
    account_number: str
    customer_name: str
    account_type: str
    status: str
    currency: str
    available_balance: str
    ledger_balance: str


class OverviewResponse(CamelModel):
    bank_name: str
    disclaimer: str
    rest_apis: int
    soap_operations: int
    demo_accounts: int
    transactions: int
    transfers: int
    api_calls: int
    system_status: str
