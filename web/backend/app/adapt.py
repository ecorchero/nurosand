from __future__ import annotations

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from sqlmodel import Session, select

from .models import (
    Plan,
    ExerciseTemplate,
    EnvironmentCapture,
    PerformanceSnapshot,
    WellnessSample,
    WeeklyReport,
)

DEFAULT_TARGET_COUNT = 4


def _recent_perf_by_focus(db: Session, patient_id: str, days: int = 7) -> Dict[str, float]:
    cutoff = datetime.utcnow() - timedelta(days=days)
    rows = db.exec(
        select(PerformanceSnapshot).where(
            PerformanceSnapshot.patient_id == patient_id,
            PerformanceSnapshot.created_at >= cutoff,
        )
    ).all()
    buckets: Dict[str, List[float]] = {}
    for r in rows:
        if not r.focus_tag:
            continue
        buckets.setdefault(r.focus_tag, []).append(r.score if r.completed else 0.0)
    return {k: (sum(v) / len(v)) for k, v in buckets.items() if v}


def _latest_wellness(db: Session, patient_id: str) -> Optional[WellnessSample]:
    return db.exec(
        select(WellnessSample)
        .where(WellnessSample.patient_id == patient_id)
        .order_by(WellnessSample.date.desc())
    ).first()


def _latest_signed_notes(db: Session, patient_id: str) -> str:
    rep = db.exec(
        select(WeeklyReport)
        .where(WeeklyReport.patient_id == patient_id, WeeklyReport.status == "signed")
        .order_by(WeeklyReport.week_start.desc())
    ).first()
    return (rep.doctor_notes or "").strip() if rep else ""


def _env_tags(db: Session, patient_id: str) -> List[str]:
    cap = db.exec(
        select(EnvironmentCapture)
        .where(EnvironmentCapture.patient_id == patient_id)
        .order_by(EnvironmentCapture.created_at.desc())
    ).first()
    return list(cap.tags) if cap else []


def adapt_daily_plan(
    db: Session,
    patient_id: str,
    target_date: str,
    target_count: Optional[int] = None,
    feature_videos: bool = False,
) -> Dict[str, Any]:
    TARGET_COUNT = target_count or DEFAULT_TARGET_COUNT
    plan = db.exec(
        select(Plan).where(Plan.patient_id == patient_id, Plan.active == True)  # noqa: E712
    ).first()
    focus_tags = list(plan.focus_tags) if plan else ["balance"]

    env = _env_tags(db, patient_id)
    perf = _recent_perf_by_focus(db, patient_id)
    wellness = _latest_wellness(db, patient_id)
    signed_notes = _latest_signed_notes(db, patient_id)

    # Global intensity modifier from sleep/wellness.
    intensity = 0  # -1 easier, 0 normal, +1 harder
    reasons: List[str] = []
    if wellness and wellness.sleep_hours is not None:
        if wellness.sleep_hours < 6 or (wellness.sleep_quality or 3) <= 2:
            intensity -= 1
            reasons.append(
                f"Poor recent sleep ({wellness.sleep_hours:.1f}h), so easing intensity and adding rest."
            )
        elif wellness.sleep_hours >= 7.5 and (wellness.sleep_quality or 3) >= 4:
            intensity += 1
            reasons.append("Good sleep recovery, so slightly higher challenge today.")

    # Signed doctor notes can bias which focus is emphasised.
    emphasised: Optional[str] = None
    if signed_notes:
        low = signed_notes.lower()
        for tag in focus_tags:
            if tag.lower() in low:
                emphasised = tag
                reasons.append(f"Doctor sign-off emphasises {tag}.")
                break

    templates = db.exec(select(ExerciseTemplate)).all()

    # Order focus tags so emphasised + weakest-performing come first.
    def focus_priority(tag: str) -> float:
        score = perf.get(tag, 0.6)  # unknown -> mid
        bump = -1.0 if tag == emphasised else 0.0
        return score + bump  # lower = higher priority

    ordered_focus = sorted(focus_tags, key=focus_priority)

    chosen: List[Dict[str, Any]] = []
    used_templates: set[str] = set()

    def props_ok(t: ExerciseTemplate) -> bool:
        return all(p in env for p in t.needs_props) if t.needs_props else True

    # Feature any exercise with a demo video so it's guaranteed to show up,
    # regardless of the patient's focus tags or environment props. Only
    # enabled for patients explicitly flagged for the video demo.
    if feature_videos:
        for t in templates:
            if len(chosen) >= TARGET_COUNT:
                break
            if not t.video_url or t.id in used_templates:
                continue
            used_templates.add(t.id)
            tag = t.focus_tags[0] if t.focus_tags else "general"
            difficulty = max(1, min(5, t.base_difficulty + intensity))
            chosen.append(
                {
                    "template_id": t.id,
                    "name": t.name,
                    "focus_tag": tag,
                    "instructions": t.instructions,
                    "needs_props": t.needs_props,
                    "cue_scripts": t.cue_scripts,
                    "difficulty": difficulty,
                    "reps": 6 + difficulty * 2,
                    "hold_seconds": 10 + difficulty * 5,
                    "rest_seconds": 20,
                    "video_url": t.video_url,
                    "gif_url": getattr(t, "gif_url", "") or "",
                }
            )

    for tag in ordered_focus:
        if len(chosen) >= TARGET_COUNT:
            break
        candidates = [
            t
            for t in templates
            if tag in t.focus_tags and t.id not in used_templates and props_ok(t)
        ]
        # Fallback: ignore props if nothing fits the environment.
        if not candidates:
            candidates = [
                t for t in templates if tag in t.focus_tags and t.id not in used_templates
            ]
        if not candidates:
            continue

        avg = perf.get(tag)
        # Per-focus difficulty adjustment from prior performance.
        adj = intensity
        if avg is not None:
            if avg < 0.5:
                adj -= 1
                reasons.append(f"{tag}: recent success {int(avg * 100)}%, so an easier variant.")
            elif avg > 0.85:
                adj += 1
                reasons.append(f"{tag}: strong {int(avg * 100)}%, so progressing difficulty.")

        candidates.sort(key=lambda t: t.base_difficulty)
        t = candidates[0]
        used_templates.add(t.id)

        difficulty = max(1, min(5, t.base_difficulty + adj))
        reps = 6 + difficulty * 2
        hold_seconds = 10 + difficulty * 5
        rest_seconds = 30 if intensity < 0 else 20

        chosen.append(
            {
                "template_id": t.id,
                "name": t.name,
                "focus_tag": tag,
                "instructions": t.instructions,
                "needs_props": t.needs_props,
                "cue_scripts": t.cue_scripts,
                "difficulty": difficulty,
                "reps": reps,
                "hold_seconds": hold_seconds,
                "rest_seconds": rest_seconds,
                "video_url": t.video_url,
                "gif_url": getattr(t, "gif_url", "") or "",
            }
        )

    # Top up to TARGET_COUNT with any remaining templates matching plan focus.
    if len(chosen) < TARGET_COUNT:
        for t in templates:
            if len(chosen) >= TARGET_COUNT:
                break
            if t.id in used_templates:
                continue
            if not any(tag in focus_tags for tag in t.focus_tags):
                continue
            used_templates.add(t.id)
            difficulty = max(1, min(5, t.base_difficulty + intensity))
            chosen.append(
                {
                    "template_id": t.id,
                    "name": t.name,
                    "focus_tag": t.focus_tags[0] if t.focus_tags else "general",
                    "instructions": t.instructions,
                    "needs_props": t.needs_props,
                    "cue_scripts": t.cue_scripts,
                    "difficulty": difficulty,
                    "reps": 6 + difficulty * 2,
                    "hold_seconds": 10 + difficulty * 5,
                    "rest_seconds": 20,
                    "video_url": t.video_url,
                    "gif_url": getattr(t, "gif_url", "") or "",
                }
            )

    if not reasons:
        reasons.append("Baseline plan. No recent performance or wellness signals yet.")

    rationale = " ".join(reasons)
    if env:
        rationale += f" Using detected environment: {', '.join(env)}."

    return {"exercises": chosen, "rationale": rationale}
