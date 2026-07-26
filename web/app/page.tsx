"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Brand from "@/components/Brand";

const DEMO_EXERCISES = [
  { name: "Line & Circle Steadiness", focus: "dexterity", note: "Tracks left/right hand steadiness." },
  { name: "Knee-to-Elbow Crunches", focus: "strength", note: "Builds core and coordination." },
  { name: "Tandem Stance Hold", focus: "balance", note: "Heel-to-toe balance training." },
  { name: "Single-Leg Stand", focus: "balance", note: "Adapts to your recent performance." },
  { name: "Peg Board Insertion", focus: "dexterity", note: "Fine motor control practice." },
];

export default function Home() {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setSlide((s) => (s + 1) % DEMO_EXERCISES.length), 2800);
    return () => clearInterval(t);
  }, []);

  const ex = DEMO_EXERCISES[slide];

  return (
    <main className="shell">
      <div className="topbar">
        <Brand size={36} />
      </div>

      <h1 className="page-title">Neurorehab</h1>
      <p className="mt-4 max-w-md muted">
        Tailored exercises, based on your doctor&apos;s target points, to help you rehab —
        with clear daily sessions, spoken cues, and a weekly report they review and sign.
      </p>

      <div key={slide} className="card mt-8 max-w-md animate-[fadein_0.4s_ease]">
        <div className="flex items-center justify-between gap-3">
          <div className="font-bold">{ex.name}</div>
          <span className="tag tag-active">{ex.focus}</span>
        </div>
        <p className="mt-2 text-[15px] muted">{ex.note}</p>
        <div className="mt-4 flex gap-1.5">
          {DEMO_EXERCISES.map((_, i) => (
            <span
              key={i}
              className="h-1.5 flex-1 rounded-sm"
              style={{ background: i === slide ? "var(--accent)" : "var(--track)" }}
            />
          ))}
        </div>
      </div>

      <div className="mt-10">
        <Link href="/doctor" className="role-link">
          <div className="role-link-title">For clinicians</div>
          <p className="mt-1 text-[15px] muted">
            Care plans, weekly reports, and sign-off.
          </p>
        </Link>
        <Link href="/patient" className="role-link">
          <div className="role-link-title">For patients</div>
          <p className="mt-1 text-[15px] muted">
            Today&apos;s session, sleep check-in, and voice coaching.
          </p>
        </Link>
      </div>
    </main>
  );
}
