"use client";

import { DoctorPage } from "@/components/DoctorGate";

const THREADS = [
  {
    from: "Quentin Tarantino",
    preview: "Left-hand form felt shaky on the circle task today.",
    time: "Today · 9:12",
    unread: true,
  },
  {
    from: "Care coordinator",
    preview: "Updated schedule for Thursday tele-check.",
    time: "Yesterday",
    unread: true,
  },
  {
    from: "Sarah Chen",
    preview: "Thanks for the plan tweak — sleep is better.",
    time: "Mon",
    unread: false,
  },
];

export default function DoctorMessagesPage() {
  return (
    <DoctorPage title="Messages" subtitle="Secure threads with patients and your care team.">
      <div className="space-y-2">
        {THREADS.map((t) => (
          <div
            key={t.from + t.time}
            className="dash-card flex items-start justify-between gap-3 !py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-medium">{t.from}</div>
                {t.unread && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                )}
              </div>
              <p className="mt-1 truncate text-[14px] muted">{t.preview}</p>
            </div>
            <div className="shrink-0 text-[12px] muted">{t.time}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[14px] muted">Demo inbox — replies are not wired yet.</p>
    </DoctorPage>
  );
}
