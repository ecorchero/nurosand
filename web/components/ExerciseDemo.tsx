"use client";

import { useState } from "react";

const FOCUS_DEMOS: Record<string, string> = {
  balance: "/demos/balance.svg",
  dexterity: "/demos/dexterity.svg",
  strength: "/demos/strength.svg",
  mobility: "/demos/mobility.svg",
  memory: "/demos/memory.svg",
  proprioception: "/demos/proprioception.svg",
};

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}

type Props = {
  name: string;
  focusTag: string;
  videoUrl?: string;
  gifUrl?: string;
  /** Live session uses animated GIF/SVG demos; review uses real videos when present. */
  mode?: "live" | "review";
  className?: string;
};

export default function ExerciseDemo({
  name,
  focusTag,
  videoUrl,
  gifUrl,
  mode = "live",
  className = "",
}: Props) {
  const [videoFailed, setVideoFailed] = useState(false);
  const focusDemo = FOCUS_DEMOS[focusTag] || FOCUS_DEMOS.balance;

  const preferVideo = mode === "review" && Boolean(videoUrl && isVideoUrl(videoUrl) && !videoFailed);
  const liveDemo = gifUrl || focusDemo;
  const caption =
    mode === "review"
      ? preferVideo
        ? "Review video · watch your form"
        : "Review demo"
      : "Live demo · match this movement";

  return (
    <div
      className={`overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] ${preferVideo ? "" : "mx-auto max-w-md"} ${className}`}
    >
      {preferVideo ? (
        <video
          key={videoUrl}
          className="aspect-video w-full object-cover bg-black"
          src={videoUrl}
          controls
          playsInline
          loop
          muted
          autoPlay
          onError={() => setVideoFailed(true)}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={liveDemo}
          alt={`Demo for ${name}`}
          className="aspect-square w-full object-contain bg-white"
        />
      )}
      <div className="border-t border-[var(--border)] bg-white px-3 py-2 text-xs muted">
        {caption}
      </div>
    </div>
  );
}
