"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Brand from "@/components/Brand";
import { api, Patient, WeeklyReport } from "@/lib/api";
import { isDoctorAuthed } from "@/lib/auth";

const FOCUS_OPTIONS = ["balance", "dexterity", "strength", "mobility", "memory", "proprioception"];

export default function DoctorPatientPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [doctorId, setDoctorId] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearingReview, setClearingReview] = useState(false);

  const [focus, setFocus] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [freq, setFreq] = useState(5);
  const [minutes, setMinutes] = useState(15);

  async function load() {
    try {
      const [p, reps, doc] = await Promise.all([
        api.getPatient(patientId),
        api.weeklyReports(patientId),
        api.getDoctor(),
      ]);
      setPatient(p);
      setReports(reps);
      setDoctorId(doc.id);
      if (p.plan) {
        setFocus(p.plan.focus_tags);
        setNotes(p.plan.notes);
        setFreq(p.plan.frequency_per_week);
        setMinutes(p.plan.session_minutes);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    if (!isDoctorAuthed()) {
      router.replace("/doctor");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  function toggleFocus(tag: string) {
    setSaved(false);
    setFocus((f) => (f.includes(tag) ? f.filter((x) => x !== tag) : [...f, tag]));
  }

  async function clearReview() {
    setClearingReview(true);
    try {
      const p = await api.clearReview(patientId);
      setPatient(p);
    } catch (e) {
      setError(String(e));
    } finally {
      setClearingReview(false);
    }
  }

  async function savePlan() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.savePlan(patientId, {
        focus_tags: focus,
        notes,
        frequency_per_week: freq,
        session_minutes: minutes,
      });
      await load();
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  if (!patient) {
    return (
      <main className="shell">
        <Link href="/doctor" className="nav-back">
          ← Patients
        </Link>
        <div className="mt-6 muted">{error || "Loading…"}</div>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Brand size={28} />
        <Link href="/doctor" className="nav-back">
          Patients
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{patient.name}</h1>
          <p className="mt-2 muted">{patient.notes}</p>
        </div>
        <button className="btn-ghost shrink-0" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {patient.review_requested && (
        <div className="alert-error mt-4 flex flex-wrap items-center justify-between gap-3">
          <span>
            ⚠ {patient.name} requested a review
            {patient.review_requested_at
              ? ` (${new Date(patient.review_requested_at).toLocaleString()})`
              : ""}
            .
          </span>
          <button className="btn-ghost shrink-0" onClick={clearReview} disabled={clearingReview}>
            {clearingReview ? "Clearing…" : "Mark reviewed"}
          </button>
        </div>
      )}

      <section className="card mt-8">
        <h2 className="section-title">Care plan</h2>
        <div className="mt-4">
          <div className="label">Focus areas</div>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => toggleFocus(t)}
                className={`tag ${focus.includes(t) ? "tag-active" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="label">Sessions / week</div>
            <input
              type="number"
              min={1}
              max={7}
              className="input"
              value={freq}
              onChange={(e) => {
                setSaved(false);
                setFreq(Number(e.target.value));
              }}
            />
          </div>
          <div>
            <div className="label">Minutes / session</div>
            <input
              type="number"
              min={5}
              max={60}
              className="input"
              value={minutes}
              onChange={(e) => {
                setSaved(false);
                setMinutes(Number(e.target.value));
              }}
            />
          </div>
        </div>
        <div className="mt-4">
          <div className="label">Clinical notes</div>
          <textarea
            className="input min-h-20"
            value={notes}
            onChange={(e) => {
              setSaved(false);
              setNotes(e.target.value);
            }}
          />
        </div>
        <button className="btn-primary mt-4" onClick={savePlan} disabled={saving}>
          {saving ? "Saving…" : "Save plan"}
        </button>
        {saved && <div className="alert-success">Plan saved successfully.</div>}
      </section>

      <section className="mt-8">
        <h2 className="section-title">Weekly reports</h2>
        <p className="mt-2 text-[15px] muted">
          Review adherence, focus progress and sleep, then sign off to guide next week.
        </p>
        <div className="mt-4 space-y-4">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} doctorId={doctorId} onSigned={load} />
          ))}
          {reports.length === 0 && <div className="muted">No reports yet.</div>}
        </div>
      </section>
    </main>
  );
}

function ReportCard({
  report,
  doctorId,
  onSigned,
}: {
  report: WeeklyReport;
  doctorId: string;
  onSigned: () => void;
}) {
  const [notes, setNotes] = useState(report.doctor_notes || "");
  const [busy, setBusy] = useState(false);
  const s = report.summary;
  const signed = report.status === "signed";

  const sleep = useMemo(() => {
    const w = s.wellness;
    if (!w || w.avg_sleep_hours == null) return "No sleep data";
    return `${w.avg_sleep_hours}h avg over ${w.nights_logged} nights (quality ${
      w.avg_sleep_quality ?? "–"
    }/5)`;
  }, [s]);

  async function sign() {
    setBusy(true);
    try {
      await api.signReport(report.id, doctorId, notes);
      onSigned();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3">
        <div className="font-medium">Week of {report.week_start}</div>
        <span className={signed ? "badge-signed" : "badge-draft"}>
          {signed ? "Signed" : "Awaiting review"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Sessions" value={`${s.sessions_completed}/${s.sessions_planned}`} />
        <Metric label="Adherence" value={s.adherence_pct != null ? `${s.adherence_pct}%` : "–"} />
        <Metric label="Sleep" value={sleep} small />
      </div>

      <div className="mt-5">
        <div className="label">Focus progress</div>
        <div className="space-y-2.5">
          {s.focus_progress.map((f) => (
            <div key={f.focus} className="flex items-center gap-3">
              <div className="w-24 text-sm capitalize">{f.focus}</div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${Math.round((f.avg_score ?? 0) * 100)}%` }}
                />
              </div>
              <div className="w-12 text-right text-xs muted">
                {f.avg_score != null ? `${Math.round(f.avg_score * 100)}%` : "–"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="label">
          Clinician notes {signed ? "" : "(guides next week’s adaptation)"}
        </div>
        <textarea
          className="input min-h-16"
          value={notes}
          disabled={signed}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Emphasise balance and proprioception this week."
        />
      </div>

      {signed ? (
        <div className="mt-3 text-xs font-medium text-[var(--success)]">
          Signed {report.signed_at ? new Date(report.signed_at).toLocaleString() : ""}
        </div>
      ) : (
        <button className="btn-primary mt-4" onClick={sign} disabled={busy}>
          {busy ? "Signing…" : "Sign off report"}
        </button>
      )}
    </div>
  );
}

function Metric({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="metric">
      <div className="label mb-1">{label}</div>
      <div className={small ? "text-sm leading-snug" : "text-xl font-semibold"}>{value}</div>
    </div>
  );
}
