"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Brand from "@/components/Brand";
import { api, DailyPlan, DailyExercise, PerfIn } from "@/lib/api";
import { speak, stopSpeaking, canSpeak, warmVoices, currentVoiceName } from "@/lib/voiceCoach";
import { isPatientAuthed } from "@/lib/auth";

type Rating = { label: string; score: number; completed: boolean };
const RATINGS: Rating[] = [
  { label: "Nailed it", score: 0.95, completed: true },
  { label: "OK", score: 0.7, completed: true },
  { label: "Struggled", score: 0.4, completed: true },
  { label: "Skipped", score: 0, completed: false },
];

export default function SessionRunner() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reviewMode = searchParams.get("review") === "1";
  const [daily, setDaily] = useState<DailyPlan | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [perf, setPerf] = useState<PerfIn[]>([]);
  const [cueLog, setCueLog] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const startedRef = useRef(false);

  const say = useCallback(
    (text: string) => {
      setCueLog((l) => [...l, text]);
      if (!muted) speak(text);
    },
    [muted]
  );

  useEffect(() => {
    if (!isPatientAuthed(patientId)) {
      router.replace("/patient");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        if (reviewMode) {
          const dp = await api.getDailyPlan(patientId);
          setDaily(dp);
          return;
        }
        const voice = await warmVoices();
        setVoiceName(voice?.name ?? currentVoiceName());
        const dp = await api.generateDailyPlan(patientId, false);
        setDaily(dp);
        const sess = await api.startSession(dp.id);
        setSessionId(sess.id);
      } catch (e) {
        setError(String(e));
      }
    })();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const current: DailyExercise | undefined = daily?.exercises[idx];

  useEffect(() => {
    if (!current || reviewMode) return;
    say(`Next: ${current.name}. ${current.instructions}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, daily]);

  function runHold() {
    if (!current) return;
    stopSpeaking();
    let n = current.hold_seconds;
    say(`Let's hold for ${n} seconds.`);
    setCountdown(n);
    const timer = setInterval(() => {
      n -= 1;
      setCountdown(n);
      if (n === 3 || n === 2 || n === 1) speak(String(n));
      if (n <= 0) {
        clearInterval(timer);
        setCountdown(null);
        say("Rest.");
      }
    }, 1000);
  }

  async function rate(r: Rating) {
    if (!current) return;
    stopSpeaking();
    const entry: PerfIn = {
      exercise_id: current.template_id,
      exercise_name: current.name,
      focus_tag: current.focus_tag,
      completed: r.completed,
      score: r.score,
      difficulty: current.difficulty,
      notes: r.label,
    };
    const nextPerf = [...perf, entry];
    setPerf(nextPerf);

    if (daily && idx + 1 < daily.exercises.length) {
      setIdx(idx + 1);
    } else {
      await finish(nextPerf);
    }
  }

  async function finish(finalPerf: PerfIn[]) {
    if (!sessionId) return;
    try {
      const avg =
        finalPerf.reduce((a, p) => a + (p.score ?? 0), 0) / Math.max(1, finalPerf.length);
      say("Session complete. Great work today.");
      await api.completeSession(sessionId, {
        spoken_cues: cueLog,
        feedback: { avg_score: Number(avg.toFixed(2)) },
        performance: finalPerf,
      });
      setDone(true);
    } catch (e) {
      setError(String(e));
    }
  }

  if (error) {
    return (
      <main className="shell">
        <div className="alert-error">{error}</div>
        <Link href={`/patient/${patientId}`} className="btn-ghost mt-4">
          ← Back
        </Link>
      </main>
    );
  }

  if (done) {
    const avg = perf.reduce((a, p) => a + (p.score ?? 0), 0) / Math.max(1, perf.length);
    return (
      <main className="shell text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-soft)] text-2xl font-semibold text-[var(--success)]">
          ✓
        </div>
        <h1 className="page-title">Session complete</h1>
        <p className="mx-auto mt-3 max-w-md muted">
          Average performance {Math.round(avg * 100)}%. This helps shape tomorrow&apos;s plan and
          your clinician&apos;s weekly report.
        </p>
        <div className="mt-8 flex justify-center">
          <Link href={`/patient/${patientId}`} className="btn-primary">
            Back to my day
          </Link>
        </div>
      </main>
    );
  }

  if (!daily || !current) {
    return <main className="shell muted">Preparing your session…</main>;
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Brand size={28} />
        <button className="btn-ghost" onClick={() => setMuted((m) => !m)}>
          {muted ? "Voice off" : "Voice on"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <Link href={`/patient/${patientId}`} className="nav-back">
          ← Exit session
        </Link>
        <div className="text-sm muted">
          Exercise {idx + 1} of {daily.exercises.length}
        </div>
      </div>

      <div className="mt-3 progress-track">
        <div
          className="progress-fill"
          style={{ width: `${(idx / daily.exercises.length) * 100}%` }}
        />
      </div>

      <div className="card mt-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="section-title text-2xl">{current.name}</h1>
          <span className="tag tag-active">{current.focus_tag}</span>
        </div>
        <p className="mt-2 muted">{current.instructions}</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs muted">
          <span>Difficulty {current.difficulty}/5</span>
          <span>{current.reps} reps</span>
          <span>{current.hold_seconds}s hold</span>
        </div>

        {current.video_url && (
          <video
            key={current.video_url}
            className="mt-5 w-full rounded-lg border border-[var(--border)]"
            src={current.video_url}
            controls
            playsInline
            loop
          />
        )}

        {!reviewMode && countdown !== null && (
          <div className="mt-8 text-center text-6xl font-semibold tabular-nums text-[var(--accent)]">
            {countdown}
          </div>
        )}
        {!reviewMode && countdown === null && (
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="btn-ghost" onClick={() => say(current.instructions)}>
              Repeat cue
            </button>
            <button className="btn-primary" onClick={runHold}>
              Start {current.hold_seconds}s hold
            </button>
          </div>
        )}

        {!reviewMode && current.cue_scripts.length > 0 && (
          <div className="mt-5">
            <div className="label">Coaching cues</div>
            <div className="flex flex-wrap gap-2">
              {current.cue_scripts.map((c, i) => (
                <button key={i} className="tag" onClick={() => say(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {reviewMode ? (
        <div className="mt-6 flex items-center justify-between gap-2">
          <button
            className="btn-ghost"
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            disabled={idx === 0}
          >
            ← Previous
          </button>
          {idx + 1 < daily.exercises.length ? (
            <button className="btn-primary" onClick={() => setIdx((i) => i + 1)}>
              Next →
            </button>
          ) : (
            <Link href={`/patient/${patientId}`} className="btn-primary">
              Done reviewing
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <div className="label">How did that go?</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RATINGS.map((r) => (
              <button
                key={r.label}
                className="btn-ghost"
                onClick={() => rate(r)}
                disabled={countdown !== null}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {!reviewMode && !canSpeak() && (
        <div className="mt-4 text-sm text-amber-800">
          Voice not supported in this browser. On-screen cues only.
        </div>
      )}
      {!reviewMode && canSpeak() && voiceName && (
        <div className="mt-4 text-sm muted">Voice: {voiceName}</div>
      )}
      {!reviewMode && canSpeak() && !voiceName && (
        <div className="mt-4 text-sm muted">
          Loading voice… Add ELEVENLABS_API_KEY in web/backend/.env for ElevenLabs
          (otherwise Samantha / system TTS is used).
        </div>
      )}
    </main>
  );
}
