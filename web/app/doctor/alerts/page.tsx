"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PatientAvatar from "@/components/PatientAvatar";
import { DoctorPage } from "@/components/DoctorGate";
import { api, Patient } from "@/lib/api";

type AlertLevel = "high" | "med" | "low";

type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  body: string;
  patientId: string;
  patientName: string;
  actionLabel: string;
  href: string;
};

function buildAlerts(patients: Patient[]): Alert[] {
  const byName = (part: string) =>
    patients.find((p) => p.name.toLowerCase().includes(part.toLowerCase()));

  const quentin = byName("Quentin") || patients[0];
  const other =
    patients.find((p) => p.id !== quentin?.id) || patients[1] || quentin;
  const any = patients[0];

  const out: Alert[] = [];

  if (quentin) {
    out.push({
      id: "asymmetry-" + quentin.id,
      level: "high",
      title: "Asymmetry flagged",
      body: `${quentin.name.split(" ")[0]}’s left-hand tracing was discontinuous on today’s session. Review the Nuroport and follow up.`,
      patientId: quentin.id,
      patientName: quentin.name,
      actionLabel: "Open patient",
      href: `/doctor/${quentin.id}`,
    });
  }
  if (other) {
    out.push({
      id: "missed-" + other.id,
      level: "med",
      title: "Missed session",
      body: `${other.name.split(" ")[0]} skipped yesterday’s planned session after low overnight sleep.`,
      patientId: other.id,
      patientName: other.name,
      actionLabel: "Open patient",
      href: `/doctor/${other.id}`,
    });
  }

  if (any) {
    out.push({
      id: "report-" + any.id,
      level: "low",
      title: "Weekly report ready",
      body: `A weekly report for ${any.name.split(" ")[0]} is waiting for clinician sign-off.`,
      patientId: any.id,
      patientName: any.name,
      actionLabel: "Review & sign",
      href: `/doctor/${any.id}#reports`,
    });
  }

  return out;
}

const LEVEL_STYLE: Record<AlertLevel, { bg: string; color: string; label: string }> = {
  high: { bg: "var(--danger-soft)", color: "var(--danger)", label: "Needs review" },
  med: { bg: "#fff7ed", color: "#c2410c", label: "Follow up" },
  low: { bg: "var(--accent-soft)", color: "var(--accent)", label: "Sign-off" },
};

export default function DoctorAlertsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void api
      .listPatients()
      .then(setPatients)
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const alerts = useMemo(
    () => buildAlerts(patients).filter((a) => !dismissed.includes(a.id)),
    [patients, dismissed]
  );

  return (
    <DoctorPage
      title="Alerts"
      subtitle={
        loading
          ? "Loading…"
          : alerts.length
            ? `${alerts.length} item${alerts.length === 1 ? "" : "s"} need attention.`
            : "You’re caught up."
      }
    >
      {error && <div className="alert-error">{error}</div>}

      <div className="space-y-3">
        {alerts.map((a) => {
          const style = LEVEL_STYLE[a.level];
          return (
            <div key={a.id} className="dash-card">
              <div className="flex flex-wrap items-start gap-4">
                <PatientAvatar name={a.patientName} size={48} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      style={{ background: style.bg, color: style.color }}
                    >
                      {style.label}
                    </span>
                    <div className="font-medium">{a.title}</div>
                  </div>
                  <p className="mt-2 text-[15px] muted">{a.body}</p>
                  <div className="mt-2 text-[13px] muted">{a.patientName}</div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-ink"
                      onClick={() => router.push(a.href)}
                    >
                      {a.actionLabel}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => setDismissed((d) => [...d, a.id])}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && alerts.length === 0 && (
          <div className="dash-card py-12 text-center muted">
            No open alerts.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => setDismissed([])}
            >
              Restore demo alerts
            </button>
          </div>
        )}
      </div>
    </DoctorPage>
  );
}
