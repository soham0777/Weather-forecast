"""
SQLAlchemy ORM models - the simulated core-banking tables.

All money columns use the ``Money`` type (exact integer paise on disk,
``Decimal`` in Python). All timestamps are stored as naive UTC.
"""

from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base, Money


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_number: Mapped[str] = mapped_column(String(18), unique=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(120))
    account_type: Mapped[str] = mapped_column(String(20))  # SAVINGS / CURRENT
    # Available (spendable) balance.
    balance: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"))
    # Cheques deposited but not yet cleared: part of the ledger balance,
    # but not available for spending.
    uncleared_funds: Mapped[Decimal] = mapped_column(Money, default=Decimal("0.00"))
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE")  # ACTIVE / DORMANT / FROZEN
    branch: Mapped[str] = mapped_column(String(80), default="Pune Main Branch (Demo)")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    transactions: Mapped[list["Transaction"]] = relationship(back_populates="account")

    @property
    def ledger_balance(self) -> Decimal:
        return self.balance + self.uncleared_funds


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("accounts.id"), index=True)
    transaction_type: Mapped[str] = mapped_column(String(6))  # DEBIT / CREDIT
    amount: Mapped[Decimal] = mapped_column(Money)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    description: Mapped[str] = mapped_column(String(160))
    balance_after: Mapped[Decimal] = mapped_column(Money)
    # Business reference, e.g. the transfer ID that produced this entry.
    reference: Mapped[str | None] = mapped_column(String(20), nullable=True, index=True)
    transaction_date: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    account: Mapped[Account] = relationship(back_populates="transactions")


class Transfer(Base):
    __tablename__ = "transfers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transfer_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    from_account: Mapped[str] = mapped_column(ForeignKey("accounts.account_number"))
    to_account: Mapped[str] = mapped_column(ForeignKey("accounts.account_number"))
    amount: Mapped[Decimal] = mapped_column(Money)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    mode: Mapped[str] = mapped_column(String(10))  # IMPS / NEFT / RTGS / INTERNAL
    status: Mapped[str] = mapped_column(String(12))  # PENDING / COMPLETED
    remarks: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Which interface initiated the transfer, e.g. "REST", "SOAP/ATM".
    channel: Mapped[str] = mapped_column(String(20), default="REST")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class IdempotencyRecord(Base):
    """Remembers which transfer an ``Idempotency-Key`` produced.

    Stored in the same database transaction as the transfer itself, so a key
    can never point at a transfer that was rolled back.
    """

    __tablename__ = "idempotency_keys"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    request_fingerprint: Mapped[str] = mapped_column(String(64))
    transfer_id: Mapped[str] = mapped_column(ForeignKey("transfers.transfer_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class ApiLog(Base):
    __tablename__ = "api_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    interface_type: Mapped[str] = mapped_column(String(4))  # REST / SOAP
    method: Mapped[str] = mapped_column(String(40))  # HTTP verb (REST) or operation (SOAP)
    endpoint: Mapped[str] = mapped_column(String(255))
    status_code: Mapped[int] = mapped_column(Integer)
    request_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    response_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int] = mapped_column(Integer)
    consumer: Mapped[str | None] = mapped_column(String(60), nullable=True)
    request_id: Mapped[str | None] = mapped_column(String(32), nullable=True)
