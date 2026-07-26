"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Brand from "@/components/Brand";
import { api, Patient } from "@/lib/api";
import { DOCTOR_PASSWORD, clearDoctorAuthed, isDoctorAuthed, setDoctorAuthed } from "@/lib/auth";

const FOCUS_OPTIONS = ["balance", "dexterity", "strength", "mobility", "memory", "proprioception"];

export default function DoctorHome() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctor, setDoctor] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [focus, setFocus] = useState<string[]>(["balance"]);

  async function load() {
    try {
      const [ps, d] = await Promise.all([api.listPatients(), api.getDoctor()]);
      setPatients(ps);
      setDoctor(d);
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

  function toggleFocus(tag: string) {
    setFocus((f) => (f.includes(tag) ? f.filter((x) => x !== tag) : [...f, tag]));
  }

  async function addPatient() {
    if (!name.trim()) {
      setError("Patient name is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await api.createPatient({
        name: name.trim(),
        notes: notes.trim(),
        focus_tags: focus.length ? focus : ["balance"],
        doctor_id: doctor?.id,
      });
      setName("");
      setNotes("");
      setFocus(["balance"]);
      setShowForm(false);
      await load();
      router.push(`/doctor/${created.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!checkedAuth) {
    return <main className="shell muted">Loading…</main>;
  }

  if (!authed) {
    return (
      <main className="shell">
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
    <main className="shell">
      <div className="topbar">
        <Brand size={28} />
        <div className="flex items-center gap-4">
          <button className="nav-back" onClick={logOut}>
            Log out
          </button>
          <Link href="/" className="nav-back">
            Home
          </Link>
        </div>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Patients</h1>
          {doctor && <p className="mt-2 muted">Signed in as {doctor.name}</p>}
        </div>
        <button className="btn-primary shrink-0" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "Add patient"}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {showForm && (
        <section className="card mt-6">
          <h2 className="section-title">New patient</h2>
          <div className="mt-4">
            <div className="label">Name</div>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="mt-4">
            <div className="label">Notes</div>
            <textarea
              className="input min-h-20"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Diagnosis, goals, precautions"
            />
          </div>
          <div className="mt-4">
            <div className="label">Focus areas</div>
            <div className="flex flex-wrap gap-2">
              {FOCUS_OPTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleFocus(t)}
                  className={`tag ${focus.includes(t) ? "tag-active" : ""}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button className="btn-primary mt-5" onClick={addPatient} disabled={busy}>
            {busy ? "Saving…" : "Create patient"}
          </button>
        </section>
      )}

      <div className="mt-8">
        {patients.map((p) => (
          <Link key={p.id} href={`/doctor/${p.id}`} className="role-link">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
              <div>
                <div className="role-link-title">{p.name}</div>
                <div className="mt-1 text-[15px] muted">{p.notes}</div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(p.plan?.focus_tags || []).map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
        {patients.length === 0 && !error && <div className="muted">Loading patients…</div>}
      </div>
    </main>
  );
}
