// Voice coach: ElevenLabs via FastAPI when configured, else Samantha (browser).
// On iPhone, pairing Ray-Ban as BT audio output routes playback through the glasses.

import { API_BASE } from "./api";

type VoiceInfo = { provider: "elevenlabs" | "browser"; voice: string; configured: boolean };

let voiceInfo: VoiceInfo | null = null;
let cachedBrowserVoice: SpeechSynthesisVoice | null = null;
let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let speakSeq = 0;

function pickSamantha(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const byName = (re: RegExp) => voices.find((v) => re.test(v.name));
  return (
    byName(/^Samantha \(Enhanced\)/i) ||
    byName(/^Samantha \(Premium\)/i) ||
    byName(/^Samantha$/i) ||
    byName(/Samantha/i) ||
    byName(/Karen/i) ||
    voices.find((v) => v.lang.startsWith("en") && v.localService) ||
    voices.find((v) => v.lang.startsWith("en")) ||
    null
  );
}

function refreshBrowserVoice() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) cachedBrowserVoice = pickSamantha(voices);
}

export function canSpeak(): boolean {
  return (
    typeof window !== "undefined" &&
    (typeof window.speechSynthesis !== "undefined" || typeof window.Audio !== "undefined")
  );
}

export async function warmVoices(): Promise<{ name: string } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/tts/status`, { cache: "no-store" });
    if (res.ok) {
      voiceInfo = (await res.json()) as VoiceInfo;
      if (voiceInfo.configured) {
        return { name: voiceInfo.voice };
      }
    }
  } catch {
    // fall through to browser
  }

  refreshBrowserVoice();
  if (!cachedBrowserVoice && "speechSynthesis" in window) {
    await new Promise<void>((resolve) => {
      const done = () => {
        refreshBrowserVoice();
        window.speechSynthesis.removeEventListener("voiceschanged", done);
        resolve();
      };
      window.speechSynthesis.addEventListener("voiceschanged", done);
      window.setTimeout(done, 400);
    });
  }
  voiceInfo = {
    provider: "browser",
    configured: false,
    voice: cachedBrowserVoice?.name || "Samantha (system)",
  };
  return { name: voiceInfo.voice };
}

export function currentVoiceName(): string | null {
  return voiceInfo?.voice ?? cachedBrowserVoice?.name ?? null;
}

function stopBrowser() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function stopAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
}

export function stopSpeaking() {
  speakSeq += 1;
  stopBrowser();
  stopAudio();
}

function speakBrowser(text: string) {
  if (!("speechSynthesis" in window)) return;
  refreshBrowserVoice();
  stopBrowser();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.pitch = 1;
  u.lang = "en-US";
  if (cachedBrowserVoice) {
    u.voice = cachedBrowserVoice;
    u.lang = cachedBrowserVoice.lang || "en-US";
  }
  window.speechSynthesis.speak(u);
}

async function speakEleven(text: string, seq: number) {
  const res = await fetch(`${API_BASE}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(err || `TTS ${res.status}`);
  }
  if (seq !== speakSeq) return; // superseded
  const blob = await res.blob();
  if (seq !== speakSeq) return;
  stopAudio();
  const url = URL.createObjectURL(blob);
  currentObjectUrl = url;
  const audio = new Audio(url);
  currentAudio = audio;
  await audio.play();
}

export function speak(text: string) {
  if (!text || typeof window === "undefined") return;
  const seq = ++speakSeq;
  stopBrowser();
  stopAudio();

  const useEleven = voiceInfo?.configured === true;
  if (useEleven) {
    speakEleven(text, seq).catch(() => {
      if (seq === speakSeq) speakBrowser(text);
    });
    return;
  }
  speakBrowser(text);
}
