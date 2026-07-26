// Browser speech recognition helpers for hands-free session control.

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: {
      isFinal: boolean;
      length: number;
      [j: number]: { transcript: string };
    };
  };
};

type SpeechRecCtor = new () => SpeechRec;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecCtor;
    webkitSpeechRecognition?: SpeechRecCtor;
  }
}

export function speechListenSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

export type ListenSession<T> = {
  result: Promise<T | "cancelled" | "unsupported">;
  stop: () => void;
};

export function listenForMatch<T>(opts: {
  match: (transcript: string) => T | null;
  onHeard?: (transcript: string) => void;
  onError?: (message: string) => void;
}): ListenSession<T> {
  const Ctor =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : undefined;

  if (!Ctor) {
    return {
      result: Promise.resolve("unsupported"),
      stop: () => undefined,
    };
  }

  let settled = false;
  let resolve!: (v: T | "cancelled" | "unsupported") => void;
  const result = new Promise<T | "cancelled" | "unsupported">((r) => {
    resolve = r;
  });

  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = true;
  rec.lang = "en-US";
  rec.maxAlternatives = 1;

  const finish = (v: T | "cancelled" | "unsupported") => {
    if (settled) return;
    settled = true;
    try {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      rec.abort();
    } catch {
      /* ignore */
    }
    resolve(v);
  };

  rec.onresult = (ev) => {
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const transcript = Array.from({ length: ev.results[i].length }, (_, j) =>
        ev.results[i][j].transcript
      )
        .join(" ")
        .trim();
      if (!transcript) continue;
      opts.onHeard?.(transcript);
      const matched = opts.match(transcript);
      if (matched !== null) {
        finish(matched);
        return;
      }
    }
  };

  rec.onerror = (ev) => {
    const err = ev.error || "unknown";
    if (err === "aborted" || err === "no-speech") return;
    if (err === "not-allowed" || err === "service-not-allowed") {
      opts.onError?.("Microphone permission denied.");
      finish("unsupported");
      return;
    }
    opts.onError?.(`Mic error: ${err}`);
  };

  rec.onend = () => {
    if (settled) return;
    try {
      rec.start();
    } catch {
      finish("cancelled");
    }
  };

  try {
    rec.start();
  } catch {
    finish("unsupported");
  }

  return {
    result,
    stop: () => finish("cancelled"),
  };
}

const GO_RE = /\b(go|ready|start|begin|okay|ok|yes)\b/i;

export function listenForGo(opts?: {
  onHeard?: (transcript: string) => void;
  onError?: (message: string) => void;
}): ListenSession<"heard"> {
  return listenForMatch({
    ...opts,
    match: (t) => (GO_RE.test(t) ? "heard" : null),
  });
}

/** Confirm Meta glasses are on before starting the (webcam) room scan. */
const GLASSES_ON_RE =
  /\b(ok|okay|on|ready|yes|done|they'?re on|glasses on|i'?m ready|got them)\b/i;

export function listenForGlassesOn(opts?: {
  onHeard?: (transcript: string) => void;
  onError?: (message: string) => void;
}): ListenSession<"heard"> {
  return listenForMatch({
    ...opts,
    match: (t) => (GLASSES_ON_RE.test(t) ? "heard" : null),
  });
}

/** End the glasses room scan recording. */
const SCAN_STOP_RE =
  /\b(stop|done|finished|finish|complete|enough|that'?s it|that is it|end)\b/i;

export function listenForScanStop(opts?: {
  onHeard?: (transcript: string) => void;
  onError?: (message: string) => void;
}): ListenSession<"heard"> {
  return listenForMatch({
    ...opts,
    match: (t) => (SCAN_STOP_RE.test(t) ? "heard" : null),
  });
}

export type VoiceRating = "nailed" | "ok" | "struggled" | "skipped";

export function matchRating(transcript: string): VoiceRating | null {
  const t = transcript.toLowerCase();
  if (/\b(skip|skipped|skip it)\b/.test(t)) return "skipped";
  if (/\b(struggle|struggled|hard|tough|bad)\b/.test(t)) return "struggled";
  if (/\b(nail|nailed|great|perfect|easy|excellent)\b/.test(t)) return "nailed";
  if (/\b(ok|okay|fine|alright|all right|good)\b/.test(t)) return "ok";
  return null;
}

export function listenForRating(opts?: {
  onHeard?: (transcript: string) => void;
  onError?: (message: string) => void;
}): ListenSession<VoiceRating> {
  return listenForMatch({
    ...opts,
    match: matchRating,
  });
}
