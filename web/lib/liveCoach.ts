// Simulated real-time coaching. Until Watch/camera sensors land, we script
// plausible in-the-moment feedback (wobbles, rep counts, form nudges) so the
// session feels like a coach is watching.

import type { DailyExercise } from "./api";

export type ScriptLine = { at: number; text: string; kind: "count" | "coach" | "phase" };

function rotator(items: string[]): () => string {
  let pool: string[] = [];
  return () => {
    if (pool.length === 0) {
      pool = [...items];
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
    }
    return pool.pop() as string;
  };
}

// Keep cues short so they fit the demo pacing without eating the next count.
const CORRECTIONS: Record<string, string[]> = {
  balance: [
    "Stay steady.",
    "Eyes forward.",
    "Back to centre.",
    "Nice and tall.",
    "Soft knees.",
  ],
  dexterity: [
    "Slow and precise.",
    "Even both sides.",
    "Relax the fingers.",
    "Smoother.",
    "Quiet wrists.",
  ],
  strength: [
    "A little higher.",
    "Push through the heels.",
    "Slow on the way down.",
    "Keep breathing.",
    "Squeeze at the top.",
  ],
  mobility: [
    "Ease into it.",
    "A little further if okay.",
    "Smooth, no bounce.",
    "Range is opening.",
    "Stay tall.",
  ],
  memory: [
    "Take your time.",
    "Good recall.",
    "Keep going.",
    "Say them out loud.",
    "Strong run.",
  ],
  proprioception: [
    "Trust your body.",
    "Re-centre.",
    "Feel your feet.",
    "Very close.",
    "Small ankle fixes.",
  ],
};

const GENERIC_CORRECTIONS = ["Steady.", "Controlled.", "Smooth."];

const ENCOURAGEMENT = [
  "Great job.",
  "Nice work.",
  "Keep going.",
  "Much better.",
  "Lovely.",
  "Strong.",
];

const COUNT_WORDS = [
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty",
];

function countWord(n: number): string {
  return COUNT_WORDS[n - 1] ?? String(n);
}

// Demo pacing: tight enough to feel live, long enough for short TTS cues.
const SECONDS_PER_REP = 2;

export function buildRepScript(ex: DailyExercise): ScriptLine[] {
  const corrections = rotator(CORRECTIONS[ex.focus_tag] ?? GENERIC_CORRECTIONS);
  const praise = rotator(ENCOURAGEMENT);
  const reps = Math.max(1, Math.min(12, ex.reps || 8));

  const lines: ScriptLine[] = [
    { at: 0, text: `Let's go. ${reps} reps.`, kind: "phase" },
  ];

  for (let rep = 1; rep <= reps; rep++) {
    const at = 1.2 + (rep - 1) * SECONDS_PER_REP;
    let text = rep === 1 ? "One." : `${countWord(rep)}.`;

    // Light coaching every few reps, kept short for demo speed.
    if (rep > 1 && rep % 3 === 0) {
      text += ` ${corrections()}`;
    } else if (rep > 1 && rep % 4 === 0) {
      text += ` ${praise()}`;
    }
    lines.push({ at, text, kind: "count" });
  }

  lines.push({
    at: 1.2 + reps * SECONDS_PER_REP,
    text: "Set done. Rest.",
    kind: "phase",
  });

  return lines;
}

export function buildHoldScript(ex: DailyExercise): ScriptLine[] {
  const corrections = rotator(CORRECTIONS[ex.focus_tag] ?? GENERIC_CORRECTIONS);
  const praise = rotator(ENCOURAGEMENT);
  const seconds = Math.max(8, Math.min(90, ex.hold_seconds || 20));

  const lines: ScriptLine[] = [
    { at: 0, text: `Hold for ${seconds}. Settle in.`, kind: "phase" },
  ];

  let t = 3;
  let alternate = 0;
  while (t < seconds - 3) {
    lines.push({
      at: t,
      text: alternate % 3 === 2 ? praise() : corrections(),
      kind: "coach",
    });
    alternate += 1;
    t += 3;
  }

  lines.push({ at: Math.max(1, seconds - 3), text: "Three, two, one.", kind: "count" });
  lines.push({ at: seconds, text: "Relax. Rest.", kind: "phase" });

  return lines;
}

export function scriptDuration(lines: ScriptLine[]): number {
  return Math.ceil(lines.reduce((max, l) => Math.max(max, l.at), 0)) + 1;
}
