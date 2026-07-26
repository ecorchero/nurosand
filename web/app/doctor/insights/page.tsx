"use client";

import { DoctorPage } from "@/components/DoctorGate";
import Sparkline from "@/components/dashboard/Sparkline";
import { DOCTOR_DEMO } from "@/lib/demoMetrics";

export default function DoctorInsightsPage() {
  const cards = [
    {
      title: "Caseload adherence",
      value: "78%",
      delta: "+8% vs last week",
      spark: DOCTOR_DEMO.adherence.spark,
      color: "#22a06b",
      note: "Average completion across active plans this week.",
    },
    {
      title: "Balance trend",
      value: "+14%",
      delta: "vs last 7 days",
      spark: DOCTOR_DEMO.balanceTrend.spark,
      color: "#22a06b",
      note: "Mean stability scores from session reviews.",
    },
    {
      title: "Cognitive recall",
      value: "+11%",
      delta: "vs last 7 days",
      spark: DOCTOR_DEMO.cognitive.spark,
      color: "#3b82f6",
      note: "Memory and dual-task performance lifts.",
    },
    {
      title: "Sleep quality",
      value: "72/100",
      delta: "+6 pts",
      spark: DOCTOR_DEMO.sleep.spark,
      color: "#3b82f6",
      note: "Wearable-synced nights where available.",
    },
  ];

  return (
    <DoctorPage
      title="Insights"
      subtitle="Population trends across your caseload. Open a patient for individual detail."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <div key={c.title} className="dash-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm muted">{c.title}</div>
                <div
                  className="mt-1 text-3xl font-medium"
                  style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
                >
                  {c.value}
                </div>
                <div className="dash-delta-up mt-1">{c.delta}</div>
              </div>
              <Sparkline values={c.spark} color={c.color} />
            </div>
            <p className="mt-4 text-[14px] muted">{c.note}</p>
          </div>
        ))}
      </div>
    </DoctorPage>
  );
}
