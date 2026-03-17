import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Ensure we load the backend/.env file even when running from the repo root.
env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=env_path)

# Use DATABASE_URL from environment; fall back to a local SQLite file for easy local development.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./test.db")

connect_args = {}
if DATABASE_URL.startswith("postgres"):
    # Supabase Postgres requires SSL connections.
    connect_args["sslmode"] = "require"
elif DATABASE_URL.startswith("sqlite"):
    # FastAPI serves requests across threads; SQLite needs this for local dev.
    connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()