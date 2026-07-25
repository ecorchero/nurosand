"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";
import { api, Patient } from "@/lib/api";

export default function PatientPicker() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listPatients().then(setPatients).catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="shell">
      <div className="topbar">
        <Brand size={28} />
        <Link href="/" className="nav-back">
          Home
        </Link>
      </div>

      <h1 className="page-title">Who&apos;s exercising today?</h1>
      <p className="mt-2 muted">Choose your profile to continue.</p>
      {error && <div className="alert-error">{error}</div>}
      <div className="mt-8">
        {patients.map((p) => (
          <Link key={p.id} href={`/patient/${p.id}`} className="role-link">
            <div className="role-link-title">{p.name}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(p.plan?.focus_tags || []).map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
