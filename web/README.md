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

## Deploy the backend on Vercel

The backend can deploy as a Vercel Python/FastAPI project, separate from the Next.js
frontend project:

1. Create a **second** Vercel project from this same repo.
2. Set **Root Directory** to `web/backend` and **Framework Preset** to **FastAPI**.
3. Set the `ELEVENLABS_API_KEY` (and optional `ELEVENLABS_VOICE_*`) env vars if you
   want real TTS instead of the browser fallback.
4. Deploy. Requests hit `api/index.py`, which just re-exports the existing
   `app.main:app` FastAPI instance — `vercel.json` rewrites all paths to it.
5. Point the frontend's `NEXT_PUBLIC_API_BASE` at this backend's Vercel URL.

**Important caveat — SQLite does not persist on Vercel.** Vercel's deployed
filesystem is read-only outside `/tmp`, and `/tmp` is wiped on every cold start and
isn't shared across concurrent function instances. `app/db.py` falls back to
`/tmp/nurosand.db` automatically when `VERCEL` is set, so the app won't crash, but
data written in one request (a new patient, a logged session, a signed report) can
disappear the next time a different instance handles a request. This is fine for
kicking the tyres, but for real use, swap `app/db.py` to point at a hosted database
(Postgres via Neon/Vercel Postgres, or Turso) instead of relying on the SQLite file —
or deploy the backend to a host with a persistent disk (Render, Fly.io, Railway).

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

- This folder is the **main hackathon deliverable**: closed-loop doctor ↔ patient web flow.
- Apple Watch HR/IMU streaming and Meta Ray-Ban camera are **working pipelines elsewhere in the repo** (`Nurosand Watch App/`, `server/`, `ios-rayban/`) but are **not yet wired into this web app**. Wearable connection and environment scan in the UI are demoed / simulated for now. See the root [`README.md`](../README.md) for status and next steps.
