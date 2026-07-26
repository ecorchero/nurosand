"use client";

import { DoctorPage } from "@/components/DoctorGate";

const RESOURCES = [
  {
    title: "Balance progression guide",
    type: "PDF · 8 pages",
    blurb: "How to step difficulty for tandem stance and foam work.",
  },
  {
    title: "Dexterity home kit checklist",
    type: "Checklist",
    blurb: "Coins, pegs, bands, and paper tasks patients can keep nearby.",
  },
  {
    title: "Sleep & rehab brief",
    type: "1-pager",
    blurb: "How overnight sleep feeds into the daily adapter.",
  },
  {
    title: "Meta glasses scan tips",
    type: "How-to",
    blurb: "Coaching patients through a room scan for environment matching.",
  },
];

export default function DoctorResourcesPage() {
  return (
    <DoctorPage title="Resources" subtitle="Guides and handouts for clinic and home programs.">
      <div className="grid gap-3 md:grid-cols-2">
        {RESOURCES.map((r) => (
          <div key={r.title} className="dash-card">
            <div className="text-[12px] muted">{r.type}</div>
            <div
              className="mt-1 text-lg font-medium"
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            >
              {r.title}
            </div>
            <p className="mt-2 text-[14px] muted">{r.blurb}</p>
            <button type="button" className="btn-ghost mt-4" disabled>
              Preview (demo)
            </button>
          </div>
        ))}
      </div>
    </DoctorPage>
  );
}
