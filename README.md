<div align="center">

<img src="web/public/nurosand-logo.png" alt="Nurosand" width="320" />

### Closed-loop neurorehab that fits your day

Adaptive daily exercises, hands-free voice coaching, and weekly clinician sign-off, all connected in one feedback loop.

</div>

---

## What it does

Nurosand turns neuro-rehab into a **closed feedback loop** between the patient at home and their clinician:

1. **Doctor** sets a care plan (focus areas, frequency, notes) for each patient.
2. **Daily adapter** builds today's session from the plan + recent performance + sleep + the last signed doctor note.
3. **Patient** runs a hands-free, voice-guided session with live form feedback and exercise demos.
4. **Weekly report** summarizes adherence, per-focus progress and sleep for the doctor to review and **sign off**.
5. That sign-off feeds straight back into the adapter, closing the loop.

```
session performance + sleep ─▶ daily adapter ─▶ voice-guided session
        ▲                                              │
        │                                              ▼
   doctor sign-off ◀── weekly report ◀── logged results
```

## Highlights

- **Clinician dashboard** — caseload overview, per-patient weekly improvement charts, alerts, and one-tap report sign-off.
- **Patient app** — today's session, wearable data, environment scan, and a post-session **Nuroport** review with video form clips and per-clip feedback.
- **Hands-free coaching** — say "go" to start; the coach walks you through every rep with simulated real-time cues ("stay steady", "that's 1, 2, great job").
- **Voice** — high-quality ElevenLabs TTS when configured, with a graceful browser/Samantha fallback.
- **Wearables** — Apple Watch heart-rate/IMU streaming and Meta Ray-Ban glasses for hands-free environment scanning.

## Tech stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS |
| Backend | FastAPI, SQLModel, SQLite |
| Voice | ElevenLabs TTS (browser fallback) |
| Wearables | watchOS (HealthKit + TCP stream), Meta Wearables Device Access Toolkit |

## Repository layout

| Path | Role |
|------|------|
| `web/` | Main product: Next.js frontend + FastAPI backend (start here) |
| `web/app/` | Doctor and patient pages (App Router) |
| `web/backend/app/` | API, daily adapter, weekly reports, seed data |
| `Nurosand Watch App/` | watchOS app streaming heart rate / motion |
| `server/` | Local TCP + HTTP/SSE receiver for Watch samples |
| `ios-rayban/` | Notes for the Meta Ray-Ban camera sample (SDK cloned separately) |

## Quick start (web app)

**Backend** (Python 3.11 / 3.12):

```bash
cd web/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. On first run the backend seeds a demo doctor, patients and exercise library into `web/backend/nurosand.db` (delete that file to reset).

Try it: open **/doctor** to set a plan and sign a report, or **/patient** to run a voice-guided session and view the Nuroport.

See [`web/README.md`](web/README.md) for backend deploy notes, ElevenLabs setup, and the full flow. Wearable setup lives in the [root Watch guide](#apple-watch-heart-rate-stream) below and [`ios-rayban/README.md`](ios-rayban/README.md).

## Apple Watch heart-rate stream

Stream live Apple Watch heart rate to a browser graph over your local network.

```bash
python3 server/receiver.py          # listens on TCP 8765, serves the graph
ipconfig getifaddr en0              # find your Mac's LAN IP
```

Open `Nurosand.xcodeproj` in Xcode, run the **Nurosand Watch App** scheme on a physical Watch, enter your Mac's IP, and tap **Start**. Watch and Mac must share Wi-Fi; real optical HR needs a physical Watch.

Watch sends newline-delimited JSON over TCP: `{"bpm":72,"t":1710000000.0}`

## Meta Ray-Ban glasses

The `ios-rayban/` folder documents running Meta's Wearables Device Access Toolkit camera sample for hands-free environment scanning. The vendored SDK is cloned separately (it is git-ignored here); see [`ios-rayban/README.md`](ios-rayban/README.md).

---

<div align="center">
Built for a hackathon. Demo data is seeded and some metrics are illustrative.
</div>
