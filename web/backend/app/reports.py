from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Dict, Any, List

from sqlmodel import Session, select

from .models import (
    Plan,
    Session as WorkoutSession,
    PerformanceSnapshot,
    WellnessSample,
    WeeklyReport,
)


def week_start_of(d: date) -> date:
    return d - timedelta(days=d.weekday())  # Monday


def _parse_date(s: str) -> date:
    return datetime.fromisoformat(s).date()


def build_weekly_summary(db: Session, patient_id: str, week_start: date) -> Dict[str, Any]:
    week_end = week_start + timedelta(days=7)
    start_dt = datetime.combine(week_start, datetime.min.time())
    end_dt = datetime.combine(week_end, datetime.min.time())

    sessions = db.exec(
        select(WorkoutSession).where(
            WorkoutSession.patient_id == patient_id,
            WorkoutSession.started_at >= start_dt,
            WorkoutSession.started_at < end_dt,
        )
    ).all()
    completed_sessions = [s for s in sessions if s.completed_at is not None]

    plan = db.exec(
        select(Plan).where(Plan.patient_id == patient_id, Plan.active == True)  # noqa: E712
    ).first()
    planned = plan.frequency_per_week if plan else 5
    focus_tags = list(plan.focus_tags) if plan else []

    snaps = db.exec(
        select(PerformanceSnapshot).where(
            PerformanceSnapshot.patient_id == patient_id,
            PerformanceSnapshot.created_at >= start_dt,
            PerformanceSnapshot.created_at < end_dt,
        )
    ).all()

    per_focus: Dict[str, Dict[str, Any]] = {}
    for snap in snaps:
        tag = snap.focus_tag or "general"
        b = per_focus.setdefault(tag, {"count": 0, "score_sum": 0.0, "completed": 0})
        b["count"] += 1
        b["score_sum"] += snap.score if snap.completed else 0.0
        b["completed"] += 1 if snap.completed else 0

    focus_progress = []
    for tag in sorted(set(focus_tags) | set(per_focus.keys())):
        b = per_focus.get(tag, {"count": 0, "score_sum": 0.0, "completed": 0})
        avg = (b["score_sum"] / b["count"]) if b["count"] else None
        focus_progress.append(
            {
                "focus": tag,
                "exercises_logged": b["count"],
                "avg_score": round(avg, 2) if avg is not None else None,
                "completion_pct": round(100 * b["completed"] / b["count"]) if b["count"] else None,
            }
        )

    wellness = db.exec(
        select(WellnessSample).where(
            WellnessSample.patient_id == patient_id,
            WellnessSample.date >= week_start.isoformat(),
            WellnessSample.date < week_end.isoformat(),
        )
    ).all()
    sleep_vals = [w.sleep_hours for w in wellness if w.sleep_hours is not None]
    quality_vals = [w.sleep_quality for w in wellness if w.sleep_quality is not None]
    wellness_summary = {
        "nights_logged": len(wellness),
        "avg_sleep_hours": round(sum(sleep_vals) / len(sleep_vals), 1) if sleep_vals else None,
        "avg_sleep_quality": round(sum(quality_vals) / len(quality_vals), 1)
        if quality_vals
        else None,
    }

    return {
        "sessions_completed": len(completed_sessions),
        "sessions_started": len(sessions),
        "sessions_planned": planned,
        "adherence_pct": round(100 * len(completed_sessions) / planned) if planned else None,
        "focus_progress": focus_progress,
        "wellness": wellness_summary,
        "generated_at": datetime.utcnow().isoformat(),
    }


def upsert_weekly_report(db: Session, patient_id: str, week_start: date) -> WeeklyReport:
    ws = week_start.isoformat()
    existing = db.exec(
        select(WeeklyReport).where(
            WeeklyReport.patient_id == patient_id, WeeklyReport.week_start == ws
        )
    ).first()
    summary = build_weekly_summary(db, patient_id, week_start)

    if existing:
        # Do not overwrite a signed report's summary; keep the signed snapshot.
        if existing.status != "signed":
            existing.summary = summary
            db.add(existing)
            db.commit()
            db.refresh(existing)
        return existing

    rep = WeeklyReport(patient_id=patient_id, week_start=ws, summary=summary, status="draft")
    db.add(rep)
    db.commit()
    db.refresh(rep)
    return rep
