"""
Fictional demo data for the simulator.

Every name, account number and transaction here is invented. None of it
belongs to a real person, bank or payment system.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal, drop_db, init_db
from app.models import Account, Transaction
from app.services.banking_service import IST, WRITE_LOCK

D = Decimal

# account_number, customer_name, type, available balance, uncleared funds, status, branch
DEMO_ACCOUNTS = [
    ("1234567890", "Aarav Sharma", "SAVINGS", D("45230.75"), D("2000.00"), "ACTIVE", "Pune Main Branch (Demo)"),
    ("9876543210", "Priya Nair", "SAVINGS", D("78500.00"), D("0.00"), "ACTIVE", "Mumbai Fort Branch (Demo)"),
    ("4567891230", "Kaveri Textiles Pvt Ltd", "CURRENT", D("350000.00"), D("0.00"), "ACTIVE", "Surat Ring Road Branch (Demo)"),
    ("1122334455", "Rohan Verma", "SAVINGS", D("1250.00"), D("0.00"), "DORMANT", "Nagpur Civil Lines Branch (Demo)"),
]

# account_number -> [(days_ago, hh:mm IST, type, amount, description)], oldest first.
# Opening balances are derived so the final balance matches DEMO_ACCOUNTS.
DEMO_TRANSACTIONS = {
    "1234567890": [
        (27, "09:05", "CREDIT", D("52000.00"), "NEFT/SALARY/ZENITH INFOTECH (DEMO)"),
        (25, "11:40", "DEBIT", D("15000.00"), "IMPS/RENT/LANDLORD (DEMO)"),
        (22, "19:12", "DEBIT", D("1200.00"), "UPI Payment/DEMO GROCERY MART"),
        (20, "21:03", "DEBIT", D("2500.00"), "ATM WDL/ATM-PUNE-0042"),
        (18, "10:30", "DEBIT", D("899.00"), "BILLPAY/ELECTRICITY BOARD (DEMO)"),
        (15, "16:45", "CREDIT", D("3500.00"), "IMPS/REFUND/ONLINE STORE (DEMO)"),
        (12, "08:20", "DEBIT", D("649.25"), "UPI Payment/MOBILE RECHARGE (DEMO)"),
        (9, "18:55", "DEBIT", D("4999.00"), "POS/ELECTRONICS STORE (DEMO)"),
        (6, "20:15", "DEBIT", D("1850.50"), "UPI Payment/RESTAURANT (DEMO)"),
        (4, "12:00", "CREDIT", D("1250.00"), "CASH DEPOSIT/BRANCH COUNTER"),
        (2, "13:25", "DEBIT", D("1200.00"), "UPI Payment/DEMO MERCHANT"),
        (1, "17:40", "DEBIT", D("500.00"), "ATM WDL/ATM-MUM-0107"),
    ],
    "9876543210": [
        (26, "09:10", "CREDIT", D("85000.00"), "NEFT/SALARY/HORIZON LABS (DEMO)"),
        (21, "10:00", "DEBIT", D("18000.00"), "IMPS/RENT/SOCIETY (DEMO)"),
        (14, "15:30", "DEBIT", D("3200.00"), "BILLPAY/BROADBAND (DEMO)"),
        (8, "11:11", "CREDIT", D("5000.00"), "IMPS/FROM FRIEND (DEMO)"),
        (3, "19:45", "DEBIT", D("2150.40"), "UPI Payment/PHARMACY (DEMO)"),
    ],
    "4567891230": [
        (19, "12:30", "CREDIT", D("240000.00"), "RTGS/CUSTOMER PAYMENT (DEMO)"),
        (10, "14:05", "DEBIT", D("62500.00"), "NEFT/SUPPLIER INVOICE (DEMO)"),
        (5, "16:20", "DEBIT", D("18000.00"), "BILLPAY/GST CHALLAN (DEMO)"),
    ],
    "1122334455": [
        (800, "11:00", "CREDIT", D("1250.00"), "CASH DEPOSIT/BRANCH COUNTER"),
    ],
}


def _timestamp(days_ago: int, hhmm: str) -> datetime:
    """IST wall-clock time ``days_ago`` days back, as naive UTC."""
    hour, minute = (int(part) for part in hhmm.split(":"))
    local = (datetime.now(IST) - timedelta(days=days_ago)).replace(hour=hour, minute=minute, second=0, microsecond=0)
    return local.astimezone(timezone.utc).replace(tzinfo=None)


def seed_demo_data(db: Session) -> dict:
    """Insert demo accounts/transactions that are missing. Safe to re-run."""
    created_accounts: list[Account] = []
    for number, name, acc_type, balance, uncleared, status, branch in DEMO_ACCOUNTS:
        if db.scalar(select(Account).where(Account.account_number == number)):
            continue
        account = Account(
            account_number=number, customer_name=name, account_type=acc_type, balance=balance,
            uncleared_funds=uncleared, currency="INR", status=status, branch=branch,
            created_at=_timestamp(900, "10:00"),
        )
        db.add(account)
        created_accounts.append(account)
    db.flush()

    # Build every new ledger entry, then number them in date order (TXN1001, ...).
    pending: list[tuple[datetime, Account, str, Decimal, str, Decimal]] = []
    for account in created_accounts:
        history = DEMO_TRANSACTIONS.get(account.account_number, [])
        net = sum((amt if kind == "CREDIT" else -amt) for _, _, kind, amt, _ in history)
        running = account.balance - net  # opening balance
        for days_ago, hhmm, kind, amount, description in history:
            running = running + amount if kind == "CREDIT" else running - amount
            pending.append((_timestamp(days_ago, hhmm), account, kind, amount, description, running))

    next_id = (db.scalar(select(func.max(Transaction.id))) or 0) + 1
    for offset, (when, account, kind, amount, description, balance_after) in enumerate(sorted(pending, key=lambda p: p[0])):
        db.add(Transaction(
            transaction_id=f"TXN{1000 + next_id + offset}", account_id=account.id, transaction_type=kind,
            amount=amount, currency="INR", description=description, balance_after=balance_after,
            transaction_date=when,
        ))
    db.commit()
    return {
        "accountsCreated": len(created_accounts),
        "transactionsCreated": len(pending),
        "totalAccounts": db.scalar(select(func.count(Account.id))),
        "totalTransactions": db.scalar(select(func.count(Transaction.id))),
    }


def seed_if_empty() -> None:
    """Called on API start-up so the simulator works even before seed.py is run."""
    init_db()
    with SessionLocal() as db:
        if db.scalar(select(func.count(Account.id))) == 0:
            seed_demo_data(db)


def reset_demo_data() -> dict:
    """Drop every table and recreate the original demo data."""
    with WRITE_LOCK:
        drop_db()
        init_db()
        with SessionLocal() as db:
            return seed_demo_data(db)
