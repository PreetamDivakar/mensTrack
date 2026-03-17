import os
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_path)

url = os.getenv("DATABASE_URL")
conn = psycopg2.connect(url)
cur = conn.cursor()
cur.execute(
    "select column_name, is_nullable, column_default from information_schema.columns where table_name=%s",
    ("cycles",)
)
print(cur.fetchall())
cur.close()
conn.close()
