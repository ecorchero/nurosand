"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Brand from "@/components/Brand";
import { api } from "@/lib/api";
import { setPatientAuthed } from "@/lib/auth";

export default function PatientLogin() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const patient = await api.patientLogin(name, password);
      setPatientAuthed(patient.id);
      router.push(`/patient/${patient.id}`);
    } catch {
      setError("Invalid name or password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <div className="topbar">
        <Brand size={28} />
        <Link href="/" className="nav-back">
          Home
        </Link>
      </div>

      <h1 className="page-title">Patient sign-in</h1>
      <p className="mt-2 muted">Enter your full name and password to continue.</p>

      <form onSubmit={submit} className="card mt-8 max-w-sm">
        <div className="label">Full name</div>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex Morgan"
        />
        <div className="label mt-4">Password</div>
        <input
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        {error && <div className="alert-error mt-3">{error}</div>}
        <button type="submit" className="btn-primary mt-4" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
