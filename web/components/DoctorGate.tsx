"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";
import DoctorShell from "@/components/DoctorShell";
import { api } from "@/lib/api";
import { DOCTOR_PASSWORD, clearDoctorAuthed, isDoctorAuthed, setDoctorAuthed } from "@/lib/auth";

type Doctor = { id: string; name: string };

export function useDoctorSession() {
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ok = isDoctorAuthed();
    setAuthed(ok);
    setChecked(true);
    if (ok) {
      void api
        .getDoctor()
        .then(setDoctor)
        .catch((e) => setError(String(e)));
    }
  }, []);

  function logIn(password: string): boolean {
    if (password.trim().toLowerCase() === DOCTOR_PASSWORD) {
      setDoctorAuthed();
      setAuthed(true);
      void api
        .getDoctor()
        .then(setDoctor)
        .catch((e) => setError(String(e)));
      return true;
    }
    return false;
  }

  function logOut() {
    clearDoctorAuthed();
    setAuthed(false);
    setDoctor(null);
  }

  return { checked, authed, doctor, error, setError, logIn, logOut };
}

export function DoctorSignIn({
  onSubmit,
  authError,
}: {
  onSubmit: (password: string) => boolean;
  authError?: string;
}) {
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!onSubmit(password)) setLocalError("Incorrect password.");
    else setLocalError("");
  }

  return (
    <main className="shell shell-wide">
      <div className="topbar">
        <Brand size={28} />
        <Link href="/" className="nav-back">
          Home
        </Link>
      </div>
      <h1 className="page-title">Clinician sign-in</h1>
      <p className="mt-2 muted">Enter the clinician password to continue.</p>
      <form onSubmit={submit} className="card mt-8 max-w-sm">
        <div className="label">Password</div>
        <input
          type="password"
          autoFocus
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {(localError || authError) && (
          <div className="alert-error mt-3">{localError || authError}</div>
        )}
        <button type="submit" className="btn-primary mt-4">
          Sign in
        </button>
      </form>
    </main>
  );
}

export function DoctorPage({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const { checked, authed, doctor, error, logIn, logOut } = useDoctorSession();

  if (!checked) {
    return <main className="shell shell-wide muted">Loading…</main>;
  }
  if (!authed) {
    return <DoctorSignIn onSubmit={logIn} />;
  }

  return (
    <DoctorShell doctorName={doctor?.name || "Dr. Lee"} onLogOut={logOut}>
      {title && (
        <div className="mb-6">
          <h1 className="page-title" style={{ marginTop: 0 }}>
            {title}
          </h1>
          {subtitle && <p className="mt-2 muted">{subtitle}</p>}
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}
      {children}
    </DoctorShell>
  );
}
