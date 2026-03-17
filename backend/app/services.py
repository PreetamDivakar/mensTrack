import csv
from datetime import datetime, timedelta
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session

from . import models
from .predictor import invalidate_model, predict_cycle_length, train_model


def _get_profile_filter(query, profile_id):
    # Treat the default profile as no filtering (shared data) since the underlying
    # DB column is a UUID and cannot store a placeholder string.
    if profile_id and profile_id != "default":
        return query.filter(models.Cycle.profile_id == profile_id)
    return query


def _is_irregular(cycle_length):
    return cycle_length is None or cycle_length < 20 or cycle_length > 45


def _confidence_from_lengths(lengths):
    if not lengths:
        return 0.0

    n = len(lengths)
    std = pd.Series(lengths).std(ddof=0)
    score = 1 - (std / 12)
    score = max(0.2, min(1.0, score))
    score *= min(1.0, n / 10)
    return round(score, 2)


def get_cycles(db: Session, profile_id: str | None = None):
    query = db.query(models.Cycle).order_by(models.Cycle.cycle_start)
    query = _get_profile_filter(query, profile_id)
    return query.all()


def _get_logs_query(db: Session, profile_id: str | None = None):
    query = db.query(models.DailyLog).order_by(models.DailyLog.date)
    if profile_id and profile_id != "default":
        query = query.filter(models.DailyLog.profile_id == profile_id)
    return query


def get_logs(
    db: Session,
    profile_id: str | None = None,
    date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    query = _get_logs_query(db, profile_id)

    if date:
        query = query.filter(models.DailyLog.date == datetime.fromisoformat(date).date())
    if start_date:
        query = query.filter(models.DailyLog.date >= datetime.fromisoformat(start_date).date())
    if end_date:
        query = query.filter(models.DailyLog.date <= datetime.fromisoformat(end_date).date())

    return query.all()


def add_log(
    db: Session,
    date,
    mood=None,
    symptoms=None,
    flow_intensity=None,
    sleep_hours=None,
    energy_level=None,
    notes=None,
    profile_id: str | None = None,
):
    # Upsert: one log per (profile_id, date). This prevents duplicates and lets the UI "edit" by saving again.
    query = db.query(models.DailyLog).filter(models.DailyLog.date == date)
    if profile_id and profile_id != "default":
        query = query.filter(models.DailyLog.profile_id == profile_id)
    else:
        query = query.filter(models.DailyLog.profile_id.is_(None))

    log = query.first()
    if log:
        log.mood = mood
        log.symptoms = symptoms
        log.flow_intensity = flow_intensity
        log.sleep_hours = sleep_hours
        log.energy_level = energy_level
        log.notes = notes
    else:
        log = models.DailyLog(
            profile_id=profile_id if profile_id != "default" else None,
            date=date,
            mood=mood,
            symptoms=symptoms,
            flow_intensity=flow_intensity,
            sleep_hours=sleep_hours,
            energy_level=energy_level,
            notes=notes,
        )
        db.add(log)

    db.commit()
    db.refresh(log)

    log_activity(db, profile_id, "daily_log", f"date={date} mood={mood} flow={flow_intensity}")
    return log


def _parse_symptoms(symptoms_raw: str | None):
    if not symptoms_raw:
        return []
    parts = [s.strip().lower() for s in symptoms_raw.split(",") if s.strip()]
    return parts


def detect_patterns(db: Session, profile_id: str | None = None):
    cycles = get_cycles(db, profile_id)
    logs = get_logs(db, profile_id)

    # Determine cycle length trend.
    cycle_lengths = [c.cycle_length for c in cycles if c.cycle_length is not None]
    trend = "not enough data"
    if len(cycle_lengths) >= 3:
        recent = cycle_lengths[-3:]
        if recent[-1] > recent[0] + 1:
            trend = "lengthening"
        elif recent[-1] < recent[0] - 1:
            trend = "shortening"
        else:
            trend = "stable"

    # Detect recurring symptoms in the 3 days before period start.
    symptom_counts = {}
    cycle_starts = [c.cycle_start for c in cycles]

    for start in cycle_starts:
        window_start = start - timedelta(days=3)
        window_end = start - timedelta(days=1)
        for log in logs:
            if window_start <= log.date <= window_end:
                for symptom in _parse_symptoms(log.symptoms):
                    symptom_counts[symptom] = symptom_counts.get(symptom, 0) + 1

    recurring_symptoms = []
    if cycles:
        threshold = max(1, len(cycle_starts) // 2)
        recurring_symptoms = [s for s, count in symptom_counts.items() if count >= threshold]

    # Upcoming events (based on prediction)
    prediction = predict_next_cycle(db, profile_id)
    upcoming_period_days = None
    upcoming_ovulation_days = None

    if isinstance(prediction, dict) and prediction.get("next_period_estimate"):
        next_period = datetime.fromisoformat(prediction["next_period_estimate"]).date()
        upcoming_period_days = (next_period - datetime.utcnow().date()).days
        predicted_length = prediction.get("predicted_cycle_length")
        if predicted_length and cycles:
            last_start = cycles[-1].cycle_start
            ovulation_day = last_start + timedelta(days=int(predicted_length) - 14)
            upcoming_ovulation_days = (ovulation_day - datetime.utcnow().date()).days

    return {
        "recurring_symptoms": recurring_symptoms,
        "cycle_trend": trend,
        "upcoming_period_days": upcoming_period_days,
        "upcoming_ovulation_days": upcoming_ovulation_days,
        "confidence": prediction.get("confidence", 0.0) if isinstance(prediction, dict) else 0.0,
        "irregular": prediction.get("irregular", True) if isinstance(prediction, dict) else True,
    }


def add_cycle(db: Session, start_date, period_length, profile_id: str | None = None):
    cycles = get_cycles(db, profile_id)

    # Compute cycle_length using the most recent previous cycle start (if any).
    previous_cycle = None
    for c in cycles:
        if c.cycle_start < start_date and (previous_cycle is None or c.cycle_start > previous_cycle.cycle_start):
            previous_cycle = c

    cycle_length = None
    if previous_cycle is not None:
        cycle_length = (start_date - previous_cycle.cycle_start).days

    cycle_end = start_date + timedelta(days=period_length - 1)

    new_cycle = models.Cycle(
        profile_id=profile_id,
        cycle_start=start_date,
        cycle_end=cycle_end,
        cycle_length=cycle_length,
        period_length=period_length,
    )

    db.add(new_cycle)
    db.commit()
    db.refresh(new_cycle)

    log_activity(db, profile_id, "cycle_added", f"start={start_date} length={period_length}")

    # Retrain the persisted prediction model when a new cycle is logged.
    # This keeps prediction fast (no model computation on every request).
    cycle_lengths = [
        c.cycle_length
        for c in cycles
        if c.cycle_length is not None and 14 <= c.cycle_length <= 50
    ]
    if cycle_lengths:
        train_model(cycle_lengths)

    return new_cycle


def normalize_cycles(db: Session, profile_id: str | None = None):
    """Normalize stored cycle_length and cycle_end values based on the sequence of cycle starts."""
    cycles = get_cycles(db, profile_id)

    prev_start = None
    updated = False
    for cycle in cycles:
        # Calculate correct cycle_length based on the previous cycle start.
        if prev_start is not None:
            correct_length = (cycle.cycle_start - prev_start).days
            if cycle.cycle_length != correct_length:
                cycle.cycle_length = correct_length
                updated = True
        else:
            if cycle.cycle_length is not None:
                cycle.cycle_length = None
                updated = True

        # Ensure cycle_end matches period_length.
        if cycle.period_length is not None:
            expected_end = cycle.cycle_start + timedelta(days=cycle.period_length - 1)
            if cycle.cycle_end != expected_end:
                cycle.cycle_end = expected_end
                updated = True

        prev_start = cycle.cycle_start

    if updated:
        db.commit()


def predict_next_cycle(db: Session, profile_id: str | None = None):
    cycles = get_cycles(db, profile_id)

    default_response = {
        "predicted_cycle_length": 0.0,
        "next_period_estimate": "",
        "prediction_window_start": "",
        "prediction_window_end": "",
        "confidence": 0.0,
        "irregular": True,
    }

    if not cycles:
        return default_response

    cycle_lengths = [
        c.cycle_length
        for c in cycles
        if c.cycle_length is not None and 14 <= c.cycle_length <= 50
    ]

    # If no valid lengths, fall back to last recorded cycle length.
    if not cycle_lengths and cycles[-1].cycle_length:
        cycle_lengths = [cycles[-1].cycle_length]

    if not cycle_lengths:
        return default_response

    predicted_length = predict_cycle_length(cycle_lengths)
    if predicted_length is None:
        predicted_length = cycle_lengths[-1]

    if not predicted_length or predicted_length <= 0:
        return default_response

    last_period = cycles[-1].cycle_start
    next_period = last_period + timedelta(days=predicted_length)

    window_start = next_period - timedelta(days=2)
    window_end = next_period + timedelta(days=2)

    irregular = _is_irregular(cycles[-1].cycle_length)
    confidence = _confidence_from_lengths(cycle_lengths)

    return {
        "predicted_cycle_length": predicted_length,
        "next_period_estimate": str(next_period),
        "prediction_window_start": str(window_start),
        "prediction_window_end": str(window_end),
        "confidence": confidence,
        "irregular": irregular,
    }


def train_model_from_db(db: Session, profile_id: str | None = None):
    """Train the persisted cycle prediction model from stored cycles."""
    cycles = get_cycles(db, profile_id)
    cycle_lengths = [
        c.cycle_length
        for c in cycles
        if c.cycle_length is not None and 14 <= c.cycle_length <= 50
    ]
    if cycle_lengths:
        return train_model(cycle_lengths)
    return None


def log_activity(db: Session, profile_id: str | None, action: str, details: str | None = None):
    entry = models.ActivityLog(profile_id=profile_id or "default", action=action, details=details)
    db.add(entry)
    db.commit()
    return entry


def get_daily_phase_data(db: Session, profile_id: str | None = None):
    """Return the raw per-day data from past_data.csv for UI display (phase + period info)."""
    csv_path = Path(__file__).resolve().parents[1] / "dataset" / "past_data.csv"
    if not csv_path.exists():
        return []

    data = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row_date = datetime.strptime(row["Date"], "%d-%m-%Y").date()
            data.append(
                {
                    "date": row_date,
                    "cycle_day": int(row.get("Cycle_Day") or 0),
                    "phase": row.get("Phase", "").strip(),
                    "period_flag": int(row.get("Period_Flag") or 0),
                    "cycle_total_duration": int(row.get("Cycle_Total_Duration") or -1),
                    "irregularity_flag": int(row.get("Irregularity_Flag") or 0),
                    "skipped_flag": int(row.get("Skipped_Flag") or 0),
                    "phase_code": int(row.get("Phase_Code") or -1),
                }
            )
    return data


def seed_cycles_from_past_data(db: Session, profile_id: str | None = None):
    """Seed cycles from the detailed `past_data.csv` file.

    This file provides daily records including cycle day, phase, and period flag.
    We use it to construct per-cycle entries for the prediction model.
    """

    csv_path = Path(__file__).resolve().parents[1] / "dataset" / "past_data.csv"
    if not csv_path.exists():
        return []

    # Read all rows and group by cycle start days (Cycle_Day == 1).
    rows = []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Date format in this file is DD-MM-YYYY
            row_date = datetime.strptime(row["Date"], "%d-%m-%Y").date()
            row["__parsed_date"] = row_date
            rows.append(row)

    # Sort by date to preserve order.
    rows.sort(key=lambda r: r["__parsed_date"])

    cycles = []
    current_cycle = None
    for r in rows:
        cycle_day = int(r.get("Cycle_Day", 0))
        total_duration = int(r.get("Cycle_Total_Duration", -1))
        period_flag = int(r.get("Period_Flag", 0))

        if cycle_day == 1:
            # Start a new cycle.
            current_cycle = {
                "start_date": r["__parsed_date"],
                "period_length": 0,
                "cycle_length": total_duration if total_duration > 0 else None,
            }
            cycles.append(current_cycle)

        if not current_cycle:
            continue

        # Count bleeding days at the start of the cycle.
        if period_flag == 1 and current_cycle["period_length"] == (cycle_day - 1):
            current_cycle["period_length"] += 1

    # Insert cycles into DB (skip if already exists)
    existing = get_cycles(db, profile_id)
    if existing:
        return existing

    for c in cycles:
        # Use direct model insertion to preserve cycle_length overrides.
        cycle_end = None
        if c["period_length"] is not None:
            cycle_end = c["start_date"] + timedelta(days=c["period_length"] - 1)

        new_cycle = models.Cycle(
            profile_id=profile_id,
            cycle_start=c["start_date"],
            cycle_end=cycle_end,
            cycle_length=c["cycle_length"],
            period_length=c["period_length"],
        )
        db.add(new_cycle)

    db.commit()

    return get_cycles(db, profile_id)


def seed_cycles_from_csv(db: Session, profile_id: str | None = None):
    """Seed cycles from either past_data.csv or the legacy girlfriend_cycles.csv."""
    # Prefer the richer dataset when available.
    past = seed_cycles_from_past_data(db, profile_id)
    if past:
        return past

    existing = get_cycles(db, profile_id)
    if existing:
        return existing

    csv_path = Path(__file__).resolve().parents[1] / "dataset" / "girlfriend_cycles.csv"
    if not csv_path.exists():
        return []

    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            start_date = datetime.fromisoformat(row["CycleStart"]).date()
            period_length = int(row["PeriodLengthDays"])
            add_cycle(db, start_date, period_length, profile_id)

    return get_cycles(db, profile_id)
