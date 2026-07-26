"use client";

import { FormEvent, ReactElement, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Brand from "@/components/Brand";
import { api, Patient } from "@/lib/api";
import { isPatientAuthed } from "@/lib/auth";

type DeviceKey = "glasses" | "watch";

const DEVICE_COPY: Record<DeviceKey, { title: string; blurb: string; scanning: string; defaultName: string }> = {
  glasses: {
    title: "Smart glasses",
    blurb: "Pairs camera glasses (e.g. Ray-Ban Meta) to capture exercise form hands-free.",
    scanning: "Searching for nearby glasses…",
    defaultName: "Ray-Ban Meta",
  },
  watch: {
    title: "Wearable watch",
    blurb: "Pairs a wearable to track sleep and heart rate automatically.",
    scanning: "Searching for nearby wearables…",
    defaultName: "Apple Watch",
  },
};

function GlassesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
      <circle cx="6.5" cy="13" r="3.5" />
      <circle cx="17.5" cy="13" r="3.5" />
      <path d="M10 12.2h4" strokeLinecap="round" />
      <path d="M3 11.5l1-3.2" strokeLinecap="round" />
      <path d="M21 11.5l-1-3.2" strokeLinecap="round" />
    </svg>
  );
}

function WatchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26">
      <rect x="7" y="7.5" width="10" height="9" rx="2.2" />
      <path d="M9.2 7.5V5.2A1.2 1.2 0 0 1 10.4 4h3.2a1.2 1.2 0 0 1 1.2 1.2v2.3" strokeLinecap="round" />
      <path d="M9.2 16.5v2.3A1.2 1.2 0 0 0 10.4 20h3.2a1.2 1.2 0 0 0 1.2-1.2v-2.3" strokeLinecap="round" />
      <path d="M17 10.8h1.3" strokeLinecap="round" />
    </svg>
  );
}

const DEVICE_ICON: Record<DeviceKey, () => ReactElement> = {
  glasses: GlassesIcon,
  watch: WatchIcon,
};

export default function PatientSettings() {
  const { patientId } = useParams<{ patientId: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState<DeviceKey | null>(null);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  async function load() {
    try {
      const p = await api.getPatient(patientId);
      setPatient(p);
      setName(p.name);
      setNotes(p.notes || "");
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    if (!isPatientAuthed(patientId)) {
      router.replace("/patient");
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    setError("");
    try {
      const p = await api.updatePatient(patientId, { name, notes });
      setPatient(p);
      setName(p.name);
      setNotes(p.notes || "");
      setProfileSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingProfile(false);
    }
  }

  async function connect(device: DeviceKey) {
    setConnecting(device);
    setError("");
    // Simulated pairing — no real device/API integration behind this.
    await new Promise((r) => setTimeout(r, 1700));
    try {
      const p = await api.setDevice(patientId, device, true, DEVICE_COPY[device].defaultName);
      setPatient(p);
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(null);
    }
  }

  async function disconnect(device: DeviceKey) {
    setConnecting(device);
    setError("");
    try {
      const p = await api.setDevice(patientId, device, false);
      setPatient(p);
    } catch (e) {
      setError(String(e));
    } finally {
      setConnecting(null);
    }
  }

  if (!patient) {
    return (
      <main className="shell">
        <Link href={`/patient/${patientId}`} className="nav-back">
          ← Back
        </Link>
        <div className="mt-6 muted">{error || "Loading…"}</div>
      </main>
    );
  }

  const isConnected: Record<DeviceKey, boolean> = {
    glasses: !!patient.glasses_connected,
    watch: !!patient.watch_connected,
  };
  const deviceName: Record<DeviceKey, string> = {
    glasses: patient.glasses_name || "",
    watch: patient.watch_name || "",
  };

  return (
    <main className="shell">
      <div className="topbar">
        <Brand size={28} />
        <Link href={`/patient/${patientId}`} className="nav-back">
          Back
        </Link>
      </div>

      <h1 className="page-title">Settings</h1>
      <p className="mt-2 muted">Manage your profile and connect devices.</p>

      {error && <div className="alert-error">{error}</div>}

      <section className="card mt-8">
        <h2 className="section-title">Profile</h2>
        <form onSubmit={saveProfile}>
          <div className="mt-4">
            <div className="label">Name</div>
            <input
              className="input"
              value={name}
              onChange={(e) => {
                setProfileSaved(false);
                setName(e.target.value);
              }}
            />
          </div>
          <div className="mt-4">
            <div className="label">General information</div>
            <textarea
              className="input min-h-20"
              value={notes}
              onChange={(e) => {
                setProfileSaved(false);
                setNotes(e.target.value);
              }}
              placeholder="Anything your clinician should know."
            />
          </div>
          <button type="submit" className="btn-primary mt-4" disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
          {profileSaved && <div className="alert-success">Profile updated.</div>}
        </form>
      </section>

      <div className="mt-6 space-y-6">
        {(Object.keys(DEVICE_COPY) as DeviceKey[]).map((device) => {
          const copy = DEVICE_COPY[device];
          const connected = isConnected[device];
          const busy = connecting === device;
          const Icon = DEVICE_ICON[device];
          const ringColor = busy ? "var(--border)" : connected ? "var(--success)" : "var(--danger)";
          return (
            <section key={device} className="card">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2"
                  style={{ borderColor: ringColor, color: ringColor }}
                >
                  <Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="section-title">{copy.title}</h2>
                  </div>
                  <p className="mt-1 text-[15px] muted">{copy.blurb}</p>

                  <div className="mt-4">
                    {busy ? (
                      <div className="flex items-center gap-2 text-[15px] muted">
                        <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[var(--accent)]" />
                        {connected ? "Disconnecting…" : copy.scanning}
                      </div>
                    ) : connected ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[15px] font-medium" style={{ color: "var(--success)" }}>
                          Connected · {deviceName[device]}
                        </div>
                        <button className="btn-ghost" onClick={() => disconnect(device)}>
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button className="btn-primary" onClick={() => connect(device)}>
                        Connect {copy.title.toLowerCase()}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
