# Period Tracker (Boyfriend Mode)

A clean, modern period/cycle tracker built so a boyfriend can track his girlfriend’s cycle, moods, and daily notes—plus get “Today” guidance (do/don’t) based on the probable phase.

## Overview

- **Home**: next period estimate, window, confidence, trend insights, reminders toggle
- **Today**: probable phase, likely mood, boyfriend do/don’t guidance, today’s log summary
- **Calendar**: phase-colored calendar, predicted period window highlight, daily logging (past/today only)

## Architecture

### High-level

- **Frontend**: React + Vite (`frontend/`)
- **Backend**: FastAPI + SQLAlchemy (`backend/`)
- **Database**:
  - Local dev default: SQLite (`test.db`)
  - Production recommended: Supabase Postgres (via `DATABASE_URL`)

### Data flow

1. Frontend calls the backend API (Axios).
2. Backend reads/writes cycles and daily logs to DB.
3. Backend computes:
   - **Prediction** (`/predict`)
   - **Patterns/insights** (`/patterns`)
4. Frontend renders results + phase coloring and “Today” guidance.

## Local setup (Windows / PowerShell)

### 1) Backend (FastAPI) on port 8001

From repo root:

```powershell
python -m pip install -r backend\requirements.txt
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8001
```

Backend URL: `http://localhost:8001`

### 2) Frontend (Vite) on port 5173

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Environment variables

### Frontend

The frontend reads the API base URL from:

- `VITE_API_BASE_URL`

If not set, it falls back to `http://localhost:8001`.

### Backend

Backend reads:

- `DATABASE_URL`
  - Local default (in `backend/.env`): `sqlite:///./test.db`
  - Production: Supabase Postgres connection string (include `sslmode=require`)
- `FRONTEND_ORIGINS`
  - Comma-separated allowed origins for CORS
  - Local default: `*`
  - Production example: `https://your-app.vercel.app`

## API summary

Backend exposes:

- `GET /` health message
- `GET /cycles`, `POST /cycles`
- `GET /logs`, `POST /logs`, `PUT /logs` (upsert: one log per day)
- `GET /predict`
- `GET /patterns`
- `GET /phases`

## Deployment (recommended)

### Frontend → Vercel

- Root directory: `frontend`
- Env var: `VITE_API_BASE_URL=https://<your-render-backend>.onrender.com`

### Backend → Render

- Build command:

```bash
pip install -r backend/requirements.txt
```

- Start command:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
```

- Env vars:
  - `DATABASE_URL=postgresql://.../postgres?sslmode=require`
  - `FRONTEND_ORIGINS=https://<your-vercel-app>.vercel.app`

### Database → Supabase Postgres

Create tables (minimum schema) in Supabase SQL Editor:

```sql
create extension if not exists pgcrypto;

create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null,
  cycle_start date not null,
  cycle_end date null,
  cycle_length integer null,
  period_length integer not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cycles_profile_start
  on public.cycles (profile_id, cycle_start);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid null,
  date date not null,
  mood text null,
  symptoms text null,
  flow_intensity text null,
  sleep_hours integer null,
  energy_level integer null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_logs_profile_date
  on public.daily_logs (profile_id, date);

create unique index if not exists uq_daily_logs_profile_date
  on public.daily_logs (profile_id, date);
```

## Notes

- This project currently uses a local `profile_id` stored in browser storage. It’s good for personal use, but if you want real multi-user security, add authentication and enable RLS policies.

