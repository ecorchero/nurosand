"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";
import { api, DailyPlan, DailyExercise, Patient } from "@/lib/api";

type ClipNote = {
  didWell: string;
  improve: string;
  watchOut: string;
};

type ReportCopy = {
  summary: string;
  contactPhysician: boolean;
  recommendation: string;
  clips: Record<string, ClipNote>;
  defaultNote: ClipNote;
};

function reportForPatient(patient: Patient | null, exercises: DailyExercise[]): ReportCopy {
  const name = (patient?.name || "").toLowerCase();
  const isDemoPatient = name.includes("quentin") || name.includes("lucy");

  if (isDemoPatient) {
    return {
      summary:
        "Today's session shows a clear left-right difference on fine motor work. Your right hand stayed steady and continuous on the line and circle task. The left hand was less controlled, with broken strokes and more wobble. Knee-to-elbow strength looked solid overall.",
      contactPhysician: true,
      recommendation:
        "Recommendation: contact your physician or care team before the next session. This asymmetry is worth a clinician look, especially if it feels new or is getting worse.",
      clips: {
        "Line & Circle Steadiness (Both Hands)": {
          didWell:
            "Right-hand line and circle were continuous and well paced. You kept the paper steady and finished both sides.",
          improve:
            "Slow the left hand down and aim for one unbroken stroke. Pause briefly between line and circle so the switch is clean.",
          watchOut:
            "Left-hand strokes looked wonky and not continuous. If that side feels weaker or shakier day to day, flag it to your clinician.",
        },
        "Knee-to-Elbow Crunches": {
          didWell:
            "Good rhythm alternating sides. You kept your torso tall and hit the opposite elbow without rushing.",
          improve:
            "Exhale as knee and elbow meet, and keep the non-working foot light on the floor for balance.",
          watchOut:
            "Avoid pulling on the neck or twisting through the low back. If either side pinches, shorten the range.",
        },
      },
      defaultNote: {
        didWell: "You completed the movement with effort and stayed with the coach cues.",
        improve: "Match the demo tempo a little more closely on the next pass.",
        watchOut: "Stop if anything feels sharp or unsafe.",
      },
    };
  }

  const names = exercises.map((e) => e.name).join(", ");
  return {
    summary: `Solid session covering ${names || "today's plan"}. Form looked consistent overall, with a few spots to tidy up on the next pass.`,
    contactPhysician: false,
    recommendation:
      "No urgent red flags from this review. Keep the current plan unless something new feels off.",
    clips: {},
    defaultNote: {
      didWell: "You stayed with the set and followed the coaching cues.",
      improve: "Aim for smoother timing between reps and a quieter finish.",
      watchOut: "Ease off if balance or pain spikes mid-set.",
    },
  };
}

function noteFor(ex: DailyExercise, copy: ReportCopy): ClipNote {
  return copy.clips[ex.name] || copy.defaultNote;
}

type Props = {
  patientId: string;
  daily: DailyPlan;
};

export default function SessionReviewReport({ patientId, daily }: Props) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [slide, setSlide] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const p = await api.getPatient(patientId);
        setPatient(p);
        if (p.review_requested) setSent(true);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, [patientId]);

  const copy = reportForPatient(patient, daily.exercises);
  const n = daily.exercises.length;

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function goTo(i: number) {
    setSlide(Math.max(0, Math.min(n - 1, i)));
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Horizontal swipe with intent; ignore mostly-vertical drags.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) goTo(slide + 1);
    else goTo(slide - 1);
  }

  async function sendToPhysician() {
    setSending(true);
    setError("");
    try {
      const p = await api.requestReview(patientId);
      setPatient(p);
      setSent(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="shell shell-patient">
      <div className="topbar">
        <Brand size={28} />
        <Link href={`/patient/${patientId}`} className="btn-nav">
          ← My day
        </Link>
      </div>

      <p className="text-sm muted">Session report</p>
      <h1 className="page-title">Nuroport</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
        <section className="card lg:col-span-5 lg:self-start">
          <h2 className="section-title">Summary</h2>
          <p className="mt-3 text-[15px] leading-relaxed">{copy.summary}</p>
          {copy.contactPhysician ? (
            <div
              className="mt-5 rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--danger)", background: "var(--danger-soft)" }}
            >
              <div className="font-medium" style={{ color: "var(--danger)" }}>
                Contact your physician
              </div>
              <p className="mt-2 text-[15px]" style={{ color: "var(--danger)" }}>
                {copy.recommendation}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-[15px] muted">{copy.recommendation}</p>
          )}

          {copy.contactPhysician && (
            <div className="mt-5">
              {sent || patient?.review_requested ? (
                <div className="alert-success">Sent to your physician for review.</div>
              ) : (
                <button
                  className="btn-primary w-full"
                  onClick={() => void sendToPhysician()}
                  disabled={sending}
                >
                  {sending ? "Sending…" : "Contact physician"}
                </button>
              )}
            </div>
          )}
        </section>

        <section className="lg:col-span-7">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="section-title">Form clips</h2>
              <p className="mt-1 text-sm muted">Swipe or use the arrows</p>
            </div>
            <div className="text-sm muted">
              {slide + 1} / {n}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <button className="btn-ghost" disabled={slide === 0} onClick={() => goTo(slide - 1)}>
              ← Prev
            </button>
            <div className="flex items-center gap-2">
              {daily.exercises.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to clip ${i + 1}`}
                  onClick={() => goTo(i)}
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: i === slide ? "var(--accent)" : "var(--track)",
                  }}
                />
              ))}
            </div>
            <button className="btn-ghost" disabled={slide >= n - 1} onClick={() => goTo(slide + 1)}>
              Next →
            </button>
          </div>

          <div
            className="mt-4 overflow-hidden"
            style={{ touchAction: "pan-y" }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="flex transition-transform duration-300 ease-out"
              style={{ transform: `translateX(-${slide * 100}%)` }}
            >
              {daily.exercises.map((ex) => {
                const exNotes = noteFor(ex, copy);
                return (
                  <div key={ex.template_id + ex.name} className="w-full shrink-0 pr-1">
                    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-black">
                      {ex.video_url ? (
                        <video
                          className="aspect-video w-full object-cover"
                          src={ex.video_url}
                          controls
                          playsInline
                          loop
                          muted
                          preload="metadata"
                        />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ex.gif_url || `/demos/${ex.focus_tag}.svg`}
                          alt={ex.name}
                          className="aspect-video w-full object-contain bg-[var(--accent-soft)]"
                        />
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="font-medium">{ex.name}</div>
                      <span className="tag">{ex.focus_tag}</span>
                    </div>

                    <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
                      <div className="px-4 py-3">
                        <div className="text-sm font-medium" style={{ color: "var(--success)" }}>
                          What you did well
                        </div>
                        <p className="mt-1 text-[15px] muted">{exNotes.didWell}</p>
                      </div>
                      <div className="px-4 py-3">
                        <div className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                          What to improve
                        </div>
                        <p className="mt-1 text-[15px] muted">{exNotes.improve}</p>
                      </div>
                      <div className="px-4 py-3">
                        <div className="text-sm font-medium" style={{ color: "var(--danger)" }}>
                          Watch out for
                        </div>
                        <p className="mt-1 text-[15px] muted">{exNotes.watchOut}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {error && <div className="alert-error mt-6">{error}</div>}

      <div className="mt-10">
        <Link href={`/patient/${patientId}`} className="btn-nav">
          Back to my day
        </Link>
      </div>
    </main>
  );
}
