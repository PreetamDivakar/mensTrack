import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import relationship

from .database import Base


def generate_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):

    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    profiles = relationship("ProfileMember", back_populates="user")


class Profile(Base):

    __tablename__ = "profiles"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    members = relationship("ProfileMember", back_populates="profile")
    cycles = relationship("Cycle", back_populates="profile")


class ProfileMember(Base):

    __tablename__ = "profile_members"

    id = Column(String, primary_key=True, default=generate_uuid)
    profile_id = Column(String, ForeignKey("profiles.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    role = Column(String, default="member")
    created_at = Column(DateTime, server_default=func.now())

    profile = relationship("Profile", back_populates="members")
    user = relationship("User", back_populates="profiles")


class ActivityLog(Base):

    __tablename__ = "activity_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    profile_id = Column(String, nullable=False)
    action = Column(String, nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class DailyLog(Base):

    __tablename__ = "daily_logs"

    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(String, nullable=True)
    date = Column(Date, nullable=False, index=True)
    mood = Column(String, nullable=True)
    symptoms = Column(Text, nullable=True)
    flow_intensity = Column(String, nullable=True)
    sleep_hours = Column(Integer, nullable=True)
    energy_level = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class Cycle(Base):

    __tablename__ = "cycles"

    # Supabase default table uses UUID primary key.
    id = Column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    profile_id = Column(String, ForeignKey("profiles.id"), nullable=True)

    cycle_start = Column(Date)

    cycle_end = Column(Date)

    cycle_length = Column(Integer)

    period_length = Column(Integer)

    created_at = Column(DateTime, server_default=func.now())

    profile = relationship("Profile", back_populates="cycles")
