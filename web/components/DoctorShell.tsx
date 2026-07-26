"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Brand from "@/components/Brand";

type NavItem = {
  href: string;
  label: string;
  badge?: string;
  match: (pathname: string) => boolean;
};

const NAV: NavItem[] = [
  {
    href: "/doctor",
    label: "Overview",
    match: (p) => p === "/doctor",
  },
  {
    href: "/doctor/patients",
    label: "Patients",
    match: (p) =>
      p === "/doctor/patients" ||
      p === "/doctor/new" ||
      (/^\/doctor\/[^/]+$/.test(p) &&
        !["patients", "programs", "insights", "reports", "messages", "alerts", "resources", "settings", "new"].includes(
          p.split("/")[2] || ""
        )),
  },
  {
    href: "/doctor/programs",
    label: "Programs",
    match: (p) => p.startsWith("/doctor/programs"),
  },
  {
    href: "/doctor/insights",
    label: "Insights",
    match: (p) => p.startsWith("/doctor/insights"),
  },
  {
    href: "/doctor/reports",
    label: "Reports",
    match: (p) => p.startsWith("/doctor/reports"),
  },
];

const LOWER: NavItem[] = [
  {
    href: "/doctor/messages",
    label: "Messages",
    match: (p) => p.startsWith("/doctor/messages"),
  },
  {
    href: "/doctor/alerts",
    label: "Alerts",
    badge: "3",
    match: (p) => p.startsWith("/doctor/alerts"),
  },
  {
    href: "/doctor/resources",
    label: "Resources",
    match: (p) => p.startsWith("/doctor/resources"),
  },
  {
    href: "/doctor/settings",
    label: "Settings",
    match: (p) => p.startsWith("/doctor/settings"),
  },
];

type Props = {
  children: React.ReactNode;
  doctorName?: string;
  clinicName?: string;
  onLogOut?: () => void;
};

export default function DoctorShell({
  children,
  doctorName = "Dr. Lee",
  clinicName = "NeuroMotion Clinic",
  onLogOut,
}: Props) {
  const pathname = usePathname();
  const all = [...NAV, ...LOWER];

  return (
    <div className="dash-doctor">
      <aside className="dash-sidebar">
        <div className="px-5 pt-6 pb-4">
          <Brand size={26} />
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`dash-nav-item ${active ? "active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="my-4 border-t border-[var(--border)]" />
          {LOWER.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`dash-nav-item justify-between ${active ? "active" : ""}`}
              >
                <span>{item.label}</span>
                {item.badge && <span className="dash-badge">{item.badge}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-[var(--border)] p-4 space-y-2">
          <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm">
            {clinicName}
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium">
            {doctorName}
          </div>
          {onLogOut && (
            <button type="button" className="nav-back text-sm" onClick={onLogOut}>
              Log out
            </button>
          )}
        </div>
      </aside>

      <div className="dash-main">
        {/* Mobile / tablet horizontal nav — sidebar is desktop-only */}
        <div className="mb-5 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Brand size={24} />
            {onLogOut && (
              <button type="button" className="btn-nav" onClick={onLogOut}>
                Log out
              </button>
            )}
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {all.map((item) => {
              const active = item.match(pathname);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] font-medium"
                      : "border-[var(--border)] bg-white muted"
                  }`}
                >
                  {item.label}
                  {item.badge ? ` (${item.badge})` : ""}
                </Link>
              );
            })}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
