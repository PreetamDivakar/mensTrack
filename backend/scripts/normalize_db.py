"""Normalize stored cycles in the backend database.

This ensures each cycle has:
- cycle_length computed from the previous cycle start
- cycle_end matching cycle_start + period_length - 1

Run via: python backend/scripts/normalize_db.py
"""

import sys
from pathlib import Path

# Ensure backend package is importable
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import SessionLocal
from app import services


def main():
    db = SessionLocal()
    try:
        services.normalize_cycles(db)
        print("Normalized cycles successfully.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
