/** Hardcoded demo metrics for the mockup-style dashboards. */

export const PATIENT_DEMO = {
  dailyGoal: 78,
  sessionsDone: 1,
  sessionsTarget: 2,
  exerciseMin: 12,
  exerciseTarget: 15,
  streak: 7,
  sleep: { score: 72, delta: 6, spark: [58, 61, 64, 62, 68, 70, 72] },
  balance: { score: 76, delta: 9, spark: [60, 63, 65, 68, 70, 73, 76] },
  cognitive: { score: 71, delta: 7, spark: [55, 58, 60, 63, 66, 68, 71] },
  sessionName: "NeuroBalance Advanced",
  sessionMeta: "45 min · Balance & Coordination",
  sessionTime: "10:00 AM",
};

export const DOCTOR_DEMO = {
  activePatients: { value: "128", delta: "+12%", spark: [90, 95, 100, 108, 112, 118, 128], color: "#3b82f6" },
  adherence: { value: "78%", delta: "+8%", spark: [62, 65, 68, 70, 72, 75, 78], color: "#22a06b" },
  balanceTrend: { value: "+14%", delta: "vs last 7 days", spark: [40, 48, 55, 60, 68, 72, 76], color: "#22a06b" },
  cognitive: { value: "+11%", delta: "vs last 7 days", spark: [45, 50, 55, 58, 62, 66, 71], color: "#3b82f6" },
  sleep: { value: "72/100", delta: "+6 pts", spark: [58, 60, 64, 66, 68, 70, 72], color: "#3b82f6" },
  weekSeries: {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    motor: [68, 70, 72, 74, 76, 79, 82],
    balance: [62, 64, 66, 68, 70, 73, 76],
    cognitive: [58, 60, 62, 64, 66, 68, 71],
  },
  detail: {
    motor: { score: 82, delta: 12, blurb: "Coordination, Strength, Endurance" },
    balance: { score: 76, delta: 9, blurb: "Stability, Posture, Gait" },
    cognitive: { score: 71, delta: 7, blurb: "Memory, Attention, Processing" },
  },
};

export function fakeAdherence(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 3)) % 37;
  return 62 + (h % 28);
}

export function fakeSpark(seed: number): number[] {
  const base = 50 + (seed % 20);
  return Array.from({ length: 7 }, (_, i) => base + ((seed + i * 7) % 15));
}

function hashName(name: string, salt = 0): number {
  let h = salt * 17;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i) * (i + 1)) >>> 0;
  return h;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Deterministic 7-day series so each patient gets a distinct weekly chart. */
export function fakeWeekSeries(name: string) {
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const series = (salt: number, startBase: number, riseBase: number) => {
    const h = hashName(name, salt);
    let v = startBase + (h % 18);
    const rise = riseBase + ((h >> 3) % 6);
    const wobble = ((h >> 5) % 5) - 2;
    return Array.from({ length: 7 }, (_, i) => {
      const dip = i === 2 || i === 5 ? -((h >> (i + 2)) % 4) : 0;
      v = clamp(v + rise / 6 + wobble * 0.3 + dip + ((h + i * 11) % 3) - 1, 40, 96);
      return v;
    });
  };

  return {
    labels,
    motor: series(1, 58, 10),
    balance: series(2, 52, 12),
    cognitive: series(3, 48, 9),
  };
}

export function fakeDetail(name: string) {
  const week = fakeWeekSeries(name);
  const delta = (vals: number[]) => clamp(vals[6] - vals[0], 2, 18);
  return {
    motor: {
      score: week.motor[6],
      delta: delta(week.motor),
      blurb: "Coordination, Strength, Endurance",
    },
    balance: {
      score: week.balance[6],
      delta: delta(week.balance),
      blurb: "Stability, Posture, Gait",
    },
    cognitive: {
      score: week.cognitive[6],
      delta: delta(week.cognitive),
      blurb: "Memory, Attention, Processing",
    },
  };
}
