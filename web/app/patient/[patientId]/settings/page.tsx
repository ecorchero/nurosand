"use client";

import { FormEvent, ReactElement, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Brand from "@/components/Brand";
import PatientAvatar from "@/components/PatientAvatar";
import { api, Patient } from "@/lib/api";
import { isPatientAuthed } from "@/lib/auth";

type DeviceKey = "glasses" | "watch";

const DEVICE_COPY: Record<
  DeviceKey,
  { title: string; blurb: string; scanning: string; defaultName: string; metric: string }
> = {
  glasses: {
    title: "Smart glasses",
    blurb: "Camera glasses for hands-free form capture during sessions.",
    scanning: "Looking for nearby glasses…",
    defaultName: "Ray-Ban Meta",
    metric: "Form video",
  },
  watch: {
    title: "Watch",
    blurb: "Tracks sleep, resting heart rate, and recovery overnight.",
    scanning: "Looking for nearby watches…",
    defaultName: "Apple Watch",
    metric: "Sleep & HR",
  },
};

function GlassesIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="36" height="36">
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState<DeviceKey | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [dob, setDob] = useState("");
  const [emergency, setEmergency] = useState("");
  const [notes, setNotes] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  async function load() {
    try {
      const p = await api.getPatient(patientId);
      setPatient(p);
      setName(p.name);
      setNotes(p.notes || "");
      setPhone(p.phone || "");
      setAddress(p.address || "");
      setDob(p.date_of_birth || "");
      setEmergency(p.emergency_contact || "");
      setAvatarUrl(p.avatar_url || "");
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

  function markDirty() {
    setProfileSaved(false);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSaved(false);
    setError("");
    try {
      const p = await api.updatePatient(patientId, {
        name,
        notes,
        phone,
        address,
        date_of_birth: dob,
        emergency_contact: emergency,
        avatar_url: avatarUrl,
      });
      setPatient(p);
      setName(p.name);
      setNotes(p.notes || "");
      setPhone(p.phone || "");
      setAddress(p.address || "");
      setDob(p.date_of_birth || "");
      setEmergency(p.emergency_contact || "");
      setAvatarUrl(p.avatar_url || "");
      setProfileSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setSavingProfile(false);
    }
  }

  function onPickPhoto(file: File | null) {
    if (!file) return;
    if (file.size > 1_500_000) {
      setError("Photo is too large. Please use an image under 1.5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      markDirty();
      setAvatarUrl(String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  }

  async function connect(device: DeviceKey) {
    setConnecting(device);
    setError("");
    await new Promise((r) => setTimeout(r, 1400));
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
      <main className="shell shell-patient">
        <Link href={`/patient/${patientId}`} className="nav-back">
          ← Back to my day
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
    <main className="shell shell-patient">
      <div className="topbar">
        <Brand size={28} />
        <Link href={`/patient/${patientId}`} className="btn-nav">
          ← My day
        </Link>
      </div>

      <h1 className="page-title">Settings</h1>
      <p className="mt-2 muted">Your details and connected wearables.</p>

      {error && <div className="alert-error">{error}</div>}

      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-12">
      <section className="card lg:col-span-7">
        <h2 className="section-title">Profile</h2>
        <form onSubmit={saveProfile}>
          <div className="mt-5 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover border border-[var(--border)]"
                />
              ) : (
                <PatientAvatar name={name || patient.name} size={80} />
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
              />
              <button
                type="button"
                className="btn-ghost"
                onClick={() => fileRef.current?.click()}
              >
                {avatarUrl ? "Change photo" : "Add profile photo"}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  className="btn-ghost ml-2"
                  onClick={() => {
                    markDirty();
                    setAvatarUrl("");
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <div className="label">Full name</div>
              <input
                className="input"
                value={name}
                onChange={(e) => {
                  markDirty();
                  setName(e.target.value);
                }}
              />
            </div>
            <div>
              <div className="label">Phone</div>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => {
                  markDirty();
                  setPhone(e.target.value);
                }}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <div className="label">Date of birth</div>
              <input
                className="input"
                type="date"
                value={dob}
                onChange={(e) => {
                  markDirty();
                  setDob(e.target.value);
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <div className="label">Address</div>
              <input
                className="input"
                value={address}
                onChange={(e) => {
                  markDirty();
                  setAddress(e.target.value);
                }}
                placeholder="Street, city, postcode"
              />
            </div>
            <div className="sm:col-span-2">
              <div className="label">Emergency contact</div>
              <input
                className="input"
                value={emergency}
                onChange={(e) => {
                  markDirty();
                  setEmergency(e.target.value);
                }}
                placeholder="Name and phone"
              />
            </div>
            <div className="sm:col-span-2">
              <div className="label">Notes for your clinician</div>
              <textarea
                className="input min-h-20"
                value={notes}
                onChange={(e) => {
                  markDirty();
                  setNotes(e.target.value);
                }}
                placeholder="Allergies, goals, precautions"
              />
            </div>
          </div>

          <button type="submit" className="btn-primary mt-5" disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save profile"}
          </button>
          {profileSaved && <div className="alert-success">Profile updated.</div>}
        </form>
      </section>

      <section className="lg:col-span-5">
        <h2 className="section-title">Wearables</h2>
        <p className="mt-2 text-[15px] muted">
          Connect devices so sleep and session data sync into your day.
        </p>

        <div className="mt-5 grid gap-4">
          {(Object.keys(DEVICE_COPY) as DeviceKey[]).map((device) => {
            const copy = DEVICE_COPY[device];
            const connected = isConnected[device];
            const busy = connecting === device;
            const Icon = DEVICE_ICON[device];
            return (
              <div
                key={device}
                className="relative overflow-hidden rounded-xl border border-[var(--border)] bg-white p-5"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-80"
                  style={{
                    background: connected
                      ? "linear-gradient(180deg, var(--accent-soft), transparent)"
                      : "linear-gradient(180deg, #f3f2ee, transparent)",
                  }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-2xl border"
                      style={{
                        borderColor: connected ? "var(--accent)" : "var(--border)",
                        color: connected ? "var(--accent)" : "var(--muted)",
                        background: "white",
                      }}
                    >
                      <Icon />
                    </div>
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-medium"
                      style={{
                        background: connected ? "var(--success-soft)" : "var(--danger-soft)",
                        color: connected ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {busy ? "…" : connected ? "Connected" : "Not connected"}
                    </span>
                  </div>

                  <h3 className="mt-4 text-xl font-medium" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
                    {copy.title}
                  </h3>
                  <p className="mt-1 text-[15px] muted">{copy.blurb}</p>
                  <div className="mt-3 text-sm muted">Tracks · {copy.metric}</div>

                  <div className="mt-5">
                    {busy ? (
                      <div className="flex items-center gap-2 text-[15px] muted">
                        <span className="inline-block h-2 w-2 animate-ping rounded-full bg-[var(--accent)]" />
                        {connected ? "Disconnecting…" : copy.scanning}
                      </div>
                    ) : connected ? (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="text-[15px] font-medium" style={{ color: "var(--success)" }}>
                          {deviceName[device]}
                        </div>
                        <button className="btn-ghost" onClick={() => disconnect(device)}>
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <button className="btn-primary w-full sm:w-auto" onClick={() => connect(device)}>
                        Connect {copy.title.toLowerCase()}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      </div>
    </main>
  );
}
