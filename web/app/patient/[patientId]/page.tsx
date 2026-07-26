"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Brand from "@/components/Brand";
import PatientAvatar from "@/components/PatientAvatar";
import PatientTabBar from "@/components/PatientTabBar";
import RingProgress from "@/components/dashboard/RingProgress";
import Sparkline from "@/components/dashboard/Sparkline";
import { api, Patient, DailyPlan } from "@/lib/api";
import { PATIENT_DEMO } from "@/lib/demoMetrics";
import { isPatientAuthed } from "@/lib/auth";
import { ensureCamera, ensureMicrophone, isSecureMediaContext } from "@/lib/mediaPermissions";
import { listenForGlassesOn, listenForScanStop, speechListenSupported, type ListenSession } from "@/lib/listenForGo";
import { speakAsync, stopSpeaking, warmVoices } from "@/lib/voiceCoach";

const PROP_OPTIONS = [
  "chair",
  "table",
  "wall",
  "open_floor",
  "cushion",
  "mat",
  "tape",
  "ball",
  "paper",
  "coins",
  "pegboard",
  "button_board",
  "rubber_band",
  "clothespin",
  "cards",
  "tweezers",
  "resistance_band",
  "stress_ball",
  "obstacles",
  "step",
  "bike",
  "arm_ergometer",
  "pool",
  "couch",
];

const HOUR_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
};

function sleepPhrase(hours: number | null | undefined): string {
  if (hours == null) return "";
  const whole = Math.floor(hours);
  const half = hours - whole >= 0.4;
  const word = HOUR_WORDS[whole] || String(whole);
  if (half) return `${word} and a half hours of sleep last night`;
  return `${word} hour${whole === 1 ? "" : "s"} of sleep last night`;
}

// Spoofed result of the "AI room scan" for the demo.
const SCAN_RESULT = ["chair", "table", "wall", "open_floor", "couch"];

export default function PatientHome() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [daily, setDaily] = useState<DailyPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [props, setProps] = useState<string[]>([]);
  const [envSaved, setEnvSaved] = useState(false);
  const [scanState, setScanState] = useState<
    "idle" | "choosing" | "glasses" | "recording" | "analysing" | "done"
  >("idle");
  const [scanStep, setScanStep] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [camHint, setCamHint] = useState("");
  const [heardLine, setHeardLine] = useState("");
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const glassesListenRef = useRef<ListenSession<"heard"> | null>(null);
  const scanStopListenRef = useRef<ListenSession<"heard"> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    try {
      const p = await api.getPatient(patientId);
      setPatient(p);
      const latest = p.environment?.[0];
      if (latest) setProps(latest.tags);
      const dp = await api.getDailyPlan(patientId);
      setDaily(dp);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    if (!isPatientAuthed(patientId)) {
      router.replace("/patient");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  useEffect(() => {
    return () => {
      glassesListenRef.current?.stop();
      scanStopListenRef.current?.stop();
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      stopSpeaking();
      stopWebcamTracks();
    };
  }, []);

  useEffect(() => {
    if (scanState !== "recording") return;
    const el = previewRef.current;
    const stream = streamRef.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    void el.play().catch(() => undefined);
  }, [scanState]);

  function stopWebcamTracks() {
    recorderRef.current = null;
    chunksRef.current = [];
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((t) => t.stop());
    if (previewRef.current) {
      previewRef.current.srcObject = null;
    }
    setIsCapturing(false);
  }

  function toggleProp(p: string) {
    setEnvSaved(false);
    setProps((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function saveEnv() {
    setBusy(true);
    setError("");
    setEnvSaved(false);
    try {
      await api.addEnvironment(patientId, { media_url: "webcam://scan", tags: props });
      await load();
      setEnvSaved(true);
      setTimeout(() => setEnvSaved(false), 4000);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Fake AI analysis of the uploaded/recorded room video, hardcoded for the demo.
  function analyseVideo(file: File | null) {
    if (!file) return;
    setEnvSaved(false);
    setCamHint("");
    setScanState("analysing");
    const steps = [
      "Streaming from Meta glasses…",
      "Detecting surfaces and furniture…",
      "Measuring clear floor space…",
      "Matching props to your exercise library…",
    ];
    steps.forEach((s, i) => setTimeout(() => setScanStep(s), i * 900));
    setTimeout(() => {
      setProps((cur) => Array.from(new Set([...cur, ...SCAN_RESULT])));
      setScanState("done");
    }, steps.length * 900 + 400);
  }

  async function openWebcam() {
    setCamHint("");
    setError("");
    if (!isSecureMediaContext()) {
      setCamHint("Camera needs HTTPS (or localhost). Open the secure tunnel URL on your phone.");
      setScanState("choosing");
      return;
    }
    const status = await ensureCamera();
    if (status !== "granted") {
      setCamHint("Camera permission denied. Allow camera access and try again.");
      setScanState("choosing");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setScanState("recording");
      await runHandsFreeRecording();
    } catch {
      setCamHint("Couldn’t open the glasses camera. Check permissions and try again.");
      setScanState("choosing");
    }
  }

  async function runHandsFreeRecording() {
    await speakAsync(
      "Looking through your Meta glasses now. Slowly turn and look around the room. Say done when you're finished."
    );
    startCapture();

    if (!speechListenSupported()) {
      // Still auto-stop after a short scan if voice isn't available.
      autoStopTimerRef.current = setTimeout(() => stopCapture(), 10000);
      return;
    }

    const session = listenForScanStop({
      onHeard: (t) => setHeardLine(t),
      onError: (m) => setCamHint(m),
    });
    scanStopListenRef.current = session;
    autoStopTimerRef.current = setTimeout(() => {
      scanStopListenRef.current?.stop();
      stopCapture();
    }, 12000);

    const result = await session.result;
    scanStopListenRef.current = null;
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (result === "heard") {
      setHeardLine("");
      stopCapture();
    }
  }

  async function startGlassesPrompt() {
    setCamHint("");
    setHeardLine("");
    setError("");
    glassesListenRef.current?.stop();
    scanStopListenRef.current?.stop();
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    stopSpeaking();

    if (!isSecureMediaContext()) {
      setCamHint("Mic and camera need HTTPS (or localhost). Open the secure tunnel URL.");
      return;
    }

    setScanState("glasses");
    await warmVoices();

    const mic = await ensureMicrophone();
    if (mic !== "granted") {
      setCamHint("Microphone permission needed for the glasses scan. Allow mic access and try again.");
      setScanState("choosing");
      return;
    }

    if (!speechListenSupported()) {
      setCamHint("Voice listen isn't available in this browser. Try uploading a video instead.");
      setScanState("choosing");
      return;
    }

    const prompt =
      "Put on your Meta glasses, then say okay when they're on, and I'll start the room scan through them.";
    await speakAsync(prompt);

    const session = listenForGlassesOn({
      onHeard: (t) => setHeardLine(t),
      onError: (m) => setCamHint(m),
    });
    glassesListenRef.current = session;
    const result = await session.result;
    glassesListenRef.current = null;
    if (result === "heard") {
      setHeardLine("");
      await openWebcam();
    }
  }

  function startCapture() {
    const stream = streamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
        ? "video/webm"
        : MediaRecorder.isTypeSupported("video/mp4")
          ? "video/mp4"
          : "";
    try {
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || "video/webm";
        const blob = new Blob(chunksRef.current, { type });
        stopWebcamTracks();
        const ext = type.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `room-scan.${ext}`, { type });
        analyseVideo(file);
      };
      recorder.start(200);
      setIsCapturing(true);
    } catch {
      setCamHint("Recording isn’t supported in this browser. Try uploading a video instead.");
      setScanState("choosing");
    }
  }

  function stopCapture() {
    scanStopListenRef.current?.stop();
    scanStopListenRef.current = null;
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    } else {
      stopWebcamTracks();
      setScanState("choosing");
    }
  }

  async function generate(regenerate: boolean) {
    setBusy(true);
    setError("");
    try {
      const dp = await api.generateDailyPlan(patientId, regenerate);
      setDaily(dp);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const completedToday =
    !!daily &&
    (patient?.recent_sessions || []).some(
      (s) => s.daily_plan_id === daily.id && !!s.completed_at
    );

  if (!patient) {
    return (
      <main className="patient-today">
        <Link href="/patient" className="nav-back">
          ← Switch profile
        </Link>
        <div className="mt-6 muted">{error || "Loading…"}</div>
      </main>
    );
  }

  const watchOn = !!patient.watch_connected;
  const wellness = patient.latest_wellness;
  const firstName = patient.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const demo = PATIENT_DEMO;
  const progressPct = completedToday ? 100 : demo.dailyGoal;

  return (
    <main className="patient-today">
      <div className="flex items-center justify-between">
        <Brand size={26} />
        <Link href={`/patient/${patientId}/settings`} className="btn-nav" aria-label="Settings">
          ⚙
        </Link>
      </div>

      <p className="mt-6 text-[15px] muted">
        {greeting}, {firstName}
      </p>
      <h1 className="page-title" style={{ marginTop: "0.15rem" }}>
        Today
      </h1>
      <p className="mt-2 text-[15px] muted">You&apos;ve got this. Let&apos;s keep moving forward.</p>

      {error && <div className="alert-error">{error}</div>}

      <section className="dash-card mt-6">
        <div className="flex items-center gap-4">
          <RingProgress value={progressPct} label="of daily goal" size={112} stroke={9} />
          <div className="min-w-0 flex-1 space-y-3 text-[14px]">
            <div className="flex items-center justify-between gap-2">
              <span className="muted">Sessions</span>
              <span className="font-medium">
                {completedToday ? demo.sessionsTarget : demo.sessionsDone} / {demo.sessionsTarget}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="muted">Exercises</span>
              <span className="font-medium">
                {demo.exerciseMin} / {demo.exerciseTarget} min
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="muted">Streak</span>
              <span className="font-medium">{demo.streak} days</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <h2 className="section-title">Today&apos;s Session</h2>
          <button className="text-sm font-medium" style={{ color: "var(--accent)" }} onClick={() => generate(!!daily)} disabled={busy}>
            {daily ? "Refresh" : "Prepare"}
          </button>
        </div>

        <div className="dash-card mt-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-medium" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
                {demo.sessionName}
              </div>
              <div className="mt-1 text-[14px] muted">
                {daily
                  ? `${daily.exercises.length} exercises · ${(patient.plan?.focus_tags || []).slice(0, 2).join(" & ") || "Rehab"}`
                  : demo.sessionMeta}
              </div>
              <div className="mt-2 text-[13px] muted">{demo.sessionTime}</div>
            </div>
            {patient.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={patient.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover border border-[var(--border)]" />
            ) : (
              <PatientAvatar name={patient.name} size={48} />
            )}
          </div>

          {daily && (
            <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
              {daily.exercises.slice(0, 3).map((ex, i) => (
                <div key={i} className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ex.gif_url || `/demos/${ex.focus_tag}.svg`}
                    alt=""
                    className="h-12 w-12 rounded-lg border border-[var(--border)] object-contain bg-white"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium">{ex.name}</div>
                    <div className="text-[12px] muted capitalize">{ex.focus_tag} · {ex.reps} reps</div>
                  </div>
                </div>
              ))}
              {daily.exercises.length > 3 && (
                <div className="text-[13px] muted">+{daily.exercises.length - 3} more in session</div>
              )}
            </div>
          )}

          {completedToday ? (
            <div className="mt-5 flex flex-col gap-2">
              <button className="btn-ink w-full" onClick={() => router.push(`/patient/${patientId}/session?review=1`)}>
                View Nuroport →
              </button>
              <button className="btn-ghost w-full" onClick={() => router.push(`/patient/${patientId}/session`)}>
                Run live session again
              </button>
            </div>
          ) : (
            <button
              className="btn-ink mt-5 w-full"
              onClick={() => {
                if (!daily) void generate(false);
                router.push(`/patient/${patientId}/session`);
              }}
              disabled={busy}
            >
              Start Session →
            </button>
          )}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-3 gap-2">
        {(
          [
            { title: "Sleep Quality", m: demo.sleep, color: "var(--blue)" },
            { title: "Balance", m: demo.balance, color: "var(--success)" },
            { title: "Cognitive", m: demo.cognitive, color: "var(--blue)" },
          ] as const
        ).map((card) => (
          <div key={card.title} className="dash-card !p-3">
            <div className="text-[11px] muted leading-tight">{card.title}</div>
            <div className="mt-1 text-lg font-medium tabular-nums" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
              {card.m.score}
              <span className="text-xs muted">/100</span>
            </div>
            <div className="dash-delta-up mt-0.5 text-[10px]">+{card.m.delta} pts</div>
            <Sparkline values={card.m.spark} color={card.color} className="mt-2 !h-5 !w-full" />
          </div>
        ))}
      </section>

      <section className="mt-4 space-y-2">
        <div className="dash-card flex items-center justify-between gap-3 !py-3">
          <div>
            <div className="text-[14px] font-medium">Wearable {watchOn ? "connected" : "not connected"}</div>
            <div className="text-[12px] muted">
              {watchOn
                ? wellness?.sleep_hours != null
                  ? `Synced · ${sleepPhrase(wellness.sleep_hours)}`
                  : "Synced just now"
                : "Connect in Profile"}
            </div>
          </div>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              background: watchOn ? "var(--success-soft)" : "var(--danger-soft)",
              color: watchOn ? "var(--success)" : "var(--danger)",
            }}
          >
            {watchOn ? "✓" : "!"}
          </span>
        </div>
        <Link href={`/patient/${patientId}/session?review=1`} className="dash-card flex items-center justify-between gap-3 !py-3">
          <div>
            <div className="text-[14px] font-medium">Share with clinician</div>
            <div className="text-[12px] muted">Send your latest Nuroport securely</div>
          </div>
          <span className="muted">›</span>
        </Link>
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-8">
        <h2 className="section-title">Your space today</h2>
        <p className="mt-2 text-[15px] muted">
          Scan your room with Meta glasses, or tick what&apos;s nearby.
        </p>

        <input
          ref={uploadInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => {
            analyseVideo(e.target.files?.[0] || null);
            e.target.value = "";
          }}
        />

        {scanState === "analysing" ? (
          <div className="card-soft mt-4">
            <div className="flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 animate-ping rounded-full bg-[var(--accent)]" />
              <div className="font-medium">Analysing your space</div>
            </div>
            <p className="mt-2 text-[15px] muted">{scanStep || "Streaming from Meta glasses…"}</p>
          </div>
        ) : scanState === "glasses" ? (
          <div className="dash-card mt-4">
            <div className="font-medium">Put on your Meta glasses</div>
            <p className="mt-2 text-[15px] muted">
              Voice only. Put them on, then say <strong>okay</strong> or <strong>they&apos;re on</strong>.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)]" />
              <span className="text-[15px] muted">Listening…</span>
            </div>
            {heardLine && <p className="mt-2 text-sm muted">Heard: &ldquo;{heardLine}&rdquo;</p>}
            {camHint && (
              <p className="mt-3 text-[15px]" style={{ color: "var(--danger)" }}>
                {camHint}
              </p>
            )}
          </div>
        ) : scanState === "recording" ? (
          <div className="dash-card mt-4">
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium">Meta glasses feed</div>
              {isCapturing && (
                <span className="flex items-center gap-2 text-sm" style={{ color: "var(--danger)" }}>
                  <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--danger)]" />
                  Recording
                </span>
              )}
            </div>
            <p className="mt-1 text-[15px] muted">
              Look slowly around the room. Say <strong>done</strong> when finished.
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-black">
              <video ref={previewRef} className="aspect-video w-full object-cover" playsInline muted autoPlay />
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)]" />
              <span className="text-[15px] muted">Listening for done…</span>
            </div>
          </div>
        ) : scanState === "choosing" ? (
          <div className="dash-card mt-4">
            <div className="font-medium">How do you want to scan?</div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={() => void startGlassesPrompt()}>
                Scan with Meta glasses
              </button>
              <button className="btn-ghost" onClick={() => uploadInputRef.current?.click()}>
                Upload video
              </button>
              <button className="btn-ghost" onClick={() => setScanState("idle")}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-primary mt-4" onClick={() => setScanState("choosing")}>
            Scan my space with video
          </button>
        )}

        {scanState === "done" && (
          <div className="alert-success">
            Scan complete. We spotted: {SCAN_RESULT.map((p) => p.replace("_", " ")).join(", ")}.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {PROP_OPTIONS.map((p) => (
            <button key={p} onClick={() => toggleProp(p)} className={`tag ${props.includes(p) ? "tag-active" : ""}`}>
              {p.replace("_", " ")}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-ghost" onClick={saveEnv} disabled={busy}>
            {busy ? "Saving…" : "Save environment"}
          </button>
          {scanState === "done" && (
            <button className="btn-ghost" onClick={() => setScanState("choosing")} disabled={busy}>
              Rescan my space
            </button>
          )}
        </div>
        {envSaved && <div className="alert-success">Environment saved. Today&apos;s session will use it.</div>}
      </section>

      <PatientTabBar patientId={patientId} active="today" />
    </main>
  );
}
