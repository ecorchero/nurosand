// Empty = same origin (works on phone via HTTPS tunnel / Next rewrite).
// Override with NEXT_PUBLIC_API_BASE when the API is on a different host.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ---------- types ----------
export type Plan = {
  id: string;
  patient_id: string;
  focus_tags: string[];
  notes: string;
  frequency_per_week: number;
  session_minutes: number;
  active: boolean;
};

export type WellnessSample = {
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  resting_hr: number | null;
  source: string;
};

export type Patient = {
  id: string;
  name: string;
  notes: string;
  avatar_url?: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  emergency_contact?: string;
  doctor_id: string | null;
  plan: Plan | null;
  environment?: EnvironmentCapture[];
  recent_sessions?: WorkoutSession[];
  review_requested?: boolean;
  review_requested_at?: string | null;
  glasses_connected?: boolean;
  glasses_name?: string;
  watch_connected?: boolean;
  watch_name?: string;
  latest_wellness?: WellnessSample | null;
};

export type EnvironmentCapture = {
  id: string;
  patient_id: string;
  media_url: string;
  tags: string[];
  created_at: string;
};

export type ExerciseTemplate = {
  id: string;
  name: string;
  focus_tags: string[];
  instructions: string;
  needs_props: string[];
  cue_scripts: string[];
  base_difficulty: number;
};

export type DailyExercise = {
  template_id: string;
  name: string;
  focus_tag: string;
  instructions: string;
  needs_props: string[];
  cue_scripts: string[];
  difficulty: number;
  reps: number;
  hold_seconds: number;
  rest_seconds: number;
  video_url?: string;
  gif_url?: string;
};

export type DailyPlan = {
  id: string;
  patient_id: string;
  date: string;
  exercises: DailyExercise[];
  rationale: string;
};

export type WorkoutSession = {
  id: string;
  daily_plan_id: string;
  patient_id: string;
  started_at: string;
  completed_at: string | null;
  spoken_cues: string[];
  feedback: Record<string, unknown>;
};

export type FocusProgress = {
  focus: string;
  exercises_logged: number;
  avg_score: number | null;
  completion_pct: number | null;
};

export type WeeklyReport = {
  id: string;
  patient_id: string;
  week_start: string;
  status: "draft" | "signed";
  doctor_notes: string;
  signed_at: string | null;
  signed_by: string | null;
  summary: {
    sessions_completed: number;
    sessions_started: number;
    sessions_planned: number;
    adherence_pct: number | null;
    focus_progress: FocusProgress[];
    wellness: {
      nights_logged: number;
      avg_sleep_hours: number | null;
      avg_sleep_quality: number | null;
    };
  };
};

export type PerfIn = {
  exercise_id?: string;
  exercise_name?: string;
  focus_tag?: string;
  completed?: boolean;
  score?: number;
  difficulty?: number;
  notes?: string;
};

// ---------- calls ----------
export const api = {
  getDoctor: () => req<{ id: string; name: string }>("/api/doctor"),
  listPatients: () => req<Patient[]>("/api/patients"),
  patientLogin: (name: string, password: string) =>
    req<Patient>("/api/patients/login", { method: "POST", body: JSON.stringify({ name, password }) }),
  getPatient: (id: string) => req<Patient>(`/api/patients/${id}`),
  createPatient: (body: {
    name: string;
    notes?: string;
    focus_tags?: string[];
    frequency_per_week?: number;
    session_minutes?: number;
    doctor_id?: string;
  }) =>
    req<Patient>("/api/patients", { method: "POST", body: JSON.stringify(body) }),
  templates: () => req<ExerciseTemplate[]>("/api/exercise-templates"),

  updatePatient: (
    id: string,
    body: {
      name?: string;
      notes?: string;
      avatar_url?: string;
      phone?: string;
      address?: string;
      date_of_birth?: string;
      emergency_contact?: string;
    }
  ) => req<Patient>(`/api/patients/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePatient: (id: string) =>
    req<void>(`/api/patients/${id}`, { method: "DELETE" }),

  savePlan: (id: string, body: Omit<Plan, "id" | "patient_id" | "active">) =>
    req<Plan>(`/api/patients/${id}/plan`, { method: "PUT", body: JSON.stringify(body) }),

  addEnvironment: (id: string, body: { media_url: string; tags: string[] }) =>
    req<EnvironmentCapture>(`/api/patients/${id}/environment`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  addWellness: (
    id: string,
    body: { date?: string; sleep_hours?: number; sleep_quality?: number; source?: string }
  ) =>
    req(`/api/patients/${id}/wellness`, { method: "POST", body: JSON.stringify(body) }),

  getDailyPlan: (id: string, date?: string) =>
    req<DailyPlan | null>(
      `/api/patients/${id}/daily-plan${date ? `?date_str=${date}` : ""}`
    ),
  generateDailyPlan: (id: string, regenerate = false) =>
    req<DailyPlan>(
      `/api/patients/${id}/daily-plan?regenerate=${regenerate}`,
      { method: "POST" }
    ),

  startSession: (daily_plan_id: string) =>
    req<WorkoutSession>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ daily_plan_id }),
    }),
  completeSession: (
    sessionId: string,
    body: { spoken_cues: string[]; feedback: Record<string, unknown>; performance: PerfIn[] }
  ) =>
    req<WorkoutSession>(`/api/sessions/${sessionId}/complete`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  weeklyReports: (id: string) => req<WeeklyReport[]>(`/api/patients/${id}/weekly-reports`),
  signReport: (reportId: string, doctor_id: string, notes: string) =>
    req<WeeklyReport>(`/api/weekly-reports/${reportId}/sign`, {
      method: "POST",
      body: JSON.stringify({ doctor_id, notes }),
    }),

  requestReview: (id: string) => req<Patient>(`/api/patients/${id}/request-review`, { method: "POST" }),
  clearReview: (id: string) => req<Patient>(`/api/patients/${id}/clear-review`, { method: "POST" }),

  setDevice: (id: string, device: "glasses" | "watch", connected: boolean, name?: string) =>
    req<Patient>(`/api/patients/${id}/devices/${device}`, {
      method: "POST",
      body: JSON.stringify({ connected, name: name || "" }),
    }),
};
