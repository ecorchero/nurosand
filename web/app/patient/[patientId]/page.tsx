"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Brand from "@/components/Brand";
import { api, Patient, DailyPlan } from "@/lib/api";

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

export default function PatientHome() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [daily, setDaily] = useState<DailyPlan | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [props, setProps] = useState<string[]>([]);
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState(3);

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  function toggleProp(p: string) {
    setProps((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function saveEnv() {
    setBusy(true);
    setError("");
    try {
      await api.addEnvironment(patientId, { media_url: "webcam://scan", tags: props });
      await load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveWellness() {
    setBusy(true);
    setError("");
    try {
      await api.addWellness(patientId, {
        sleep_hours: sleepHours,
        sleep_quality: sleepQuality,
        source: "manual",
      });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
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

  if (!patient) {
    return (
      <main className="shell">
        <Link href="/patient" className="nav-back">
          ← Profiles
        </Link>
        <div className="mt-6 muted">{error || "Loading…"}</div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Brand size={28} />
        <Link href="/patient" className="nav-back">
          Profiles
        </Link>
      </div>

      <h1 className="page-title">Hi {patient.name.split(" ")[0]}</h1>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {(patient.plan?.focus_tags || []).map((t) => (
          <span key={t} className="tag">
            {t}
          </span>
        ))}
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section className="mt-10">
        <h2 className="section-title">Your space today</h2>
        <p className="mt-2 text-[15px] muted">
          Tick what&apos;s nearby so exercises match your room.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {PROP_OPTIONS.map((p) => (
            <button
              key={p}
              onClick={() => toggleProp(p)}
              className={`tag ${props.includes(p) ? "tag-active" : ""}`}
            >
              {p.replace("_", " ")}
            </button>
          ))}
        </div>
        <button className="btn-ghost mt-4" onClick={saveEnv} disabled={busy}>
          Save environment
        </button>
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-8">
        <h2 className="section-title">Last night&apos;s sleep</h2>
        <p className="mt-2 text-[15px] muted">
          Helps set today&apos;s intensity and shows on your weekly report.
        </p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2">
          <div>
            <div className="label">Hours: {sleepHours}</div>
            <input
              type="range"
              min={3}
              max={10}
              step={0.5}
              value={sleepHours}
              onChange={(e) => setSleepHours(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
          <div>
            <div className="label">Quality: {sleepQuality}/5</div>
            <input
              type="range"
              min={1}
              max={5}
              value={sleepQuality}
              onChange={(e) => setSleepQuality(Number(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>
        </div>
        <button className="btn-ghost mt-4" onClick={saveWellness} disabled={busy}>
          Log sleep
        </button>
      </section>

      <section className="mt-10 border-t border-[var(--border)] pt-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="section-title">Today&apos;s session</h2>
            {!daily && (
              <p className="mt-2 text-[15px] muted">
                Built from your plan, space, recent performance and sleep.
              </p>
            )}
          </div>
          <button className="btn-ghost shrink-0" onClick={() => generate(!!daily)} disabled={busy}>
            {daily ? "Refresh" : "Prepare"}
          </button>
        </div>

        {daily && (
          <>
            <p className="mt-4 text-[15px] muted">{daily.rationale}</p>
            <div className="mt-5 space-y-4">
              {daily.exercises.map((ex, i) => (
                <div key={i} className="border-b border-[var(--border)] pb-4 last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-bold">
                      {i + 1}. {ex.name}
                    </div>
                    <span className="tag">{ex.focus_tag}</span>
                  </div>
                  <div className="mt-1 text-[15px] muted">{ex.instructions}</div>
                  <div className="mt-2 flex flex-wrap gap-3 text-sm muted">
                    <span>Difficulty {ex.difficulty}/5</span>
                    <span>{ex.reps} reps</span>
                    <span>{ex.hold_seconds}s hold</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              className="btn-primary mt-6"
              onClick={() => router.push(`/patient/${patientId}/session`)}
              disabled={busy}
            >
              Start session with voice coach
            </button>
          </>
        )}
      </section>
    </main>
  );
}
