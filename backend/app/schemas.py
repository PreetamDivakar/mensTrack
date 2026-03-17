from datetime import date, datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    name: Optional[str]


class UserResponse(BaseModel):
    id: UUID
    email: EmailStr
    name: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class ProfileCreate(BaseModel):
    name: str


class ProfileResponse(BaseModel):
    id: UUID
    name: str
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class CycleCreate(BaseModel):
    start_date: date
    period_length: int
    profile_id: Optional[str]


class CycleResponse(BaseModel):
    id: UUID
    profile_id: Optional[UUID]
    cycle_start: date
    cycle_end: Optional[date]
    cycle_length: Optional[int]
    period_length: int
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class PredictionResponse(BaseModel):
    predicted_cycle_length: float
    next_period_estimate: str
    prediction_window_start: str
    prediction_window_end: str
    confidence: float
    irregular: bool


class ActivityLogResponse(BaseModel):
    id: UUID
    profile_id: UUID
    action: str
    details: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DailyLogCreate(BaseModel):
    date: date
    mood: Optional[str] = None
    symptoms: Optional[str] = None
    flow_intensity: Optional[str] = None
    sleep_hours: Optional[int] = None
    energy_level: Optional[int] = None
    notes: Optional[str] = None
    profile_id: Optional[str] = None


class DailyLogResponse(BaseModel):
    id: UUID
    profile_id: Optional[UUID]
    date: date
    mood: Optional[str]
    symptoms: Optional[str]
    flow_intensity: Optional[str]
    sleep_hours: Optional[int]
    energy_level: Optional[int]
    notes: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class DailyPhaseResponse(BaseModel):
    date: date
    cycle_day: int
    phase: str
    period_flag: int
    cycle_total_duration: int
    irregularity_flag: int
    skipped_flag: int
    phase_code: int


class PatternResponse(BaseModel):
    recurring_symptoms: list[str]
    cycle_trend: str
    upcoming_period_days: Optional[int]
    upcoming_ovulation_days: Optional[int]
    confidence: float
    irregular: bool
