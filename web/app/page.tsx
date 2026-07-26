"use client";

import Link from "next/link";
import Brand from "@/components/Brand";

export default function Home() {
  return (
    <main className="shell">
      <div className="topbar">
        <Brand size={36} />
      </div>

      <h1 className="page-title">Neurorehab</h1>
      <p className="mt-4 max-w-md muted">
        Tailored exercises, based on your doctor&apos;s target points, to help you rehab
        with clear daily sessions, spoken cues, and a weekly report they review and sign.
      </p>

      <div className="mt-10">
        <Link href="/doctor" className="role-link">
          <div className="role-link-title">For clinicians</div>
          <p className="mt-1 text-[15px] muted">Care plans, weekly reports, and sign-off.</p>
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
