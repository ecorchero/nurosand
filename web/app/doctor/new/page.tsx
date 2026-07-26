"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Brand from "@/components/Brand";
import DoctorShell from "@/components/DoctorShell";
import { api } from "@/lib/api";
import { DOCTOR_PASSWORD, clearDoctorAuthed, isDoctorAuthed, setDoctorAuthed } from "@/lib/auth";

const FOCUS_OPTIONS = ["balance", "dexterity", "strength", "mobility", "memory", "proprioception"];

export default function NewPatientPage() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  const [doctor, setDoctor] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [focus, setFocus] = useState<string[]>(["balance"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ok = isDoctorAuthed();
    setAuthed(ok);
    setCheckedAuth(true);
    if (ok) {
      void api.getDoctor().then(setDoctor).catch((e) => setError(String(e)));
    }
  }, []);

  function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (password.trim().toLowerCase() === DOCTOR_PASSWORD) {
      setDoctorAuthed();
      setAuthed(true);
      setAuthError("");
      void api.getDoctor().then(setDoctor).catch((err) => setError(String(err)));
    } else {
      setAuthError("Incorrect password.");
    }
  }

  function toggleFocus(tag: string) {
    setFocus((f) => (f.includes(tag) ? f.filter((x) => x !== tag) : [...f, tag]));
  }

  async function createPatient(e: FormEvent) {
    e.preventDefault();
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
      router.push(`/doctor/${created.id}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

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
        <form onSubmit={submitPassword} className="card mt-8 max-w-sm">
          <div className="label">Password</div>
          <input
            type="password"
            autoFocus
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
    <DoctorShell
      doctorName={doctor?.name || "Dr. Lee"}
      onLogOut={() => {
        clearDoctorAuthed();
        router.push("/doctor");
      }}
    >
      <Link href="/doctor" className="nav-back">
        ← Overview
      </Link>
      <h1 className="page-title">New patient</h1>
      <p className="mt-2 muted">Add someone to your caseload and set their focus areas.</p>

      {error && <div className="alert-error">{error}</div>}

      <form onSubmit={createPatient} className="dash-card mt-6 max-w-xl">
        <div>
          <div className="label">Full name</div>
          <input
            className="input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />
        </div>
        <div className="mt-4">
          <div className="label">Notes</div>
          <textarea
            className="input min-h-24"
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
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" className="btn-ink" disabled={busy}>
            {busy ? "Creating…" : "Create patient"}
          </button>
          <Link href="/doctor" className="btn-ghost">
            Cancel
          </Link>
        </div>
      </form>
    </DoctorShell>
  );
}
