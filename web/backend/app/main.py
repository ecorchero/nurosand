from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, date
from typing import List, Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from sqlmodel import select

from .db import init_db, get_session
from .seed import seed
from .adapt import adapt_daily_plan
from .reports import upsert_weekly_report, week_start_of, build_weekly_summary
from . import tts as eleven_tts
from .models import (
    User,
    PatientProfile,
    Plan,
    ExerciseTemplate,
    EnvironmentCapture,
    DailyPlan,
    Session as WorkoutSession,
    PerformanceSnapshot,
    WellnessSample,
    WeeklyReport,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    seed()
    yield


app = FastAPI(title="Nurosand API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- request schemas ----------
class PlanIn(BaseModel):
    focus_tags: List[str]
    notes: str = ""
    frequency_per_week: int = 5
    session_minutes: int = 15


class PatientCreateIn(BaseModel):
    name: str
    notes: str = ""
    focus_tags: List[str] = ["balance"]
    frequency_per_week: int = 5
    session_minutes: int = 15
    doctor_id: Optional[str] = None


class EnvironmentIn(BaseModel):
    media_url: str = ""
    tags: List[str] = []


class WellnessIn(BaseModel):
    date: Optional[str] = None
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = None
    resting_hr: Optional[int] = None
    source: str = "manual"


class SessionStartIn(BaseModel):
    daily_plan_id: str


class PerfIn(BaseModel):
    exercise_id: str = ""
    exercise_name: str = ""
    focus_tag: str = ""
    completed: bool = True
    score: float = 1.0
    difficulty: int = 2
    notes: str = ""


class SessionCompleteIn(BaseModel):
    spoken_cues: List[str] = []
    feedback: Dict[str, Any] = {}
    performance: List[PerfIn] = []


class SignIn(BaseModel):
    doctor_id: str
    notes: str = ""


class TtsIn(BaseModel):
    text: str


# ---------- helpers ----------
def _patient_payload(db, user: User) -> Dict[str, Any]:
    profile = db.exec(select(PatientProfile).where(PatientProfile.user_id == user.id)).first()
    plan = db.exec(
        select(Plan).where(Plan.patient_id == user.id, Plan.active == True)  # noqa: E712
    ).first()
    return {
        "id": user.id,
        "name": user.name,
        "notes": profile.notes if profile else "",
        "doctor_id": profile.doctor_id if profile else None,
        "plan": plan.model_dump() if plan else None,
    }


# ---------- doctor / patients ----------
@app.get("/api/health")
def health():
    return {"ok": True, "tts": "elevenlabs" if eleven_tts.is_configured() else "browser_fallback"}


@app.get("/api/tts/status")
def tts_status():
    configured = eleven_tts.is_configured()
    return {
        "provider": "elevenlabs" if configured else "browser",
        "configured": configured,
        "voice": eleven_tts.voice_label() if configured else "Samantha (system)",
    }


@app.post("/api/tts")
async def tts_speak(body: TtsIn):
    text = (body.text or "").strip()
    if not text:
        raise HTTPException(400, "text is required")
    if len(text) > 800:
        raise HTTPException(400, "text too long")
    if not eleven_tts.is_configured():
        raise HTTPException(503, "ElevenLabs not configured. Set ELEVENLABS_API_KEY")
    try:
        audio, content_type = await eleven_tts.synthesize(text)
    except RuntimeError as e:
        raise HTTPException(502, str(e)) from e
    return Response(content=audio, media_type=content_type)


@app.get("/api/doctor")
def get_doctor():
    with get_session() as db:
        doc = db.exec(select(User).where(User.role == "doctor")).first()
        if not doc:
            raise HTTPException(404, "No doctor seeded")
        return {"id": doc.id, "name": doc.name}


@app.get("/api/patients")
def list_patients():
    with get_session() as db:
        users = db.exec(select(User).where(User.role == "patient")).all()
        return [_patient_payload(db, u) for u in users]


@app.post("/api/patients")
def create_patient(body: PatientCreateIn):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(400, "name is required")
    focus = [t.strip().lower() for t in (body.focus_tags or []) if t.strip()]
    if not focus:
        focus = ["balance"]

    with get_session() as db:
        doctor_id = body.doctor_id
        if not doctor_id:
            doc = db.exec(select(User).where(User.role == "doctor")).first()
            if not doc:
                raise HTTPException(404, "No doctor found")
            doctor_id = doc.id
        else:
            doc = db.get(User, doctor_id)
            if not doc or doc.role != "doctor":
                raise HTTPException(404, "Doctor not found")

        user = User(role="patient", name=name)
        db.add(user)
        db.commit()
        db.refresh(user)

        db.add(PatientProfile(user_id=user.id, doctor_id=doctor_id, notes=body.notes.strip()))
        db.add(
            Plan(
                patient_id=user.id,
                focus_tags=focus,
                notes=body.notes.strip(),
                frequency_per_week=body.frequency_per_week,
                session_minutes=body.session_minutes,
            )
        )
        db.add(
            EnvironmentCapture(
                patient_id=user.id,
                media_url="seed://new-patient",
                tags=["chair", "table", "wall", "open_floor"],
            )
        )
        db.commit()
        return _patient_payload(db, user)


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: str):
    with get_session() as db:
        user = db.get(User, patient_id)
        if not user or user.role != "patient":
            raise HTTPException(404, "Patient not found")
        payload = _patient_payload(db, user)
        payload["environment"] = [
            e.model_dump()
            for e in db.exec(
                select(EnvironmentCapture)
                .where(EnvironmentCapture.patient_id == patient_id)
                .order_by(EnvironmentCapture.created_at.desc())
            ).all()
        ]
        payload["recent_sessions"] = [
            s.model_dump()
            for s in db.exec(
                select(WorkoutSession)
                .where(WorkoutSession.patient_id == patient_id)
                .order_by(WorkoutSession.started_at.desc())
            ).all()[:10]
        ]
        return payload


@app.put("/api/patients/{patient_id}/plan")
def upsert_plan(patient_id: str, body: PlanIn):
    with get_session() as db:
        user = db.get(User, patient_id)
        if not user:
            raise HTTPException(404, "Patient not found")
        plan = db.exec(
            select(Plan).where(Plan.patient_id == patient_id, Plan.active == True)  # noqa: E712
        ).first()
        if plan:
            plan.focus_tags = body.focus_tags
            plan.notes = body.notes
            plan.frequency_per_week = body.frequency_per_week
            plan.session_minutes = body.session_minutes
        else:
            plan = Plan(
                patient_id=patient_id,
                focus_tags=body.focus_tags,
                notes=body.notes,
                frequency_per_week=body.frequency_per_week,
                session_minutes=body.session_minutes,
            )
        db.add(plan)
        db.commit()
        db.refresh(plan)
        return plan.model_dump()


@app.get("/api/exercise-templates")
def list_templates():
    with get_session() as db:
        return [t.model_dump() for t in db.exec(select(ExerciseTemplate)).all()]


# ---------- environment + wellness ----------
@app.post("/api/patients/{patient_id}/environment")
def add_environment(patient_id: str, body: EnvironmentIn):
    with get_session() as db:
        cap = EnvironmentCapture(patient_id=patient_id, media_url=body.media_url, tags=body.tags)
        db.add(cap)
        db.commit()
        db.refresh(cap)
        return cap.model_dump()


@app.post("/api/patients/{patient_id}/wellness")
def add_wellness(patient_id: str, body: WellnessIn):
    with get_session() as db:
        d = body.date or date.today().isoformat()
        sample = WellnessSample(
            patient_id=patient_id,
            date=d,
            sleep_hours=body.sleep_hours,
            sleep_quality=body.sleep_quality,
            resting_hr=body.resting_hr,
            source=body.source,
        )
        db.add(sample)
        db.commit()
        db.refresh(sample)
        return sample.model_dump()


# ---------- daily plan (adapter) ----------
@app.get("/api/patients/{patient_id}/daily-plan")
def get_daily_plan(patient_id: str, date_str: Optional[str] = None):
    d = date_str or date.today().isoformat()
    with get_session() as db:
        dp = db.exec(
            select(DailyPlan).where(DailyPlan.patient_id == patient_id, DailyPlan.date == d)
        ).first()
        return dp.model_dump() if dp else None


@app.post("/api/patients/{patient_id}/daily-plan")
def generate_daily_plan(patient_id: str, date_str: Optional[str] = None, regenerate: bool = False):
    d = date_str or date.today().isoformat()
    with get_session() as db:
        user = db.get(User, patient_id)
        if not user:
            raise HTTPException(404, "Patient not found")
        existing = db.exec(
            select(DailyPlan).where(DailyPlan.patient_id == patient_id, DailyPlan.date == d)
        ).first()
        if existing and not regenerate:
            return existing.model_dump()

        result = adapt_daily_plan(db, patient_id, d)
        if existing:
            existing.exercises = result["exercises"]
            existing.rationale = result["rationale"]
            dp = existing
        else:
            dp = DailyPlan(
                patient_id=patient_id,
                date=d,
                exercises=result["exercises"],
                rationale=result["rationale"],
            )
        db.add(dp)
        db.commit()
        db.refresh(dp)
        return dp.model_dump()


# ---------- sessions ----------
@app.post("/api/sessions")
def start_session(body: SessionStartIn):
    with get_session() as db:
        dp = db.get(DailyPlan, body.daily_plan_id)
        if not dp:
            raise HTTPException(404, "Daily plan not found")
        sess = WorkoutSession(daily_plan_id=dp.id, patient_id=dp.patient_id)
        db.add(sess)
        db.commit()
        db.refresh(sess)
        return sess.model_dump()


@app.post("/api/sessions/{session_id}/complete")
def complete_session(session_id: str, body: SessionCompleteIn):
    with get_session() as db:
        sess = db.get(WorkoutSession, session_id)
        if not sess:
            raise HTTPException(404, "Session not found")
        sess.completed_at = datetime.utcnow()
        sess.spoken_cues = body.spoken_cues
        sess.feedback = body.feedback
        db.add(sess)
        for p in body.performance:
            db.add(
                PerformanceSnapshot(
                    session_id=sess.id,
                    patient_id=sess.patient_id,
                    exercise_id=p.exercise_id,
                    exercise_name=p.exercise_name,
                    focus_tag=p.focus_tag,
                    completed=p.completed,
                    score=p.score,
                    difficulty=p.difficulty,
                    notes=p.notes,
                )
            )
        db.commit()
        # Refresh this week's report so the doctor sees latest.
        upsert_weekly_report(db, sess.patient_id, week_start_of(date.today()))
        db.refresh(sess)
        return sess.model_dump()


# ---------- weekly reports ----------
@app.get("/api/patients/{patient_id}/weekly-reports")
def list_weekly_reports(patient_id: str):
    with get_session() as db:
        # Ensure current week exists / is fresh.
        upsert_weekly_report(db, patient_id, week_start_of(date.today()))
        reports = db.exec(
            select(WeeklyReport)
            .where(WeeklyReport.patient_id == patient_id)
            .order_by(WeeklyReport.week_start.desc())
        ).all()
        return [r.model_dump() for r in reports]


@app.post("/api/patients/{patient_id}/weekly-reports/generate")
def generate_weekly_report(patient_id: str, week_start: Optional[str] = None):
    with get_session() as db:
        ws = datetime.fromisoformat(week_start).date() if week_start else week_start_of(date.today())
        rep = upsert_weekly_report(db, patient_id, ws)
        return rep.model_dump()


@app.post("/api/weekly-reports/{report_id}/sign")
def sign_weekly_report(report_id: str, body: SignIn):
    with get_session() as db:
        rep = db.get(WeeklyReport, report_id)
        if not rep:
            raise HTTPException(404, "Report not found")
        rep.status = "signed"
        rep.signed_at = datetime.utcnow()
        rep.signed_by = body.doctor_id
        rep.doctor_notes = body.notes
        db.add(rep)
        db.commit()
        db.refresh(rep)
        return rep.model_dump()
