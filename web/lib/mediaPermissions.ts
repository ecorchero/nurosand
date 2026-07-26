/** iOS Safari only shows mic/camera prompts in a secure context (HTTPS or localhost). */

export function isSecureMediaContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext === true;
}

export async function ensureMicrophone(): Promise<"granted" | "denied" | "insecure"> {
  if (typeof window === "undefined") return "denied";
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "denied";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Release immediately; SpeechRecognition / later capture will re-acquire.
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch {
    return "denied";
  }
}

export async function ensureCamera(): Promise<"granted" | "denied" | "insecure"> {
  if (typeof window === "undefined") return "denied";
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "denied";

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    stream.getTracks().forEach((t) => t.stop());
    return "granted";
  } catch {
    return "denied";
  }
}
