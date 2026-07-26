"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PatientAvatar from "@/components/PatientAvatar";
import { DoctorPage } from "@/components/DoctorGate";
import Sparkline from "@/components/dashboard/Sparkline";
import { api, Patient } from "@/lib/api";
import { fakeAdherence, fakeSpark } from "@/lib/demoMetrics";

function conditionOf(p: Patient): string {
  const n = (p.notes || "").toLowerCase();
  if (n.includes("stroke")) return "Stroke";
  if (n.includes("tbi") || n.includes("brain")) return "TBI";
  if (n.includes("parkinson")) return "Parkinson's";
  const tag = p.plan?.focus_tags?.[0];
  return tag ? tag[0].toUpperCase() + tag.slice(1) : "Neurorehab";
}

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .listPatients()
      .then(setPatients)
      .catch((e) => setError(String(e)));
  }, []);

  const filtered = patients.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.notes || "").toLowerCase().includes(q);
  });

  return (
    <DoctorPage
      title="Patients"
      subtitle={`${patients.length} on your caseload. Open a profile to review plans and reports.`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search patients"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Link href="/doctor/new" className="btn-ink">
          + New Patient
        </Link>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="mt-6 space-y-2">
        {filtered.map((p) => {
          const adh = fakeAdherence(p.name);
          return (
            <Link key={p.id} href={`/doctor/${p.id}`} className="dash-card flex items-center gap-4 !py-3 hover:border-[var(--accent)]">
              <PatientAvatar name={p.name} size={48} src={p.avatar_url} />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.name}</div>
                <div className="text-[14px] muted truncate">
                  {conditionOf(p)}
                  {(p.plan?.focus_tags || []).length
                    ? ` · ${(p.plan?.focus_tags || []).join(", ")}`
                    : ""}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[14px] font-medium">{adh}%</div>
                <Sparkline values={fakeSpark(adh)} />
              </div>
            </Link>
          );
        })}
        {filtered.length === 0 && <div className="muted py-10 text-center">No patients found</div>}
      </div>
    </DoctorPage>
  );
}
