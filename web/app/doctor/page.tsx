"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";
import DoctorShell from "@/components/DoctorShell";
import PatientAvatar from "@/components/PatientAvatar";
import RingProgress from "@/components/dashboard/RingProgress";
import Sparkline from "@/components/dashboard/Sparkline";
import { api, Patient } from "@/lib/api";
import { DOCTOR_PASSWORD, clearDoctorAuthed, isDoctorAuthed, setDoctorAuthed } from "@/lib/auth";
import { fakeAdherence, fakeDetail, fakeSpark, fakeWeekSeries } from "@/lib/demoMetrics";

function conditionOf(p: Patient): string {
  const n = (p.notes || "").toLowerCase();
  if (n.includes("stroke")) return "Stroke";
  if (n.includes("tbi") || n.includes("brain")) return "TBI";
  if (n.includes("parkinson")) return "Parkinson's";
  const tag = p.plan?.focus_tags?.[0];
  return tag ? tag[0].toUpperCase() + tag.slice(1) : "Neurorehab";
}

function WeekChart({ patientName }: { patientName: string }) {
  const { labels, motor, balance, cognitive } = fakeWeekSeries(patientName);
  // Extra top room so the tip and peaks aren't clipped
  const w = 360;
  const h = 220;
  const padL = 28;
  const padR = 16;
  const padT = 28;
  const padB = 28;
  const max = 100;
  const toX = (i: number) => padL + (i / (labels.length - 1)) * (w - padL - padR);
  const toY = (v: number) => padT + (1 - v / max) * (h - padT - padB);
  const line = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(v)}`).join(" ");

  return (
    <div className="dash-card h-full overflow-visible">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="section-title text-lg">Weekly improvement</h3>
          <p className="mt-1 text-[13px] muted">{patientName}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px]">
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full" style={{ background: "var(--blue)" }} /> Motor
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full" style={{ background: "var(--success)" }} /> Balance
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="h-2 w-2 rounded-full" style={{ background: "var(--purple)" }} /> Cognitive
          </span>
        </div>
      </div>

      <div className="mt-2 overflow-visible">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full overflow-visible" style={{ maxHeight: 260 }}>
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={g}>
              <line
                x1={padL}
                x2={w - padR}
                y1={toY(g)}
                y2={toY(g)}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text x={padL - 6} y={toY(g) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
                {g}
              </text>
            </g>
          ))}
          <path d={line(motor)} fill="none" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={line(balance)} fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" />
          <path d={line(cognitive)} fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" />
          {labels.map((lab, i) => (
            <text key={lab} x={toX(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
              {lab}
            </text>
          ))}
          <circle cx={toX(6)} cy={toY(motor[6])} r="4" fill="var(--blue)" />
          <circle cx={toX(6)} cy={toY(balance[6])} r="4" fill="var(--success)" />
          <circle cx={toX(6)} cy={toY(cognitive[6])} r="4" fill="var(--purple)" />
        </svg>
      </div>

      <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-[12px]">
        <span className="font-medium">Sun · latest</span>
        <span className="muted">
          {" "}
          Motor {motor[6]} · Balance {balance[6]} · Cognitive {cognitive[6]}
        </span>
      </div>
    </div>
  );
}

export default function DoctorHome() {
  const [authed, setAuthed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctor, setDoctor] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function load() {
    try {
      const [ps, d] = await Promise.all([api.listPatients(), api.getDoctor()]);
      setPatients(ps);
      setDoctor(d);
      if (ps.length) {
        const q = ps.find((p) => p.name.toLowerCase().includes("quentin")) || ps[0];
        setSelectedId((cur) => cur || q.id);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    const ok = isDoctorAuthed();
    setAuthed(ok);
    setCheckedAuth(true);
    if (ok) load();
  }, []);

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (password.trim().toLowerCase() === DOCTOR_PASSWORD) {
      setDoctorAuthed();
      setAuthed(true);
      setAuthError("");
      load();
    } else {
      setAuthError("Incorrect password.");
    }
  }

  function logOut() {
    clearDoctorAuthed();
    setAuthed(false);
    setPassword("");
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.notes || "").toLowerCase().includes(q)
    );
  }, [patients, query]);

  // When searching, keep the main panel + chart on a patient that matches.
  useEffect(() => {
    if (!query.trim()) return;
    if (filtered.length && !filtered.some((p) => p.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [query, filtered, selectedId]);

  const selected = patients.find((p) => p.id === selectedId) || filtered[0] || null;
  const selectedAdherence = selected ? fakeAdherence(selected.name) : 78;

  if (!checkedAuth) {
    return <main className="shell shell-wide muted">Loading…</main>;
  }

  if (!authed) {
    return (
      <main className="shell shell-wide">
        <div className="topbar">
          <Brand size={28} />
          <Link href="/" className="nav-back">
            Home
          </Link>
        </div>
        <h1 className="page-title">Clinician sign-in</h1>
        <p className="mt-2 muted">Enter the clinician password to view patients.</p>
        <form onSubmit={submitPassword} className="card mt-8 max-w-sm">
          <div className="label">Password</div>
          <input
            type="password"
            autoFocus
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />
          {authError && <div className="alert-error mt-3">{authError}</div>}
          <button type="submit" className="btn-primary mt-4">
            Sign in
          </button>
        </form>
      </main>
    );
  }

  return (
    <DoctorShell doctorName={doctor?.name || "Dr. Lee"} onLogOut={logOut}>
      <div>
        <h1 className="page-title" style={{ marginTop: 0 }}>
          Welcome back,{" "}
          {doctor?.name?.split(" ").slice(-1)[0]
            ? `Dr. ${doctor.name.split(" ").slice(-1)[0]}`
            : "Doctor"}
        </h1>
        <p className="mt-2 muted">
          {patients.length} patient{patients.length === 1 ? "" : "s"} on your caseload. Select one
          to review progress.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            className="input max-w-xs"
            placeholder="Search patients"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Link href="/doctor/new" className="btn-ink shrink-0">
            + New Patient
          </Link>
        </div>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="mt-6 grid gap-4 xl:grid-cols-12">
        <section className="dash-card xl:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-lg">Patients</h2>
            <span className="text-sm muted">{filtered.length}</span>
          </div>
          <div className="mt-3 max-h-[28rem] space-y-1 overflow-y-auto">
            {filtered.map((p) => {
              const adh = fakeAdherence(p.name);
              const active = selected?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition ${
                    active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--background)]"
                  }`}
                >
                  <PatientAvatar name={p.name} size={40} src={p.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-medium">{p.name}</div>
                    <div className="truncate text-[12px] muted">{conditionOf(p)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-medium">{adh}%</div>
                    <Sparkline values={fakeSpark(adh)} className="!h-5 !w-12" />
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="muted py-6 text-center text-sm">No patients found</div>
            )}
          </div>
        </section>

        <section className="dash-card xl:col-span-4">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <PatientAvatar name={selected.name} size={52} src={selected.avatar_url} />
                  <div>
                    <div
                      className="text-xl font-medium"
                      style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                    >
                      {selected.name}
                    </div>
                    <div className="text-sm muted">
                      {conditionOf(selected)} · focus{" "}
                      {(selected.plan?.focus_tags || []).join(", ") || "—"}
                    </div>
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ background: "var(--success-soft)", color: "var(--success)" }}
                >
                  On Track
                </span>
              </div>

              <div className="mt-6 flex justify-center">
                <RingProgress value={selectedAdherence} label="Overall progress" size={140} />
              </div>

              <dl className="mt-6 space-y-2 text-[14px]">
                <div className="flex justify-between gap-3 border-b border-[var(--border)] py-2">
                  <dt className="muted">Program</dt>
                  <dd className="font-medium">NeuroBalance Advanced</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-[var(--border)] py-2">
                  <dt className="muted">Frequency</dt>
                  <dd className="font-medium">{selected.plan?.frequency_per_week ?? 5}× per week</dd>
                </div>
                <div className="flex justify-between gap-3 border-b border-[var(--border)] py-2">
                  <dt className="muted">Session length</dt>
                  <dd className="font-medium">{selected.plan?.session_minutes ?? 15} min</dd>
                </div>
                <div className="flex justify-between gap-3 py-2">
                  <dt className="muted">Last session</dt>
                  <dd className="font-medium">
                    {selected.recent_sessions?.[0]?.completed_at ? "Today" : "Pending"}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap gap-2">
                <Link href={`/doctor/${selected.id}`} className="btn-ink">
                  View Patient
                </Link>
                <Link href={`/doctor/${selected.id}#reports`} className="btn-ghost">
                  Weekly reports
                </Link>
              </div>
            </>
          ) : (
            <div className="muted py-16 text-center">Select a patient</div>
          )}
        </section>

        <section className="xl:col-span-5 min-h-[20rem]">
          {selected ? (
            <WeekChart patientName={selected.name} />
          ) : (
            <div className="dash-card muted flex h-full items-center justify-center py-16">
              Select a patient to see their weekly chart
            </div>
          )}
        </section>
      </div>

      {selected && (
        <div className="mt-6">
          <h2 className="section-title text-lg">Scores for {selected.name.split(" ")[0]}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-3">
            {(() => {
              const detail = fakeDetail(selected.name);
              return (
                [
                  {
                    key: "motor",
                    title: "Motor Control",
                    color: "var(--blue)",
                    ...detail.motor,
                  },
                  {
                    key: "balance",
                    title: "Balance",
                    color: "var(--success)",
                    ...detail.balance,
                  },
                  {
                    key: "cognitive",
                    title: "Cognitive Recall",
                    color: "var(--purple)",
                    ...detail.cognitive,
                  },
                ] as const
              ).map((m) => (
                <div key={m.key} className="dash-card">
                  <div className="text-sm muted">{m.title}</div>
                  <div
                    className="mt-1 text-2xl font-medium tabular-nums"
                    style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                  >
                    {m.score}
                    <span className="text-base muted">/100</span>
                  </div>
                  <div className="dash-delta-up mt-1">+{m.delta} pts</div>
                  <div className="progress-track mt-4">
                    <div className="progress-fill" style={{ width: `${m.score}%`, background: m.color }} />
                  </div>
                  <p className="mt-3 text-[13px] muted">{m.blurb}</p>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </DoctorShell>
  );
}
