"""Initialize the backend database and seed it with the built-in cycle dataset.

This runs the same seed logic as the API's `/seed` endpoint and also normalizes
cycle lengths so downstream phase prediction works correctly.

Run:
  python backend/scripts/init_db.py
"""

import sys
from pathlib import Path

# Ensure backend package is importable
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import Base, engine, SessionLocal
from app import services


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        services.seed_cycles_from_csv(db)
        services.normalize_cycles(db)
        print("Database initialized and seeded.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
