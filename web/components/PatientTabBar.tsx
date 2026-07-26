"use client";

import Link from "next/link";

type Props = {
  patientId: string;
  active?: "today" | "progress" | "programs" | "insights" | "profile";
};

const TABS: { id: Props["active"]; label: string; href: (id: string) => string; icon: string }[] = [
  { id: "today", label: "Today", href: (id) => `/patient/${id}`, icon: "⌂" },
  { id: "progress", label: "Progress", href: (id) => `/patient/${id}`, icon: "▥" },
  { id: "programs", label: "Programs", href: (id) => `/patient/${id}/session`, icon: "▦" },
  { id: "insights", label: "Insights", href: (id) => `/patient/${id}/session?review=1`, icon: "↗" },
  { id: "profile", label: "Profile", href: (id) => `/patient/${id}/settings`, icon: "☺" },
];

export default function PatientTabBar({ patientId, active = "today" }: Props) {
  return (
    <nav className="patient-tabbar" aria-label="Patient">
      <div className="patient-tabbar-inner">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.href(patientId)}
            className={`patient-tab ${active === t.id ? "active" : ""}`}
          >
            <span className="text-base leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
