const DOCTOR_KEY = "nurosand_doctor_auth";
const PATIENT_KEY_PREFIX = "nurosand_patient_auth_";

export const DOCTOR_PASSWORD = "doc";

export function lastNamePassword(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return (parts[parts.length - 1] || "").toLowerCase();
}

export function isDoctorAuthed(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(DOCTOR_KEY) === "1";
}

export function setDoctorAuthed(): void {
  sessionStorage.setItem(DOCTOR_KEY, "1");
}

export function clearDoctorAuthed(): void {
  sessionStorage.removeItem(DOCTOR_KEY);
}

export function isPatientAuthed(patientId: string): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(PATIENT_KEY_PREFIX + patientId) === "1";
}

export function setPatientAuthed(patientId: string): void {
  sessionStorage.setItem(PATIENT_KEY_PREFIX + patientId, "1");
}

export function clearPatientAuthed(patientId: string): void {
  sessionStorage.removeItem(PATIENT_KEY_PREFIX + patientId);
}
