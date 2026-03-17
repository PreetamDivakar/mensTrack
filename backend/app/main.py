import os
from typing import List, Optional

from fastapi import FastAPI, Depends, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from . import services, schemas

app = FastAPI()

_origins_raw = os.getenv("FRONTEND_ORIGINS", "*")
ALLOWED_ORIGINS = (
    ["*"]
    if _origins_raw.strip() == "*"
    else [o.strip() for o in _origins_raw.split(",") if o.strip()]
)

# Allow the front-end dev server (and hosted frontend) to call the backend.
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    # On platforms like Render, DB connectivity can temporarily fail at boot (DNS/IPv6 routing/etc).
    # Do not crash the web process before binding the port; instead, best-effort initialize.
    try:
        Base.metadata.create_all(bind=engine)

        # Add any new columns that may not exist yet (useful for evolving schema on hosted DBs).
        with engine.begin() as conn:
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS daily_logs ADD COLUMN IF NOT EXISTS sleep_hours INTEGER;"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS daily_logs ADD COLUMN IF NOT EXISTS energy_level INTEGER;"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS daily_logs ADD COLUMN IF NOT EXISTS flow_intensity TEXT;"
                )
            )
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS daily_logs ADD COLUMN IF NOT EXISTS notes TEXT;"
                )
            )
            # Ensure `mood` is stored as text (not integer) for backwards compatibility.
            conn.execute(
                text(
                    "ALTER TABLE IF EXISTS daily_logs ALTER COLUMN mood TYPE TEXT USING mood::text;"
                )
            )

        db = next(get_db())
        # Seed initial cycle data from the provided dataset on first run.
        services.seed_cycles_from_csv(db)
        # Normalize stored cycles (fix bad cycle_length values) and keep predictions accurate.
        services.normalize_cycles(db)
        # Train or refresh the persisted prediction model based on seeded data.
        services.train_model_from_db(db)
    except Exception as e:
        # Don't prevent the server from starting; endpoints will error until DB connectivity is fixed.
        print(f"[startup] DB initialization skipped: {e}")


@app.get("/")
def root():

    return {"message": "Period Tracker Backend Running"}


@app.get("/cycles", response_model=List[schemas.CycleResponse])
def get_cycles(
    profile_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return services.get_cycles(db, profile_id)


@app.post("/cycles", response_model=schemas.CycleResponse)
def add_cycle(
    data: schemas.CycleCreate,
    db: Session = Depends(get_db),
):
    return services.add_cycle(
        db,
        data.start_date,
        data.period_length,
        profile_id=data.profile_id,
    )


@app.get("/predict", response_model=schemas.PredictionResponse)
def predict_cycle(
    profile_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return services.predict_next_cycle(db, profile_id)


@app.get("/logs", response_model=List[schemas.DailyLogResponse])
def get_logs(
    profile_id: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return services.get_logs(db, profile_id, date, start_date, end_date)


@app.post("/logs", response_model=schemas.DailyLogResponse)
def create_log(
    data: schemas.DailyLogCreate,
    db: Session = Depends(get_db),
):
    return services.add_log(
        db,
        data.date,
        mood=data.mood,
        symptoms=data.symptoms,
        flow_intensity=data.flow_intensity,
        sleep_hours=data.sleep_hours,
        energy_level=data.energy_level,
        notes=data.notes,
        profile_id=data.profile_id,
    )


@app.put("/logs", response_model=schemas.DailyLogResponse)
def update_log(
    data: schemas.DailyLogCreate,
    db: Session = Depends(get_db),
):
    # Same upsert behavior as POST: update if exists, otherwise create.
    return services.add_log(
        db,
        data.date,
        mood=data.mood,
        symptoms=data.symptoms,
        flow_intensity=data.flow_intensity,
        sleep_hours=data.sleep_hours,
        energy_level=data.energy_level,
        notes=data.notes,
        profile_id=data.profile_id,
    )


@app.get("/patterns", response_model=schemas.PatternResponse)
def get_patterns(
    profile_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return services.detect_patterns(db, profile_id)


@app.get("/phases", response_model=List[schemas.DailyPhaseResponse])
def get_phases(
    profile_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    return services.get_daily_phase_data(db, profile_id)


@app.post("/seed")
def seed(profile_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """Seed the database from the built-in cycle dataset."""
    try:
        cycles = services.seed_cycles_from_csv(db, profile_id)
        return {"seeded_cycles": len(cycles)}
    except Exception as e:
        # Surface the error to help diagnose DB/schema issues during deployment.
        raise HTTPException(status_code=500, detail=str(e))
