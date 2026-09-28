"""
Database engine, session factory and the ``Money`` column type.

SQLite is used as the simulated "core banking" database. It is a single file
(``backend/bank.db``) that students can open with any SQLite browser.
"""

from collections.abc import Iterator
from decimal import ROUND_HALF_EVEN, Decimal

from sqlalchemy import BigInteger, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.types import TypeDecorator

from app.config import settings

TWO_PLACES = Decimal("0.01")


class Money(TypeDecorator):
    """Stores money exactly, as an integer number of paise.

    Why not FLOAT or NUMERIC?
      * float cannot represent 0.10 exactly, so balances slowly drift.
      * SQLite's NUMERIC affinity silently converts "45230.75" into a REAL
        (a float) on disk.

    Banks store amounts in minor units (paise for INR). Python code only ever
    sees ``Decimal`` values; the conversion happens here, in one place.
    """

    impl = BigInteger
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if not isinstance(value, Decimal):
            value = Decimal(str(value))
        paise = (value * 100).quantize(Decimal("1"), rounding=ROUND_HALF_EVEN)
        return int(paise)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return (Decimal(int(value)) / 100).quantize(TWO_PLACES)


class Base(DeclarativeBase):
    pass


_is_sqlite = settings.database_url.startswith("sqlite")

engine = create_engine(
    settings.database_url,
    # FastAPI runs sync endpoints in a thread pool, so one connection may be
    # used by different threads over its lifetime.
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)

if _is_sqlite:

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_connection, _record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create all tables (no-op for tables that already exist)."""
    from app import models  # noqa: F401  (registers the models on Base)

    Base.metadata.create_all(bind=engine)


def drop_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.drop_all(bind=engine)
