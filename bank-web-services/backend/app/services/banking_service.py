"""
Banking Service - the shared core-banking business layer.

This module is the heart of the hybrid architecture::

    Mobile / Fintech ── REST (JSON) ──┐
                                      ├──> banking_service ──> SQLite
    ATM / Branch ───── SOAP (XML) ────┘

Both the REST routers (``app/api``) and the SOAP endpoint (``app/soap``) call
the functions below. Neither interface contains any banking rules of its own;
they only translate between their wire format (JSON or XML) and these plain
Python functions. Errors are raised as ``BankingError`` subclasses, which each
interface converts into its own error style (HTTP status + problem JSON for
REST, a SOAP Fault for SOAP).

All money is handled as ``Decimal`` - never ``float``.
"""

import hashlib
import json
import re
import threading
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Account, IdempotencyRecord, Transaction, Transfer, utcnow

# India Standard Time has no daylight saving, so a fixed offset is exact
# (and avoids needing the tzdata package on Windows).
IST = timezone(timedelta(hours=5, minutes=30), "IST")

TWO_PLACES = Decimal("0.01")
SUPPORTED_CURRENCIES = {"INR"}
SUPPORTED_MODES = {"IMPS", "NEFT", "RTGS", "INTERNAL"}
RTGS_MINIMUM = Decimal("200000.00")  # RTGS is meant for high-value transfers
MAX_TRANSFER_AMOUNT = Decimal("10000000.00")  # demo per-transaction limit (Rs 1 crore)
MAX_STATEMENT_ENTRIES = 100
MAX_REMARKS_LENGTH = 100
ACCOUNT_NUMBER_PATTERN = re.compile(r"^\d{6,18}$")

# SQLite allows only one writer at a time. Serialising all balance-changing
# work through one lock keeps "check balance -> debit" free of race
# conditions. A production core-banking system would instead use row-level
# locks (SELECT ... FOR UPDATE) inside the database transaction.
WRITE_LOCK = threading.RLock()


# ---------------------------------------------------------------------------
# Errors - interface-neutral. REST and SOAP map ``code`` to their own format.
# ---------------------------------------------------------------------------


class BankingError(Exception):
    code = "BANKING_ERROR"

    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class InvalidRequestError(BankingError):
    code = "INVALID_REQUEST"


class AccountNotFoundError(BankingError):
    code = "ACCOUNT_NOT_FOUND"


class BeneficiaryNotFoundError(BankingError):
    code = "BENEFICIARY_NOT_FOUND"


class AccountInactiveError(BankingError):
    code = "ACCOUNT_INACTIVE"


class InvalidAmountError(BankingError):
    code = "INVALID_AMOUNT"


class UnsupportedCurrencyError(BankingError):
    code = "UNSUPPORTED_CURRENCY"


class UnsupportedModeError(BankingError):
    code = "UNSUPPORTED_TRANSFER_MODE"


class SameAccountTransferError(BankingError):
    code = "SAME_ACCOUNT_TRANSFER"


class TransferLimitError(BankingError):
    code = "TRANSFER_LIMIT_VIOLATION"


class InsufficientFundsError(BankingError):
    code = "INSUFFICIENT_FUNDS"


class IdempotencyConflictError(BankingError):
    code = "IDEMPOTENCY_CONFLICT"


class TransferNotFoundError(BankingError):
    code = "TRANSFER_NOT_FOUND"


# ---------------------------------------------------------------------------
# Results - plain data objects, independent of JSON / XML.
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class BalanceInfo:
    account_number: str
    customer_name: str
    account_type: str
    status: str
    currency: str
    available_balance: Decimal
    ledger_balance: Decimal
    as_of: datetime


@dataclass(frozen=True)
class StatementEntry:
    transaction_id: str
    posted_at: datetime
    type: str
    amount: Decimal
    currency: str
    description: str
    balance_after: Decimal
    reference: str | None


@dataclass(frozen=True)
class MiniStatement:
    account_number: str
    currency: str
    available_balance: Decimal
    entries: list[StatementEntry]


@dataclass(frozen=True)
class TransferCommand:
    from_account: str
    to_account: str
    amount: Decimal | str
    currency: str = "INR"
    mode: str = "IMPS"
    remarks: str | None = None
    channel: str = "REST"
    idempotency_key: str | None = None


@dataclass(frozen=True)
class TransferResult:
    transfer_id: str
    status: str
    from_account: str
    to_account: str
    amount: Decimal
    currency: str
    mode: str
    remarks: str | None
    channel: str
    created_at: datetime
    completed_at: datetime | None
    source_balance_after: Decimal | None
    estimated_settlement_at: datetime | None
    replayed: bool = False


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def to_ist(value: datetime | None) -> datetime | None:
    """Convert a naive-UTC database timestamp to an aware IST datetime."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc).astimezone(IST)


def _ist_day_start_utc(day: date) -> datetime:
    start = datetime(day.year, day.month, day.day, tzinfo=IST)
    return start.astimezone(timezone.utc).replace(tzinfo=None)


def parse_amount(raw) -> Decimal:
    """Validate and normalise a money amount (shared by REST and SOAP)."""
    if raw is None or isinstance(raw, bool):
        raise InvalidAmountError("Amount is required.")
    try:
        amount = Decimal(str(raw).strip())
    except (InvalidOperation, ValueError):
        raise InvalidAmountError(f'Amount "{raw}" is not a valid number. Use a string such as "500.00".')
    if not amount.is_finite():
        raise InvalidAmountError("Amount must be a finite number.")
    if amount <= 0:
        raise InvalidAmountError("Amount must be greater than zero.")
    if amount.as_tuple().exponent < -2:
        raise InvalidAmountError("Amount can have at most 2 decimal places (paise).")
    return amount.quantize(TWO_PLACES)


def _check_account_number(account_number: str, label: str = "Account number") -> str:
    account_number = (account_number or "").strip()
    if not ACCOUNT_NUMBER_PATTERN.match(account_number):
        raise InvalidRequestError(f"{label} must contain 6 to 18 digits.")
    return account_number


def _find_account(db: Session, account_number: str) -> Account | None:
    return db.scalar(select(Account).where(Account.account_number == account_number))


def _get_account(db: Session, account_number: str) -> Account:
    account_number = _check_account_number(account_number)
    account = _find_account(db, account_number)
    if account is None:
        raise AccountNotFoundError(f"Account {account_number} does not exist.")
    return account


def _next_number(db: Session, model, start: int) -> int:
    """Sequential business numbers (TXN1001, TRX10001, ...).

    Only ever called while holding ``WRITE_LOCK``, so two requests can never
    be handed the same number.
    """
    highest = db.scalar(select(func.max(model.id))) or 0
    return start + highest + 1


def _post_entry(
    db: Session,
    account: Account,
    txn_type: str,
    amount: Decimal,
    description: str,
    when: datetime,
    reference: str | None = None,
) -> Transaction:
    """Append one ledger entry. The account balance must already be updated."""
    entry = Transaction(
        transaction_id=f"TXN{_next_number(db, Transaction, 1000)}",
        account_id=account.id,
        transaction_type=txn_type,
        amount=amount,
        currency=account.currency,
        description=description[:160],
        balance_after=account.balance,
        reference=reference,
        transaction_date=when,
    )
    db.add(entry)
    db.flush()  # assigns entry.id so the next number is unique
    return entry


def _narration(mode: str, channel: str, transfer_id: str, direction: str, counterparty: str, remarks: str | None) -> str:
    """Bank-statement style narration, e.g. ``IMPS/TRX10001/TO 9876543210/Rent``."""
    label = mode
    if mode == "INTERNAL":
        label = {"SOAP/ATM": "ATM-FT", "SOAP/BRANCH": "BRANCH-FT"}.get(channel, "FT")
    text = f"{label}/{transfer_id}/{direction} {counterparty}"
    return f"{text}/{remarks}" if remarks else text


def _fingerprint(command: TransferCommand) -> str:
    """Hash of the request body - used to detect Idempotency-Key reuse."""
    try:
        amount = str(Decimal(str(command.amount).strip()).normalize())
    except (InvalidOperation, ValueError):
        amount = str(command.amount)
    payload = {
        "from": command.from_account,
        "to": command.to_account,
        "amount": amount,
        "currency": (command.currency or "").upper(),
        "mode": (command.mode or "").upper(),
        "remarks": command.remarks or "",
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def _transfer_result(db: Session, transfer: Transfer, replayed: bool = False) -> TransferResult:
    debit = db.scalar(
        select(Transaction)
        .join(Account)
        .where(Transaction.reference == transfer.transfer_id, Account.account_number == transfer.from_account)
    )
    estimated = None
    if transfer.status == "PENDING":
        estimated = transfer.created_at + timedelta(seconds=settings.neft_settlement_seconds)
    return TransferResult(
        transfer_id=transfer.transfer_id,
        status=transfer.status,
        from_account=transfer.from_account,
        to_account=transfer.to_account,
        amount=transfer.amount,
        currency=transfer.currency,
        mode=transfer.mode,
        remarks=transfer.remarks,
        channel=transfer.channel,
        created_at=to_ist(transfer.created_at),
        completed_at=to_ist(transfer.completed_at),
        source_balance_after=debit.balance_after if debit else None,
        estimated_settlement_at=to_ist(estimated),
        replayed=replayed,
    )


# ---------------------------------------------------------------------------
# Public operations - called by BOTH the REST and the SOAP interfaces.
# ---------------------------------------------------------------------------


def settle_due_transfers(db: Session) -> int:
    """Complete NEFT transfers whose (simulated) settlement batch has run.

    NEFT is a batch system: the sender is debited immediately but the
    beneficiary is credited later. Instead of a background scheduler, the
    simulator settles due transfers lazily whenever data is read.
    """
    cutoff = utcnow() - timedelta(seconds=settings.neft_settlement_seconds)
    due_query = select(Transfer).where(Transfer.status == "PENDING", Transfer.created_at <= cutoff)
    if db.scalar(select(func.count()).select_from(due_query.subquery())) == 0:
        return 0

    with WRITE_LOCK:
        try:
            due = db.scalars(due_query.order_by(Transfer.id)).all()  # re-read inside the lock
            now = utcnow()
            for transfer in due:
                beneficiary = _get_account(db, transfer.to_account)
                beneficiary.balance += transfer.amount
                _post_entry(
                    db,
                    beneficiary,
                    "CREDIT",
                    transfer.amount,
                    _narration(transfer.mode, transfer.channel, transfer.transfer_id, "FROM",
                               transfer.from_account, transfer.remarks),
                    now,
                    reference=transfer.transfer_id,
                )
                transfer.status = "COMPLETED"
                transfer.completed_at = now
            db.commit()
            return len(due)
        except Exception:
            db.rollback()
            raise


def get_balance(db: Session, account_number: str) -> BalanceInfo:
    """Balance enquiry (REST: GET .../balance, SOAP: getBalance)."""
    settle_due_transfers(db)
    account = _get_account(db, account_number)
    return BalanceInfo(
        account_number=account.account_number,
        customer_name=account.customer_name,
        account_type=account.account_type,
        status=account.status,
        currency=account.currency,
        available_balance=account.balance,
        ledger_balance=account.ledger_balance,
        as_of=datetime.now(IST),
    )


def get_mini_statement(
    db: Session,
    account_number: str,
    limit: int = 10,
    from_date: date | None = None,
    to_date: date | None = None,
    txn_type: str | None = None,
) -> MiniStatement:
    """Mini statement (REST: GET .../transactions, SOAP: getMiniStatement)."""
    settle_due_transfers(db)
    account = _get_account(db, account_number)

    if not 1 <= limit <= MAX_STATEMENT_ENTRIES:
        raise InvalidRequestError(f"limit must be between 1 and {MAX_STATEMENT_ENTRIES}.")
    if from_date and to_date and from_date > to_date:
        raise InvalidRequestError("fromDate must be on or before toDate.")
    if txn_type:
        txn_type = txn_type.upper()
        if txn_type not in {"DEBIT", "CREDIT"}:
            raise InvalidRequestError("type must be DEBIT or CREDIT.")

    query = select(Transaction).where(Transaction.account_id == account.id)
    if from_date:
        query = query.where(Transaction.transaction_date >= _ist_day_start_utc(from_date))
    if to_date:
        query = query.where(Transaction.transaction_date < _ist_day_start_utc(to_date + timedelta(days=1)))
    if txn_type:
        query = query.where(Transaction.transaction_type == txn_type)
    query = query.order_by(Transaction.transaction_date.desc(), Transaction.id.desc()).limit(limit)

    entries = [
        StatementEntry(
            transaction_id=t.transaction_id,
            posted_at=to_ist(t.transaction_date),
            type=t.transaction_type,
            amount=t.amount,
            currency=t.currency,
            description=t.description,
            balance_after=t.balance_after,
            reference=t.reference,
        )
        for t in db.scalars(query).all()
    ]
    return MiniStatement(
        account_number=account.account_number,
        currency=account.currency,
        available_balance=account.balance,
        entries=entries,
    )


def transfer_funds(db: Session, command: TransferCommand) -> TransferResult:
    """Fund transfer (REST: POST .../transfers, SOAP: transferFunds).

    Everything below runs inside ONE database transaction: either every step
    is saved (debit, credit, both ledger entries, transfer record, idempotency
    record) or - if anything fails - nothing is.
    """
    with WRITE_LOCK:
        try:
            # 0. Idempotency: a retried request must not move money twice.
            fingerprint = _fingerprint(command)
            if command.idempotency_key:
                record = db.scalar(select(IdempotencyRecord).where(IdempotencyRecord.key == command.idempotency_key))
                if record is not None:
                    if record.request_fingerprint != fingerprint:
                        # Keys are namespaced per interface ("REST:...", "SOAP:..."); show the caller's part.
                        shown_key = command.idempotency_key.split(":", 1)[-1]
                        raise IdempotencyConflictError(
                            f'Idempotency-Key "{shown_key}" was already used with a '
                            "different request body. Use a new key for a new transfer."
                        )
                    original = db.scalar(select(Transfer).where(Transfer.transfer_id == record.transfer_id))
                    return _transfer_result(db, original, replayed=True)

            # 1. Validate the source account.
            source = _get_account(db, command.from_account)
            if source.status != "ACTIVE":
                raise AccountInactiveError(f"Source account {source.account_number} is {source.status}.")

            # 2. Validate the beneficiary.
            to_account = _check_account_number(command.to_account, "Beneficiary account")
            if to_account == source.account_number:
                raise SameAccountTransferError("Source and beneficiary accounts must be different.")
            beneficiary = _find_account(db, to_account)
            if beneficiary is None:
                raise BeneficiaryNotFoundError(f"Beneficiary account {to_account} does not exist.")
            if beneficiary.status != "ACTIVE":
                raise AccountInactiveError(
                    f"Beneficiary account {to_account} is {beneficiary.status} and cannot receive funds."
                )

            # 3. Validate amount, currency, mode and limits.
            amount = parse_amount(command.amount)
            currency = (command.currency or "").upper()
            if currency not in SUPPORTED_CURRENCIES:
                raise UnsupportedCurrencyError(f'Currency "{command.currency}" is not supported. Use INR.')
            mode = (command.mode or "").upper()
            if mode not in SUPPORTED_MODES:
                raise UnsupportedModeError(
                    f'Transfer mode "{command.mode}" is not supported. Use one of {", ".join(sorted(SUPPORTED_MODES))}.'
                )
            if amount > MAX_TRANSFER_AMOUNT:
                raise TransferLimitError(f"Amount exceeds the per-transaction limit of Rs {MAX_TRANSFER_AMOUNT}.")
            if mode == "RTGS" and amount < RTGS_MINIMUM:
                raise TransferLimitError(f"RTGS requires a minimum amount of Rs {RTGS_MINIMUM}. Use IMPS or NEFT.")
            remarks = (command.remarks or "").strip() or None
            if remarks and len(remarks) > MAX_REMARKS_LENGTH:
                raise InvalidRequestError(f"remarks can be at most {MAX_REMARKS_LENGTH} characters.")

            # 4. Check the available balance.
            if source.balance < amount:
                raise InsufficientFundsError(
                    f"Available balance Rs {source.balance} is insufficient for a transfer of Rs {amount}."
                )

            # 5-9. Move the money and record everything.
            now = utcnow()
            transfer_id = f"TRX{_next_number(db, Transfer, 10000)}"
            settles_later = mode == "NEFT"

            source.balance -= amount
            _post_entry(db, source, "DEBIT", amount,
                        _narration(mode, command.channel, transfer_id, "TO", beneficiary.account_number, remarks),
                        now, reference=transfer_id)

            if not settles_later:
                beneficiary.balance += amount
                _post_entry(db, beneficiary, "CREDIT", amount,
                            _narration(mode, command.channel, transfer_id, "FROM", source.account_number, remarks),
                            now, reference=transfer_id)

            transfer = Transfer(
                transfer_id=transfer_id,
                from_account=source.account_number,
                to_account=beneficiary.account_number,
                amount=amount,
                currency=currency,
                mode=mode,
                status="PENDING" if settles_later else "COMPLETED",
                remarks=remarks,
                channel=command.channel,
                created_at=now,
                completed_at=None if settles_later else now,
            )
            db.add(transfer)
            db.flush()

            if command.idempotency_key:
                db.add(IdempotencyRecord(key=command.idempotency_key, request_fingerprint=fingerprint,
                                         transfer_id=transfer_id, created_at=now))

            db.commit()  # 10. all-or-nothing
            return _transfer_result(db, transfer)
        except Exception:
            db.rollback()
            raise


def get_transfer(db: Session, transfer_id: str) -> TransferResult:
    """Transfer status lookup (REST: GET /api/v1/transfers/{id})."""
    settle_due_transfers(db)
    transfer = db.scalar(select(Transfer).where(Transfer.transfer_id == (transfer_id or "").strip().upper()))
    if transfer is None:
        raise TransferNotFoundError(f"Transfer {transfer_id} does not exist.")
    return _transfer_result(db, transfer)


def list_accounts(db: Session) -> list[BalanceInfo]:
    """All demo accounts (used by the simulator's dashboard, not a bank API)."""
    settle_due_transfers(db)
    now = datetime.now(IST)
    return [
        BalanceInfo(
            account_number=a.account_number,
            customer_name=a.customer_name,
            account_type=a.account_type,
            status=a.status,
            currency=a.currency,
            available_balance=a.balance,
            ledger_balance=a.ledger_balance,
            as_of=now,
        )
        for a in db.scalars(select(Account).order_by(Account.id)).all()
    ]
