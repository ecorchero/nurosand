"use client";

import { useState } from "react";
import { patientAvatarUrl, patientInitials } from "@/lib/patientAvatar";

type Props = {
  name: string;
  size?: number;
  className?: string;
  src?: string;
};

export default function PatientAvatar({ name, size = 48, className = "", src }: Props) {
  const [failed, setFailed] = useState(false);
  const initials = patientInitials(name);
  const url = src || patientAvatarUrl(name);

  if (failed || !url) {
    return (
      <div
        className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] font-medium text-[var(--accent)] ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.32 }}
        aria-hidden
      >
        {initials}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
}
