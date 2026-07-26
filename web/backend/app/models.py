from __future__ import annotations

from datetime import datetime, date
from typing import Optional, List, Dict, Any

from sqlalchemy import Column, JSON
from sqlmodel import SQLModel, Field


def _uid() -> str:
    import uuid

    return uuid.uuid4().hex[:12]


class User(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    role: str  # "doctor" | "patient"
    name: str


class PatientProfile(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    user_id: str = Field(index=True)
    doctor_id: str = Field(index=True)
    notes: str = ""
    avatar_url: str = ""
    phone: str = ""
    address: str = ""
    date_of_birth: str = ""
    emergency_contact: str = ""
    daily_exercise_count: Optional[int] = None
    feature_video_exercises: bool = False
    review_requested: bool = False
    review_requested_at: Optional[datetime] = None
    glasses_connected: bool = False
    glasses_name: str = ""
    watch_connected: bool = False
    watch_name: str = ""


class Plan(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    patient_id: str = Field(index=True)
    focus_tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    notes: str = ""
    frequency_per_week: int = 5
    session_minutes: int = 15
    active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExerciseTemplate(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    name: str
    focus_tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    instructions: str = ""
    needs_props: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    cue_scripts: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    base_difficulty: int = 2  # 1..5
    video_url: str = ""
    gif_url: str = ""


class EnvironmentCapture(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    patient_id: str = Field(index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    media_url: str = ""
    tags: List[str] = Field(default_factory=list, sa_column=Column(JSON))


class DailyPlan(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    patient_id: str = Field(index=True)
    date: str = Field(index=True)  # ISO date string
    exercises: List[Dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON))
    rationale: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Session(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    daily_plan_id: str = Field(index=True)
    patient_id: str = Field(index=True)
    started_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    spoken_cues: List[str] = Field(default_factory=list, sa_column=Column(JSON))
    feedback: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


class PerformanceSnapshot(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    session_id: str = Field(index=True)
    patient_id: str = Field(index=True)
    exercise_id: str = ""
    exercise_name: str = ""
    focus_tag: str = ""
    completed: bool = True
    score: float = 1.0  # 0..1 success/quality
    difficulty: int = 2
    notes: str = ""
    created_at: datetime = Field(default_factory=datetime.utcnow)


class WellnessSample(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    patient_id: str = Field(index=True)
    date: str = Field(index=True)  # ISO date string
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = None  # 1..5
    resting_hr: Optional[int] = None
    source: str = "manual"  # manual | healthkit


class WeeklyReport(SQLModel, table=True):
    id: str = Field(default_factory=_uid, primary_key=True)
    patient_id: str = Field(index=True)
    week_start: str = Field(index=True)  # ISO date (Monday)
    summary: Dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    status: str = "draft"  # draft | signed
    doctor_notes: str = ""
    signed_at: Optional[datetime] = None
    signed_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
