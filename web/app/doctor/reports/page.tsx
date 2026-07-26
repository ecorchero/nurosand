"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DoctorPage } from "@/components/DoctorGate";
import { api, Patient, WeeklyReport } from "@/lib/api";

type Row = { patient: Patient; report: WeeklyReport };

export default function DoctorReportsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const patients = await api.listPatients();
        const packed = await Promise.all(
          patients.map(async (p) => {
            const reports = await api.weeklyReports(p.id);
            return reports.map((report) => ({ patient: p, report }));
          })
        );
        setRows(packed.flat().sort((a, b) => (a.report.week_start < b.report.week_start ? 1 : -1)));
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DoctorPage
      title="Reports"
      subtitle="Weekly reviews awaiting sign-off or already signed."
    >
      {error && <div className="alert-error">{error}</div>}
      {loading && <div className="muted">Loading reports…</div>}

      <div className="mt-2 space-y-3">
        {rows.map(({ patient, report }) => {
          const signed = report.status === "signed";
          return (
            <Link
              key={report.id}
              href={`/doctor/${patient.id}#reports`}
              className="dash-card flex flex-wrap items-center justify-between gap-3 hover:border-[var(--accent)]"
            >
              <div>
                <div className="font-medium">{patient.name}</div>
                <div className="text-[14px] muted">Week of {report.week_start}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={signed ? "badge-signed" : "badge-draft"}>
                  {signed ? "Signed" : "Awaiting review"}
                </span>
                <span className="text-sm muted">Open →</span>
              </div>
            </Link>
          );
        })}
        {!loading && rows.length === 0 && (
          <div className="muted py-10 text-center">No weekly reports yet.</div>
        )}
      </div>
    </DoctorPage>
  );
}
