from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, Tuple

import httpx

# Load web/backend/.env if present (does not override real env).
try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:
    pass

# Rachel: clear, natural default coaching voice. Override with ELEVENLABS_VOICE_ID.
DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"
DEFAULT_MODEL = "eleven_turbo_v2_5"


def is_configured() -> bool:
    return bool(os.environ.get("ELEVENLABS_API_KEY", "").strip())


def voice_label() -> str:
    name = os.environ.get("ELEVENLABS_VOICE_NAME", "Rachel").strip() or "Rachel"
    return f"ElevenLabs · {name}"


async def synthesize(text: str) -> Tuple[bytes, str]:
    """Return (audio_bytes, content_type). Raises RuntimeError on failure."""
    api_key = os.environ.get("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set")

    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", DEFAULT_VOICE_ID).strip() or DEFAULT_VOICE_ID
    model_id = os.environ.get("ELEVENLABS_MODEL_ID", DEFAULT_MODEL).strip() or DEFAULT_MODEL

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {
        "xi-api-key": api_key,
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
    }
    payload = {
        "text": text.strip(),
        "model_id": model_id,
        "voice_settings": {
            "stability": 0.45,
            "similarity_boost": 0.75,
            "style": 0.15,
            "use_speaker_boost": True,
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.post(url, headers=headers, json=payload)
        if res.status_code >= 400:
            detail = res.text[:300]
            raise RuntimeError(f"ElevenLabs {res.status_code}: {detail}")
        return res.content, res.headers.get("content-type", "audio/mpeg")
