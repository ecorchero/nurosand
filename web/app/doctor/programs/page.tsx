"use client";

import Link from "next/link";
import { DoctorPage } from "@/components/DoctorGate";

const PROGRAMS = [
  {
    name: "NeuroBalance Advanced",
    focus: "Balance & coordination",
    length: "12 weeks",
    freq: "5× / week",
    patients: 2,
  },
  {
    name: "Dexterity Rebuild",
    focus: "Fine motor & dexterity",
    length: "8 weeks",
    freq: "4× / week",
    patients: 1,
  },
  {
    name: "Cognitive Dual-Task",
    focus: "Memory & attention",
    length: "10 weeks",
    freq: "3× / week",
    patients: 1,
  },
];

export default function DoctorProgramsPage() {
  return (
    <DoctorPage
      title="Programs"
      subtitle="Templates you assign to patients. Open a patient to customise their plan."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PROGRAMS.map((p) => (
          <div key={p.name} className="dash-card">
            <div
              className="text-xl font-medium"
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            >
              {p.name}
            </div>
            <p className="mt-2 text-[14px] muted">{p.focus}</p>
            <dl className="mt-4 space-y-2 text-[14px]">
              <div className="flex justify-between">
                <dt className="muted">Length</dt>
                <dd className="font-medium">{p.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted">Frequency</dt>
                <dd className="font-medium">{p.freq}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="muted">Assigned</dt>
                <dd className="font-medium">{p.patients} patients</dd>
              </div>
            </dl>
            <Link href="/doctor/patients" className="btn-ghost mt-5 inline-flex">
              Assign to patient
            </Link>
          </div>
        ))}
      </div>
    </DoctorPage>
  );
}
