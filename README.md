<div align="center">

# 🔭 CivicLens AI

### Autonomous Hyperlocal Civic Issue Resolution Platform

*Vibe2Ship Hackathon 2026 — Community Hero Track*

[![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61dafb?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![Gemini](https://img.shields.io/badge/Gemini-1.5_Flash-4285F4?style=flat-square&logo=google&logoColor=white)](https://aistudio.google.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Motor_Async-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://motor.readthedocs.io)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?style=flat-square&logo=docker&logoColor=white)](https://docker.com)
[![Cloud Run](https://img.shields.io/badge/Cloud_Run-Ready-4285F4?style=flat-square&logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Python](https://img.shields.io/badge/Python-3.10-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

> **A citizen photographs a pothole. Three seconds later, a formal municipal report is drafted,  
> geo-plotted on a live map, and queued for autonomous community verification — all by AI agents.**

</div>

---

## ✨ What Makes This Different

Most civic reporting apps are digital suggestion boxes. CivicLens AI is an **autonomous multi-agent pipeline** that removes human bottlenecks at every step:

| Step | What Happens | Powered By |
|:---:|---|---|
| 📸 **Photo uploaded** | Gemini Vision classifies, severity-rates, and drafts a municipal email in < 3 s | Intake Agent (Gemini 1.5 Flash) |
| 🗺️ **Issue plotted** | Live Google Maps dashboard updates instantly with a severity-coded pin | Google Maps JS API |
| 🤖 **Community verifies** | A second Gemini agent independently scores the issue, writes an impact analysis and action plan | Consensus Agent (Gemini 1.5 Flash) |
| ✅ **Auto-promoted** | At 3 community votes, status advances to "Verified" automatically | FastAPI + MongoDB |
| 🏆 **Points awarded** | Citizen earns +50 Civic Points; badge tier updates in real time | React frontend |

---

## 🏗 Architecture

```
CivicLensAI/
│
├── Dockerfile                  # Multi-stage: Node 18 Alpine builder → Python 3.10 slim runtime
├── .dockerignore               # Excludes node_modules, venv, .env files from image context
├── start.py                    # One-click local launcher (starts both servers cleanly)
├── SUBMISSION_DOC.md           # Hackathon submission document
│
├── backend/                    # FastAPI Python backend
│   ├── main.py                 # ★ Entry point — unified serving (API + React SPA)
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # Secret keys (never committed)
│   ├── .env.example            # Template for contributors
│   │
│   ├── api/
│   │   ├── intake.py           # POST /api/v1/report/analyze  →  Intake Agent
│   │   └── issues.py           # GET  /api/v1/issues
│   │                           # GET  /api/v1/issues/summary
│   │                           # POST /api/v1/issues/{id}/verify  →  Consensus Agent
│   │
│   ├── config/
│   │   ├── settings.py         # Pydantic-Settings: all env vars in one place
│   │   └── database.py         # Motor async MongoDB client + connection lifecycle
│   │
│   ├── models/
│   │   └── issue.py            # Pydantic v2 data models, enums (Category, Severity, Status)
│   │
│   └── services/
│       └── gemini_service.py   # Gemini 1.5 Flash singleton — shared by both agents
│
└── frontend/                   # React 18 + Vite 8 + Tailwind CSS v3
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    ├── .env                    # VITE_API_BASE_URL, VITE_GOOGLE_MAPS_API_KEY
    │
    └── src/
        ├── App.jsx             # Tab navigation: Dashboard ↔ Report an Issue
        ├── main.jsx
        │
        ├── api/
        │   └── client.js       # Typed fetch wrapper for all API calls
        │
        └── components/
            ├── Dashboard.jsx   # Metric cards + 60/40 split: map + live feed
            ├── IssueMap.jsx    # Google Maps + severity SVG markers + InfoWindow
            ├── IssueFeed.jsx   # Scrollable feed + Verify button + agent result panel
            ├── IntakeForm.jsx  # Drag-and-drop upload + GPS + AI result card
            ├── ResultCard.jsx  # Renders the Intake Agent's structured analysis
            └── SeverityBadge.jsx
```

### Request Flow

```
Browser → FastAPI → /api/v1/report/analyze
                        └── Intake Agent (Gemini Vision)
                                └── MongoDB (persist)
                                        └── Dashboard (map + feed update)
                                                └── /api/v1/issues/{id}/verify
                                                        └── Consensus Agent (Gemini Text)
                                                                └── MongoDB (update votes/status)
                                                                        └── +50 Civic Points
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites

| Requirement | Version | Where to Get It |
|---|---|---|
| Python | 3.10+ | [python.org](https://python.org) |
| Node.js | 18 LTS+ | [nodejs.org](https://nodejs.org) |
| MongoDB | Any | Local install or [Atlas free tier](https://www.mongodb.com/atlas) |
| Google AI Studio API Key | — | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| Google Maps API Key | — | Enable *Maps JavaScript API* in [Cloud Console](https://console.cloud.google.com) |

---

### Option A — One-Command Launcher ✅ Recommended

```powershell
# 1. Clone the repository
git clone https://github.com/your-org/civiclens-ai.git
cd CivicLensAI

# 2. Create the Python virtual environment (one-time setup)
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..

# 3. Configure your environment files
Copy-Item backend\.env.example backend\.env
# Open backend\.env and fill in GOOGLE_API_KEY and MONGODB_URI

# Add your Google Maps key to frontend/.env
# VITE_GOOGLE_MAPS_API_KEY=AIza...

# 4. Launch everything
.\backend\venv\Scripts\activate
python start.py
```

> ✅ Opens **http://localhost:5173** (React dev server) and **http://localhost:8000** (FastAPI).  
> `Ctrl+C` shuts both processes down cleanly.

---

### Option B — Manual (Two Terminals)

**Terminal 1 — Backend:**
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm install
npm run dev
```

> Frontend: **http://localhost:5173** · API Docs: **http://localhost:8000/docs**

---

## 🔑 Environment Variables

### `backend/.env`

```ini
# ── Required ─────────────────────────────────────────────────────────
GOOGLE_API_KEY=AIzaSy...          # Google AI Studio key (powers both Gemini agents)
MONGODB_URI=mongodb+srv://...     # MongoDB Atlas or local connection string

# ── Optional (sensible defaults provided) ────────────────────────────
MONGODB_DB_NAME=civiclens
APP_VERSION=2.0.0
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### `frontend/.env`

```ini
VITE_API_BASE_URL=http://localhost:8000      # Backend origin (empty string in production)
VITE_GOOGLE_MAPS_API_KEY=AIzaSy...          # Google Maps JavaScript API key
```

> **Production note:** When running in Docker / Cloud Run, `VITE_API_BASE_URL` is set to `""` at build time so all API requests go to the same origin that serves the SPA.

---

## 🤖 GenAI Agent Deep-Dive

### Agent 1 — Civic Intake Agent

**Endpoint:** `POST /api/v1/report/analyze`

```
Input:   Multipart form — image file (JPEG/PNG/WebP, ≤10 MB) + optional lat/lng
Model:   Gemini 1.5 Flash  (Vision mode)
System:  "You are a Professional Civil Engineering Auditor…"
Config:  temperature=0.1, response_mime_type="application/json"

Output (structured JSON):
{
  "category":           "Road Damage",
  "severity":           "High",
  "severity_rationale": "The pothole spans the full lane width with >10 cm depth…",
  "clean_description":  "A severe road cavity located at the intersection of…",
  "municipal_draft":    "Dear Municipal Works Department, I am writing to formally…"
}

Pipeline:
  1. Validate image (type + size guard)
  2. Send bytes + GPS to Gemini Vision
  3. Parse response (JSON MIME-type first, regex fallback for reliability)
  4. Persist IssueDocument to MongoDB with GeoJSON coordinates
  5. Return enriched JSON to React frontend
```

**Why `temperature=0.1`?** Lower temperature produces consistent, professional language in the municipal draft — critical when the output may be sent directly to government officials.

---

### Agent 2 — Community Consensus Agent

**Endpoint:** `POST /api/v1/issues/{id}/verify`

```
Input:   Issue ID (MongoDB ObjectId)
Model:   Gemini 1.5 Flash  (Text mode)
System:  "You are a Community Consensus Agent for a civic reporting platform…"
Config:  temperature=0.2, response_mime_type="application/json"

Output (structured JSON):
{
  "verification_score": 87,
  "impact_analysis":    "This pothole poses a direct safety risk to cyclists…",
  "action_plan":        "1. Emergency patch within 48 hours. 2. Full resurface…"
}

Pipeline:
  1. Fetch IssueDocument from MongoDB by ID
  2. Build prompt from category + severity + description
  3. Call Gemini (independent of Intake Agent — no shared context)
  4. Increment community_votes on the document
  5. If votes ≥ 3: auto-promote status → "Verified"
  6. Award +50 Civic Points (returned in response for frontend to update)
```

---

## 📡 API Reference

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/v1/report/analyze` | Upload image + GPS → Intake Agent → MongoDB | None |
| `GET` | `/api/v1/issues` | List all issues (≤200, newest first) | None |
| `GET` | `/api/v1/issues/summary` | Aggregate metrics: total / severe / resolved | None |
| `POST` | `/api/v1/issues/{id}/verify` | Trigger Consensus Agent on an issue | None |
| `GET` | `/health` | Application health check | None |
| `GET` | `/docs` | Interactive Swagger UI (FastAPI auto-generated) | None |
| `GET` | `/redoc` | ReDoc API documentation | None |
| `GET` | `/*` | React SPA (index.html) — React Router handles routing | None |

---

## 🐳 Docker Deployment

### Build & Run Locally

```bash
# Build the multi-stage image (~4–5 min on first run)
docker build -t civiclens-ai .

# Run with environment variables
docker run -p 8080:8080 --env-file backend/.env civiclens-ai

# App available at http://localhost:8080
# FastAPI serves both the React SPA and the /api/* endpoints from a single container
```

### Deploy to Google Cloud Run

```bash
# 1. Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# 2. Build and push to Artifact Registry
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/civiclens-ai

# 3. Deploy (Cloud Run auto-injects PORT)
gcloud run deploy civiclens-ai \
  --image gcr.io/YOUR_PROJECT_ID/civiclens-ai \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --set-env-vars GOOGLE_API_KEY=YOUR_KEY,MONGODB_URI=YOUR_URI

# 4. Set your Maps key in frontend/.env before building:
#    VITE_GOOGLE_MAPS_API_KEY=YOUR_MAPS_KEY
```

> **Cloud Run + PORT:** The Dockerfile and `main.py` both read `PORT` from the environment at runtime. Cloud Run injects this automatically — you never need to hard-code it.

### Docker Architecture

```
┌─────────────────────────────────────────────────┐
│  STAGE 1: builder  (node:18-alpine)             │
│                                                 │
│  COPY frontend/package*.json  → npm ci          │
│  COPY frontend/               → npm run build   │
│  Output: /app/frontend/dist/                    │
└───────────────────────┬─────────────────────────┘
                        │ COPY --from=builder
                        ▼
┌─────────────────────────────────────────────────┐
│  STAGE 2: runtime  (python:3.10-slim)           │
│                                                 │
│  pip install -r requirements.txt                │
│  COPY backend/  →  /app/                        │
│  dist/          →  /app/frontend/dist/          │
│                                                 │
│  USER: civiclens (non-root, security hardened)  │
│  HEALTHCHECK: GET /health every 30s             │
│  CMD: uvicorn main:app --host 0.0.0.0 --port $PORT │
└─────────────────────────────────────────────────┘
```

---

## 🎨 Design System

The entire UI uses a custom dark design system built on **Tailwind CSS v3**:

| Token | Value | Used For |
|---|---|---|
| Background | `slate-950` | Page background |
| Surface | `slate-900/70` | Cards with glassmorphism |
| Primary | `teal-400 / teal-500` | Buttons, active states, highlights |
| Accent | `amber-500` | Warnings, medium severity |
| Danger | `red-500` | High severity, errors |
| Border | `teal-500/20` | Glassmorphic card borders |
| Blur | `backdrop-blur-16` | Glass effect on cards |
| Font (UI) | Inter (Google Fonts) | All body and UI text |
| Font (Code) | JetBrains Mono | Coordinates, IDs, code blocks |

**Animations:**
- Shimmer loading skeletons on data fetch
- Scan-line sweep effect on the dashboard header
- Slide-up entrance for newly verified issue panels
- Pulse dots on active status indicators
- Hover lift (`translateY(-2px)`) on all interactive cards

**Map Theme:**
- 18-rule custom Google Maps dark style matching `slate-950` / `teal` palette
- Custom SVG markers with severity color fill, drop shadows, and pulse rings

---

## 🏆 Civic Points Tier System

| Points Range | Tier | Description |
|:---:|---|---|
| 0 – 49 | 🌱 Newcomer | Just getting started |
| 50 – 199 | 🏙️ Active Citizen | Making a difference |
| 200 – 499 | 🛡️ City Guardian | A true community leader |
| 500+ | 🦸 Civic Hero | Legendary contributor |

Each **verified** issue awards **+50 points**. Points are tracked in the React session state and displayed in the persistent top-bar badge.

---

## 🧠 Full Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | React | 18 |
| **Build Tool** | Vite | 8 |
| **Styling** | Tailwind CSS | v3 |
| **Mapping** | Google Maps JavaScript API (`@react-google-maps/api`) | Latest |
| **Backend Framework** | FastAPI | 0.111 |
| **ASGI Server** | Uvicorn | 0.29 |
| **Data Validation** | Pydantic | v2 |
| **Database Driver** | Motor (async) | 3.4 |
| **Database** | MongoDB | Any |
| **AI / Vision** | Google Gemini 1.5 Flash | — |
| **Containerization** | Docker (multi-stage) | — |
| **Cloud Platform** | Google Cloud Run | — |
| **Language (Backend)** | Python | 3.10+ |
| **Language (Frontend)** | JavaScript (ES2022) | — |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Follow existing patterns — Pydantic models for data, async/await throughout the backend
4. Test with `python -m pytest` (backend) and `npm run dev` (frontend)
5. Open a Pull Request with a clear description

---

<div align="center">

*Built with ❤️ for the Vibe2Ship Hackathon 2026*

**Backend:** FastAPI · MongoDB · Pydantic v2 &nbsp;|&nbsp; **AI:** Google Gemini 1.5 Flash &nbsp;|&nbsp; **Maps:** Google Maps JS API &nbsp;|&nbsp; **Cloud:** Google Cloud Run

</div>
