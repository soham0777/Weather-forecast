"""
Create the SQLite database and load fictional demo data.

    python seed.py          # create tables + insert any missing demo data (safe to re-run)
    python seed.py --reset  # wipe everything and start from the original demo data
"""

import argparse

from app.config import settings
from app.database import SessionLocal, init_db
from app.seed_data import reset_demo_data, seed_demo_data


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed the National Digital Bank demo database.")
    parser.add_argument("--reset", action="store_true", help="drop all data and re-create the demo data")
    args = parser.parse_args()

    print("National Digital Bank - EDUCATIONAL SIMULATOR (demo data only)")
    print(f"Database: {settings.database_url}")

    if args.reset:
        summary = reset_demo_data()
    else:
        init_db()
        with SessionLocal() as db:
            summary = seed_demo_data(db)

    print(f"  accounts created     : {summary['accountsCreated']}")
    print(f"  transactions created : {summary['transactionsCreated']}")
    print(f"  total accounts       : {summary['totalAccounts']}")
    print(f"  total transactions   : {summary['totalTransactions']}")
    print("Done. Demo account: 1234567890  |  Demo beneficiary: 9876543210")


if __name__ == "__main__":
    main()
