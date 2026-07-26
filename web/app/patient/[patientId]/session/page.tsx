"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Brand from "@/components/Brand";
import ExerciseDemo from "@/components/ExerciseDemo";
import SessionReviewReport from "@/components/SessionReviewReport";
import { api, DailyPlan, DailyExercise, PerfIn } from "@/lib/api";
import {
  speakAsync,
  stopSpeaking,
  canSpeak,
  warmVoices,
  currentVoiceName,
} from "@/lib/voiceCoach";
import { buildRepScript, scriptDuration, ScriptLine } from "@/lib/liveCoach";
import {
  listenForGo,
  ListenSession,
  speechListenSupported,
} from "@/lib/listenForGo";
import { ensureMicrophone, isSecureMediaContext } from "@/lib/mediaPermissions";
import { isPatientAuthed } from "@/lib/auth";

type Phase = "intro" | "waiting" | "drilling" | "resting" | "idle";

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
  const [phase, setPhase] = useState<Phase>("idle");
  const [heardPartial, setHeardPartial] = useState("");
  const [liveFeed, setLiveFeed] = useState<string[]>([]);
  const [voiceName, setVoiceName] = useState<string | null>(null);
  const [micFallback, setMicFallback] = useState(false);
  const [mediaHint, setMediaHint] = useState("");

  const startedRef = useRef(false);
  const mutedRef = useRef(false);
  const idxRef = useRef(0);
  const dailyRef = useRef<DailyPlan | null>(null);
  const perfRef = useRef<PerfIn[]>([]);
  const cueLogRef = useRef<string[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const exerciseGenRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);
  const intervalRef = useRef<number | null>(null);
  const listenRef = useRef<ListenSession<unknown> | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);
  useEffect(() => {
    idxRef.current = idx;
  }, [idx]);
  useEffect(() => {
    dailyRef.current = daily;
  }, [daily]);
  useEffect(() => {
    perfRef.current = perf;
  }, [perf]);
  useEffect(() => {
    cueLogRef.current = cueLog;
  }, [cueLog]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const logCue = useCallback((text: string) => {
    setCueLog((l) => {
      const next = [...l, text];
      cueLogRef.current = next;
      return next;
    });
  }, []);

  const say = useCallback(
    async (text: string) => {
      logCue(text);
      if (!mutedRef.current) await speakAsync(text);
    },
    [logCue]
  );

  const clearTimers = useCallback(() => {
    timeoutsRef.current.forEach((id) => window.clearTimeout(id));
    timeoutsRef.current = [];
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cancelListen = useCallback(() => {
    listenRef.current?.stop();
    listenRef.current = null;
    setHeardPartial("");
  }, []);

  const resetVoice = useCallback(() => {
    clearTimers();
    cancelListen();
    stopSpeaking();
    setCountdown(null);
    setLiveFeed([]);
    setMicFallback(false);
  }, [clearTimers, cancelListen]);

  const finishSession = useCallback(async (finalPerf: PerfIn[]) => {
    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      const avg =
        finalPerf.reduce((a, p) => a + (p.score ?? 0), 0) / Math.max(1, finalPerf.length);
      await say("Session complete. Great work today.");
      await api.completeSession(sid, {
        spoken_cues: cueLogRef.current,
        feedback: { avg_score: Number(avg.toFixed(2)) },
        performance: finalPerf,
      });
      setDone(true);
      setPhase("idle");
    } catch (e) {
      setError(String(e));
    }
  }, [say]);

  const completeExercise = useCallback(
    async (exercise: DailyExercise, gen: number) => {
      if (gen !== exerciseGenRef.current) return;
      cancelListen();
      const entry: PerfIn = {
        exercise_id: exercise.template_id,
        exercise_name: exercise.name,
        focus_tag: exercise.focus_tag,
        completed: true,
        score: 0.8,
        difficulty: exercise.difficulty,
        notes: "Completed with guided coaching",
      };
      const nextPerf = [...perfRef.current, entry];
      setPerf(nextPerf);
      perfRef.current = nextPerf;

      const plan = dailyRef.current;
      const nextIdx = idxRef.current + 1;
      if (plan && nextIdx < plan.exercises.length) {
        setPhase("resting");
        setCountdown(5);
        await say("Great work. Rest for five seconds.");
        if (gen !== exerciseGenRef.current) return;

        intervalRef.current = window.setInterval(() => {
          setCountdown((c) => {
            if (c === null || c <= 1) {
              if (intervalRef.current !== null) {
                window.clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
              return null;
            }
            return c - 1;
          });
        }, 1000);

        const restId = window.setTimeout(() => {
          if (gen !== exerciseGenRef.current) return;
          if (intervalRef.current !== null) {
            window.clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setCountdown(null);
          setIdx(nextIdx);
        }, 5000);
        timeoutsRef.current.push(restId);
      } else {
        await finishSession(nextPerf);
      }
    },
    [cancelListen, finishSession, say]
  );

  const beginReps = useCallback(
    async (gen: number, exercise: DailyExercise) => {
      if (gen !== exerciseGenRef.current) return;
      clearTimers();
      cancelListen();
      stopSpeaking();

      const lines: ScriptLine[] = buildRepScript(exercise);
      const total = scriptDuration(lines);

      setPhase("drilling");
      setHeardPartial("");
      setMicFallback(false);
      setLiveFeed([]);
      setCountdown(total);

      lines.forEach((line) => {
        const id = window.setTimeout(() => {
          if (gen !== exerciseGenRef.current) return;
          setLiveFeed((f) => [...f, line.text]);
          logCue(line.text);
          if (!mutedRef.current) void speakAsync(line.text);
        }, line.at * 1000);
        timeoutsRef.current.push(id);
      });

      intervalRef.current = window.setInterval(() => {
        setCountdown((c) => {
          if (c === null || c <= 1) {
            if (intervalRef.current !== null) {
              window.clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return null;
          }
          return c - 1;
        });
      }, 1000);

      const endId = window.setTimeout(() => {
        if (gen !== exerciseGenRef.current) return;
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setCountdown(null);
        void completeExercise(exercise, gen);
      }, total * 1000);
      timeoutsRef.current.push(endId);
    },
    [cancelListen, clearTimers, completeExercise, logCue]
  );

  const armGo = useCallback(
    async (gen: number, exercise: DailyExercise) => {
      if (gen !== exerciseGenRef.current) return;
      setPhase("waiting");
      setHeardPartial("");
      setMicFallback(false);
      setMediaHint("");

      if (!isSecureMediaContext()) {
        setMicFallback(true);
        setMediaHint(
          "Open this app over HTTPS (use the tunnel link) so iPhone can show mic permission."
        );
        return;
      }

      // iPhone Safari has no SpeechRecognition. Always show Go; try listen on Chrome/desktop.
      if (!speechListenSupported()) {
        setMicFallback(true);
        setMediaHint('Tap Go when ready (iPhone uses tap; say "go" works on desktop Chrome).');
        return;
      }

      await new Promise((r) => window.setTimeout(r, 400));
      if (gen !== exerciseGenRef.current) return;

      const session = listenForGo({
        onHeard: (t) => setHeardPartial(t),
        onError: () => setMicFallback(true),
      });
      listenRef.current = session as ListenSession<unknown>;
      const outcome = await session.result;
      if (gen !== exerciseGenRef.current) return;
      if (outcome === "heard") {
        await beginReps(gen, exercise);
      } else if (outcome === "unsupported") {
        setMicFallback(true);
      }
    },
    [beginReps]
  );

  const startExercise = useCallback(
    async (exercise: DailyExercise) => {
      const gen = ++exerciseGenRef.current;
      resetVoice();
      setPhase("intro");
      setLiveFeed([]);

      await say(
        `Next: ${exercise.name}. ${exercise.instructions} Say go when you're ready.`
      );
      if (gen !== exerciseGenRef.current) return;
      await armGo(gen, exercise);
    },
    [armGo, resetVoice, say]
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  // Always stop coaching audio / mic / timers when leaving this page.
  useEffect(() => {
    return () => {
      exerciseGenRef.current += 1;
      clearTimers();
      cancelListen();
      stopSpeaking();
    };
  }, [cancelListen, clearTimers]);

  // Leaving live mode for Nuroport (same route) must also kill the coach.
  useEffect(() => {
    if (!reviewMode && !done) return;
    exerciseGenRef.current += 1;
    resetVoice();
  }, [reviewMode, done, resetVoice]);

  const current: DailyExercise | undefined = daily?.exercises[idx];

  useEffect(() => {
    if (!current || reviewMode || done) return;
    void startExercise(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, daily?.id]);

  function leaveSession() {
    exerciseGenRef.current += 1;
    resetVoice();
    router.push(`/patient/${patientId}`);
  }

  async function manualGo() {
    if (!current) return;
    const gen = exerciseGenRef.current;
    // User gesture: this is when iOS will show the mic allow prompt.
    const mic = await ensureMicrophone();
    if (mic === "insecure") {
      setMediaHint("Mic needs HTTPS. Use the https://…trycloudflare.com link on your phone.");
    } else if (mic === "denied") {
      setMediaHint("Mic blocked. Enable it in Settings → Safari → Microphone, then try again.");
    }
    await beginReps(gen, current);
  }

  if (error) {
    return (
      <main className="shell shell-patient">
        <div className="alert-error">{error}</div>
        <Link href={`/patient/${patientId}`} className="btn-ghost mt-4">
          ← Back
        </Link>
      </main>
    );
  }

  if (reviewMode && daily) {
    return <SessionReviewReport patientId={patientId} daily={daily} />;
  }

  if (done) {
    const avg = perf.reduce((a, p) => a + (p.score ?? 0), 0) / Math.max(1, perf.length);
    return (
      <main className="shell shell-patient text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--success-soft)] text-2xl font-semibold text-[var(--success)]">
          ✓
        </div>
        <h1 className="page-title">Session complete</h1>
        <p className="mx-auto mt-3 max-w-md muted">
          Average performance {Math.round(avg * 100)}%. Your Nuroport is ready with form clips and coaching notes.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href={`/patient/${patientId}/session?review=1`} className="btn-primary">
            View Nuroport
          </Link>
          <Link href={`/patient/${patientId}`} className="btn-ghost">
            Back to my day
          </Link>
        </div>
      </main>
    );
  }

  if (!daily || (!reviewMode && !current)) {
    return <main className="shell shell-patient muted">Preparing your session…</main>;
  }

  if (!current) {
    return <main className="shell shell-patient muted">Preparing your session…</main>;
  }

  return (
    <main className="shell shell-patient">
      <div className="topbar">
        <Brand size={28} />
        <button
          className="btn-ghost"
          onClick={() => {
            setMuted((m) => {
              const next = !m;
              mutedRef.current = next;
              if (next) stopSpeaking();
              return next;
            });
          }}
        >
          {muted ? "Voice off" : "Voice on"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="btn-nav" onClick={leaveSession}>
          ← Exit session
        </button>
        <div className="text-sm muted">
          Live session · Exercise {idx + 1} of {daily.exercises.length}
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
        </div>

        <ExerciseDemo
          className="mt-5"
          name={current.name}
          focusTag={current.focus_tag}
          videoUrl={current.video_url}
          gifUrl={current.gif_url}
          mode="live"
        />

        {phase === "intro" ? (
          <div className="mt-8 text-center muted text-sm">Coach is briefing you…</div>
        ) : phase === "waiting" ? (
          <div className="mt-8 text-center">
            <div className="mx-auto mb-4 h-3 w-3 animate-pulse rounded-full bg-[var(--accent)]" />
            <p className="section-title text-xl">Say &ldquo;go&rdquo; when you&apos;re ready</p>
            <p className="mt-2 text-sm muted">
              {mediaHint
                ? mediaHint
                : micFallback
                  ? "Tap Go to start (and allow the mic if asked)."
                  : heardPartial
                    ? `Heard: "${heardPartial}"`
                    : "Listening…"}
            </p>
            <button className="btn-primary mt-6" onClick={() => void manualGo()}>
              Go
            </button>
          </div>
        ) : phase === "drilling" ? (
          <div className="mt-8">
            <div className="text-center text-6xl font-semibold tabular-nums text-[var(--accent)]">
              {countdown ?? 0}
            </div>
            <div className="mt-6">
              <div className="label">Live coaching</div>
              <div className="space-y-2">
                {liveFeed.length === 0 && (
                  <p className="muted text-sm">Starting your reps…</p>
                )}
                {liveFeed
                  .slice(-4)
                  .reverse()
                  .map((line, i) => (
                    <p
                      key={`${liveFeed.length}-${i}`}
                      className={
                        i === 0 ? "text-lg text-[var(--foreground)]" : "text-sm muted"
                      }
                    >
                      {line}
                    </p>
                  ))}
              </div>
            </div>
          </div>
        ) : phase === "resting" ? (
          <div className="mt-8 text-center">
            <p className="section-title text-xl">Rest before the next exercise</p>
            <div className="mt-4 text-6xl font-semibold tabular-nums text-[var(--accent)]">
              {countdown ?? 0}
            </div>
            <p className="mt-3 text-sm muted">The next exercise starts automatically.</p>
          </div>
        ) : null}
      </div>

      {!canSpeak() && (
        <div className="mt-4 text-sm text-amber-800">
          Voice not supported in this browser. On-screen cues only.
        </div>
      )}
      {canSpeak() && voiceName && (
        <div className="mt-4 text-sm muted">Voice: {voiceName} · hands-free</div>
      )}
    </main>
  );
}
