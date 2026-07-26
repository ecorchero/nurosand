"use client";

import { useEffect, useState } from "react";
import { DoctorPage } from "@/components/DoctorGate";
import { api } from "@/lib/api";

export default function DoctorSettingsPage() {
  const [name, setName] = useState("Dr. Lee");
  const [clinic, setClinic] = useState("NeuroMotion Clinic");
  const [notify, setNotify] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void api
      .getDoctor()
      .then((d) => setName(d.name))
      .catch(() => undefined);
  }, []);

  return (
    <DoctorPage title="Settings" subtitle="Clinic profile and notification preferences.">
      <div className="dash-card max-w-xl">
        <div>
          <div className="label">Clinician</div>
          <input className="input" value={name} readOnly />
        </div>
        <div className="mt-4">
          <div className="label">Clinic</div>
          <input className="input" value={clinic} onChange={(e) => setClinic(e.target.value)} />
        </div>
        <label className="mt-5 flex items-center gap-3 text-[15px]">
          <input
            type="checkbox"
            checked={notify}
            onChange={(e) => setNotify(e.target.checked)}
            className="h-4 w-4"
          />
          Email me when a Nuroport needs review
        </label>
        <button
          type="button"
          className="btn-ink mt-6"
          onClick={() => {
            setSaved(true);
            window.setTimeout(() => setSaved(false), 2500);
          }}
        >
          Save settings
        </button>
        {saved && <div className="alert-success">Settings saved (demo).</div>}
      </div>
    </DoctorPage>
  );
}
