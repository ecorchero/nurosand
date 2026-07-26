from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import List, Dict, Any

from sqlmodel import Session, select

from .db import engine, init_db
from .models import (
    User,
    PatientProfile,
    Plan,
    ExerciseTemplate,
    EnvironmentCapture,
    WellnessSample,
    DailyPlan,
    Session as WorkoutSession,
    PerformanceSnapshot,
)


def _t(
    name: str,
    focus: str,
    instructions: str,
    props: List[str] | None = None,
    cues: List[str] | None = None,
    difficulty: int = 2,
    video_url: str = "",
) -> Dict[str, Any]:
    short = name.split("–")[0].split("(")[0].strip()
    default_cues = [
        f"Next: {short}.",
        "Steady and controlled.",
        "Well done. Rest.",
    ]
    return dict(
        name=name,
        focus_tags=[focus],
        instructions=instructions,
        needs_props=props or [],
        cue_scripts=cues or default_cues,
        base_difficulty=difficulty,
        video_url=video_url,
    )


TEMPLATES: List[Dict[str, Any]] = [
    # ---------- Balance ----------
    _t(
        "Tandem Stance Hold",
        "balance",
        "Stand heel-to-toe in a straight line. Hold 30 seconds, then switch which foot is in front.",
        [],
        ["Heel to toe. Find your line.", "Hold steady for 30 seconds.", "Switch foot order and hold again."],
        3,
    ),
    _t(
        "Single-Leg Stand",
        "balance",
        "Balance on one foot near a wall or chair for support if needed. Alternate sides.",
        ["wall"],
        ["Lift one foot.", "Hold near the wall if you need it.", "Switch sides."],
        3,
    ),
    _t(
        "Weight Shifts on Foam Pad",
        "balance",
        "Stand on a cushion or pillow and shift weight slowly forward–back, then side–side.",
        ["cushion"],
        ["Soft surface underfoot.", "Shift forward and back slowly.", "Now side to side."],
        3,
    ),
    _t(
        "Clock Reach",
        "balance",
        "Standing, reach one foot out to imaginary clock positions (12, 3, 6, 9) and back to center.",
        [],
        ["Reach to 12 o'clock.", "Then 3, 6, and 9.", "Back to center."],
        3,
    ),
    _t(
        "Sit-to-Stand without Hands",
        "balance",
        "Rise from a chair without pushing off with your arms. Control the descent back down.",
        ["chair"],
        ["Arms crossed or by your sides.", "Stand without using your hands.", "Lower slowly."],
        3,
    ),
    _t(
        "Marching in Place",
        "balance",
        "Lift knees alternately while standing. Hold onto support as needed.",
        [],
        ["Lift those knees.", "Keep a steady rhythm.", "Hold support if you need it."],
        2,
    ),
    _t(
        "Head Turns While Standing",
        "balance",
        "Turn your head side-to-side or up-down while keeping a stable standing base.",
        [],
        ["Feet planted.", "Turn your head slowly side to side.", "Now gently up and down."],
        2,
    ),
    _t(
        "Balance Beam Walk (taped line)",
        "balance",
        "Walk heel-to-toe along a straight line taped on the floor.",
        ["tape"],
        ["Eyes forward.", "Heel to toe along the line.", "Slow and steady."],
        3,
    ),
    _t(
        "Ball Toss While Standing",
        "balance",
        "Catch and throw a soft ball while standing on a stable or slightly unstable surface.",
        ["ball"],
        ["Soft catch.", "Keep your feet quiet.", "Nice throws."],
        3,
    ),
    _t(
        "Standing Reach Beyond Base",
        "balance",
        "Reach forward or sideways to touch a target just outside arm's length. Return upright without stepping.",
        [],
        ["Reach to the target.", "Don't step. Return upright.", "Control the return."],
        3,
    ),
    # ---------- Dexterity ----------
    _t(
        "Line & Circle Steadiness (Both Hands)",
        "dexterity",
        "Draw a straight horizontal line with your right hand, then your left hand. "
        "Then draw a circle with your right hand, then your left hand.",
        ["paper"],
        ["Straight line, right hand.", "Now the left hand.", "Circle with your right hand.", "Finish with your left hand."],
        1,
        video_url="/videos/exercises/draw-shapes.mp4",
    ),
    _t(
        "Write Your Name (or Dog)",
        "dexterity",
        'Practice handwriting simple words (your name or "Dog") to rebuild fine motor–language coordination.',
        ["paper"],
        ["Write slowly and clearly.", "Steady pressure on the page.", "One more time."],
        2,
    ),
    _t(
        "Coin Sorting",
        "dexterity",
        "Pick up and sort coins by size into small containers.",
        ["coins", "table"],
        ["Pinch carefully.", "Sort by size.", "Steady hands."],
        2,
    ),
    _t(
        "Peg Board Insertion",
        "dexterity",
        "Place small pegs into holes one at a time, using fingertips only.",
        ["pegboard", "table"],
        ["One peg at a time.", "Fingertips only.", "Nice placement."],
        3,
    ),
    _t(
        "Button/Zipper Board",
        "dexterity",
        "Practice fastening buttons, zippers, and snaps on a mounted board.",
        ["button_board"],
        ["Button up carefully.", "Now the zipper.", "Snaps last."],
        3,
    ),
    _t(
        "Rubber Band Stretch (finger-to-finger)",
        "dexterity",
        "Loop a rubber band around your fingers and stretch them apart repeatedly.",
        ["rubber_band"],
        ["Stretch open.", "Control the close.", "Repeat."],
        2,
    ),
    _t(
        "Clothespin Pinch",
        "dexterity",
        "Open and close clothespins with thumb and index finger. Attach to a line or edge.",
        ["clothespin"],
        ["Pinch open.", "Clip onto the edge.", "Release and repeat."],
        2,
    ),
    _t(
        "Playing Cards Shuffle/Flip",
        "dexterity",
        "Pick up, flip, and stack playing cards one at a time.",
        ["cards", "table"],
        ["One card at a time.", "Flip and stack.", "Keep them neat."],
        2,
    ),
    _t(
        "Utensil Precision Task",
        "dexterity",
        "Use tweezers or chopsticks to move small objects (beans, beads) between bowls.",
        ["tweezers", "table"],
        ["Steady grip.", "Transfer carefully.", "Bowl to bowl."],
        3,
    ),
    _t(
        "Typing/Tapping Sequence",
        "dexterity",
        "Tap fingers in sequence on a table or tablet (1-2-3-4), then reverse.",
        ["table"],
        ["One, two, three, four.", "Now reverse.", "Keep the rhythm."],
        1,
    ),
    # ---------- Strength ----------
    _t(
        "Supine Bridge (Pelvic Lift)",
        "strength",
        "Lying on your back with knees bent, push through your heels to lift your hips.",
        ["mat"],
        ["Push through the heels.", "Lift the hips.", "Lower slowly."],
        2,
    ),
    _t(
        "Seated Knee Extensions",
        "strength",
        "While seated, straighten one knee at a time against resistance or gravity.",
        ["chair"],
        ["Straighten the knee.", "Hold briefly.", "Lower with control, then switch sides."],
        2,
    ),
    _t(
        "Wall Push-Ups",
        "strength",
        "Stand facing a wall and perform push-ups against it to build upper-body strength.",
        ["wall"],
        ["Body straight.", "Lower toward the wall.", "Push away."],
        2,
    ),
    _t(
        "Sit-to-Stand Repetitions",
        "strength",
        "Repeated controlled standing up and sitting down from a chair.",
        ["chair"],
        ["Stand tall.", "Sit with control.", "Keep going."],
        3,
    ),
    _t(
        "Resistance Band Arm Pulls",
        "strength",
        "Pull a resistance band apart at chest height, both arms together or alternating.",
        ["resistance_band"],
        ["Band at chest height.", "Pull apart.", "Return slowly."],
        3,
    ),
    _t(
        "Heel Raises",
        "strength",
        "Standing, rise onto your toes and lower slowly. Hold support if needed.",
        [],
        ["Up onto the toes.", "Lower slowly.", "Hold support if you need it."],
        2,
    ),
    _t(
        "Knee-to-Elbow Crunches",
        "strength",
        "Standing or seated, bring opposite knee up to meet opposite elbow, then switch and repeat.",
        [],
        ["Opposite knee to elbow.", "Engage your core.", "Switch sides."],
        2,
        video_url="/videos/exercises/knee-to-elbow.mp4",
    ),
    _t(
        "Grip Squeeze (stress ball)",
        "strength",
        "Squeeze and release a soft ball or putty repeatedly with each hand.",
        ["stress_ball"],
        ["Squeeze.", "Release.", "Switch hands."],
        1,
    ),
    _t(
        "Side-Lying Leg Lifts",
        "strength",
        "Lying on your side, lift the top leg up and lower slowly, controlling the movement.",
        ["mat"],
        ["Lift the top leg.", "Lower with control.", "Switch sides when ready."],
        2,
    ),
    _t(
        "Prone Head/Shoulder Lift",
        "strength",
        "Lying on your stomach, lift your head and shoulders slightly off the surface to build neck/back strength.",
        ["mat"],
        ["Gentle lift of head and shoulders.", "Hold briefly.", "Lower slowly."],
        2,
    ),
    # ---------- Mobility ----------
    _t(
        "Gait Retraining Over Obstacles",
        "mobility",
        "Walk over small objects on the floor (cones, foam blocks) to rebuild stepping patterns.",
        ["obstacles", "open_floor"],
        ["Step over carefully.", "Clear each obstacle.", "Steady path."],
        3,
    ),
    _t(
        "Ankle Circles",
        "mobility",
        "Rotate each ankle in circles both directions while seated or lying down.",
        ["chair"],
        ["Circle one way.", "Now the other way.", "Switch ankles."],
        1,
    ),
    _t(
        "Hip Flexor Stretch/March",
        "mobility",
        "March in place with high knees to mobilize the hips.",
        [],
        ["High knees.", "Open up the hips.", "Keep breathing."],
        2,
    ),
    _t(
        "Trunk Rotation (seated)",
        "mobility",
        "Sit and rotate your torso side-to-side with arms crossed over your chest.",
        ["chair"],
        ["Arms crossed.", "Rotate to one side.", "Then the other."],
        1,
    ),
    _t(
        "Shoulder Circles",
        "mobility",
        "Roll shoulders forward and backward in large circles.",
        [],
        ["Forward circles.", "Now backward.", "Large and smooth."],
        1,
    ),
    _t(
        "Reach-Across Midline",
        "mobility",
        "Reach one arm across the body to the opposite side, alternating.",
        [],
        ["Reach across.", "Touch the opposite side.", "Alternate arms."],
        2,
    ),
    _t(
        "Step-Ups on Low Platform",
        "mobility",
        "Step up and down on a low step or curb, alternating lead leg.",
        ["step"],
        ["Step up.", "Step down with control.", "Alternate lead leg."],
        3,
    ),
    _t(
        "Side-Stepping (lateral walk)",
        "mobility",
        "Walk sideways in a controlled, deliberate manner. Hold support if needed.",
        ["open_floor"],
        ["Side step.", "Controlled and even.", "Hold support if you need it."],
        2,
    ),
    _t(
        "Pivot-Turn Practice",
        "mobility",
        "Practice turning 90° / 180° while standing, using small controlled steps.",
        [],
        ["Small steps.", "Turn 90 degrees.", "Now try 180."],
        3,
    ),
    _t(
        "Wrist/Forearm Rotations",
        "mobility",
        "Rotate wrists and forearms (palm up, palm down) to mobilize the joint.",
        [],
        ["Palm up.", "Palm down.", "Both wrists."],
        1,
    ),
    # ---------- Memory ----------
    _t(
        "Word List Recall",
        "memory",
        "Listen to or read a short list of words, then recall as many as you can after a brief pause.",
        ["paper"],
        ["Listen carefully.", "Pause and think.", "Recall the words."],
        2,
    ),
    _t(
        "Object Location Memory",
        "memory",
        "Place several household objects in view, study their positions, look away, then place them back correctly.",
        ["table"],
        ["Study the layout.", "Look away.", "Replace each object."],
        2,
    ),
    _t(
        "Sequence Recall",
        "memory",
        "Watch or hear a short sequence of taps or steps, then repeat it in the same order.",
        [],
        ["Watch the sequence.", "Hold it in mind.", "Repeat it back."],
        2,
    ),
    _t(
        "Story Detail Recall",
        "memory",
        "Listen to a short story, then answer questions about key details.",
        [],
        ["Listen to the story.", "Focus on the details.", "Answer the questions."],
        3,
    ),
    _t(
        "Digit Span Forward/Backward",
        "memory",
        "Repeat a growing string of numbers forward, then try repeating them backward.",
        [],
        ["Repeat forward.", "Now try backward.", "One digit longer."],
        3,
    ),
    _t(
        "Category Naming",
        "memory",
        "Name as many items as you can in a category (animals, foods, cities) within one minute.",
        [],
        ["Pick a category.", "Name items steadily.", "Keep going until time is up."],
        2,
    ),
    _t(
        "Card Matching Memory",
        "memory",
        "Turn over pairs of cards to find matches, remembering locations as you go.",
        ["cards", "table"],
        ["Flip two cards.", "Remember the positions.", "Find the matches."],
        2,
    ),
    _t(
        "Prospective Memory Cue",
        "memory",
        "Carry out a planned action after a delay or cue (e.g. tap the table when you hear a word).",
        [],
        ["Remember your cue.", "Continue the other task.", "Act when the cue appears."],
        3,
    ),
    _t(
        "Spatial Path Memory",
        "memory",
        "Watch a short walking path or pointed route, then recreate it from memory.",
        ["open_floor"],
        ["Watch the path.", "Hold it in mind.", "Walk it yourself."],
        3,
    ),
    _t(
        "Dual-Task Memory Walk",
        "memory",
        "Walk a short loop while remembering a short list of words, then recall the list at the end.",
        ["open_floor"],
        ["Hold the word list.", "Walk steadily.", "Recall the words."],
        4,
    ),
    # ---------- Proprioception ----------
    _t(
        "Eyes-Closed Single-Leg Stand",
        "proprioception",
        "Balance on one foot with eyes closed near a wall or chair for safety. Alternate sides.",
        ["wall"],
        ["Close your eyes.", "Hold the stance.", "Open eyes and switch sides."],
        4,
    ),
    _t(
        "Joint Position Matching",
        "proprioception",
        "With eyes closed, move one limb to a position, then match that position with the other limb.",
        [],
        ["Set the first position.", "Eyes closed.", "Match with the other side."],
        3,
    ),
    _t(
        "Blindfolded Reach to Target",
        "proprioception",
        "Reach to touch a known target with eyes closed, then open eyes to check accuracy.",
        [],
        ["Note the target.", "Close your eyes and reach.", "Check how close you were."],
        3,
    ),
    _t(
        "Foam Pad Eyes Closed",
        "proprioception",
        "Stand on a cushion or pillow with eyes closed, holding support as needed.",
        ["cushion"],
        ["Soft surface underfoot.", "Close your eyes.", "Hold steady."],
        4,
    ),
    _t(
        "Heel-to-Toe Eyes Closed",
        "proprioception",
        "Walk heel-to-toe along a line with eyes closed or briefly closed between steps.",
        ["tape"],
        ["Heel to toe.", "Eyes closed if safe.", "Stay on the line."],
        4,
    ),
    _t(
        "Weight Shift Eyes Closed",
        "proprioception",
        "Shift weight slowly forward, back, and side to side with eyes closed.",
        [],
        ["Close your eyes.", "Shift forward and back.", "Now side to side."],
        3,
    ),
    _t(
        "Finger-to-Nose Eyes Closed",
        "proprioception",
        "With eyes closed, alternately touch your nose and an outstretched finger or target.",
        [],
        ["Close your eyes.", "Nose, then finger.", "Steady and accurate."],
        2,
    ),
    _t(
        "Seated Ankle Angle Reproduction",
        "proprioception",
        "Seated, move one ankle to an angle, return to neutral, then reproduce that angle without looking.",
        ["chair"],
        ["Set the angle.", "Return to neutral.", "Reproduce it."],
        2,
    ),
    _t(
        "Arm Mirror Matching",
        "proprioception",
        "Raise one arm to a position, then match it with the other arm without looking at either.",
        [],
        ["Set one arm.", "Match the other.", "Check alignment."],
        2,
    ),
    _t(
        "Step Placement Without Looking",
        "proprioception",
        "Step onto marked spots or a low step while looking ahead, not down at your feet.",
        ["step"],
        ["Eyes forward.", "Feel the step.", "Place the foot accurately."],
        3,
    ),
]


def sync_templates(db: Session) -> None:
    """Replace exercise library with the current TEMPLATES list."""
    for old in db.exec(select(ExerciseTemplate)).all():
        db.delete(old)
    db.commit()
    for t in TEMPLATES:
        db.add(ExerciseTemplate(**t))
    db.commit()


def _seed_completed_today(db: Session, patient_id: str) -> None:
    """Pre-complete today's session for the demo patient (Quentin) so the
    patient view shows a Review state and the doctor view has fresh data."""
    line_tpl = db.exec(
        select(ExerciseTemplate).where(ExerciseTemplate.name == "Line & Circle Steadiness (Both Hands)")
    ).first()
    knee_tpl = db.exec(
        select(ExerciseTemplate).where(ExerciseTemplate.name == "Knee-to-Elbow Crunches")
    ).first()
    if not line_tpl or not knee_tpl:
        return

    exercises = []
    for t in (line_tpl, knee_tpl):
        exercises.append(
            {
                "template_id": t.id,
                "name": t.name,
                "focus_tag": t.focus_tags[0] if t.focus_tags else "general",
                "instructions": t.instructions,
                "needs_props": t.needs_props,
                "cue_scripts": t.cue_scripts,
                "difficulty": 2,
                "reps": 10,
                "hold_seconds": 20,
                "rest_seconds": 20,
                "video_url": t.video_url,
            }
        )

    dp = DailyPlan(
        patient_id=patient_id,
        date=date.today().isoformat(),
        exercises=exercises,
        rationale="Today's plan: line/circle steadiness and knee-to-elbow strength.",
    )
    db.add(dp)
    db.commit()
    db.refresh(dp)

    sess = WorkoutSession(
        daily_plan_id=dp.id,
        patient_id=patient_id,
        started_at=datetime.utcnow() - timedelta(minutes=20),
        completed_at=datetime.utcnow() - timedelta(minutes=5),
        spoken_cues=["Great work today."],
        feedback={"avg_score": 0.7},
    )
    db.add(sess)
    db.commit()
    db.refresh(sess)

    db.add(
        PerformanceSnapshot(
            session_id=sess.id,
            patient_id=patient_id,
            exercise_id=line_tpl.id,
            exercise_name=line_tpl.name,
            focus_tag="dexterity",
            completed=True,
            score=0.55,
            difficulty=2,
            notes="Left hand: line/circle unsteady, not continuous.",
        )
    )
    db.add(
        PerformanceSnapshot(
            session_id=sess.id,
            patient_id=patient_id,
            exercise_id=knee_tpl.id,
            exercise_name=knee_tpl.name,
            focus_tag="strength",
            completed=True,
            score=0.85,
            difficulty=2,
        )
    )
    db.commit()


def seed(force: bool = False) -> None:
    init_db()
    with Session(engine) as db:
        # Always refresh the exercise library so list updates take effect.
        sync_templates(db)

        existing = db.exec(select(User).where(User.role == "doctor")).first()
        if existing and not force:
            return

        doctor = User(role="doctor", name="Dr. Elena Corchero")
        db.add(doctor)
        db.commit()
        db.refresh(doctor)

        patients_spec = [
            ("Alex Morgan", ["balance", "dexterity"], "Post-stroke rehab, focus on balance.", None),
            (
                "Sam Rivera",
                ["strength", "mobility", "proprioception"],
                "Knee recovery, build strength gradually.",
                None,
            ),
            (
                "Quentin Tarantino",
                ["dexterity", "strength"],
                "Demo patient — plan covers both video-guided exercises.",
                2,
            ),
        ]

        home_props = [
            "chair",
            "table",
            "wall",
            "open_floor",
            "cushion",
            "tape",
            "ball",
            "paper",
            "mat",
            "step",
        ]

        for name, focus, notes, daily_exercise_count in patients_spec:
            u = User(role="patient", name=name)
            db.add(u)
            db.commit()
            db.refresh(u)
            profile = PatientProfile(
                user_id=u.id,
                doctor_id=doctor.id,
                notes=notes,
                daily_exercise_count=daily_exercise_count,
            )
            if name == "Quentin Tarantino":
                profile.glasses_connected = True
                profile.glasses_name = "Ray-Ban Meta"
                profile.feature_video_exercises = True
            db.add(profile)
            plan = Plan(
                patient_id=u.id,
                focus_tags=focus,
                notes=notes,
                frequency_per_week=5,
                session_minutes=15,
            )
            db.add(plan)
            db.add(
                EnvironmentCapture(
                    patient_id=u.id,
                    media_url="seed://living-room",
                    tags=home_props,
                )
            )
            db.commit()

            for days_ago in range(1, 5):
                d = date.today() - timedelta(days=days_ago)
                db.add(
                    WellnessSample(
                        patient_id=u.id,
                        date=d.isoformat(),
                        sleep_hours=6.0 + (days_ago % 3) * 0.7,
                        sleep_quality=3 + (days_ago % 2),
                        source="manual",
                    )
                )
                sess = WorkoutSession(
                    daily_plan_id="seed",
                    patient_id=u.id,
                    started_at=datetime.utcnow() - timedelta(days=days_ago, hours=1),
                    completed_at=datetime.utcnow() - timedelta(days=days_ago),
                    feedback={"note": "seed session"},
                )
                db.add(sess)
                db.commit()
                db.refresh(sess)
                for tag in focus:
                    db.add(
                        PerformanceSnapshot(
                            session_id=sess.id,
                            patient_id=u.id,
                            exercise_name=f"{tag} exercise",
                            focus_tag=tag,
                            completed=True,
                            score=0.55 if tag == focus[0] else 0.9,
                            difficulty=2,
                        )
                    )
                db.commit()

            if name == "Quentin Tarantino":
                _seed_completed_today(db, u.id)


if __name__ == "__main__":
    seed(force=True)
    print(f"Seeded Nurosand demo data with {len(TEMPLATES)} exercises.")
