# Nurosand Web (Phase 1)

Web-only rehab coaching MVP: a **Next.js frontend** talking to a **FastAPI (Python) backend**.

Closed feedback loop:

```
session performance + sleep -> daily adapter -> session (voice cues)
    -> weekly report -> doctor sign-off -> back into the adapter
```

## Run the backend (FastAPI)

Requires Python 3.11/3.12 (3.14 is too new for the pinned wheels).

```bash
cd web/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API: http://127.0.0.1:8000  (docs at `/docs`)
- On first start it seeds a demo doctor + 2 patients + exercise templates into `web/backend/nurosand.db`.
- Delete `nurosand.db` to reset.

## Run the frontend (Next.js)

```bash
cd web
npm install
npm run dev
```

- App: http://localhost:3000
- Frontend reads the API base from `NEXT_PUBLIC_API_BASE` (defaults to `http://127.0.0.1:8000`).

## Try the flow

1. **Doctor** (`/doctor`): pick a patient, set focus areas / notes, save the plan. Review the
   weekly report (sessions, adherence, per-focus progress, sleep) and **Sign off** with notes.
2. **Patient** (`/patient`): pick a patient, tick environment props, log last night's sleep, then
   **Generate** today's session (adapted from plan + environment + recent performance + sleep +
   signed doctor notes).
3. **Session**: step through exercises with spoken coaching (**ElevenLabs** when configured,
   otherwise Samantha / browser TTS). Rate each one; results feed the weekly report and tomorrow's plan.

## Voice (ElevenLabs)

1. Get an API key from https://elevenlabs.io
2. In `web/backend/`:

```bash
cp .env.example .env
# edit .env and set ELEVENLABS_API_KEY=sk_...
```

3. Restart the FastAPI server. Session cues go through `POST /api/tts`.
   Optional: set `ELEVENLABS_VOICE_ID` / `ELEVENLABS_VOICE_NAME` to pick another voice
   (default is Rachel). Without a key, coaching falls back to Samantha / system TTS.

On iPhone, pairing Ray-Ban glasses as the phone's Bluetooth audio output plays coaching through the glasses.

## Notes

- Apple Watch HR/IMU and real HealthKit sleep are Phase 2; Ray-Ban camera/CV is Phase 3.
