# CivicLens AI — Official Submission Document
### Vibe2Ship Hackathon 2026

---

## 1. Problem Statement Selected

> **Community Hero — Hyperlocal Problem Solver**

Millions of civic infrastructure issues — potholes, broken streetlights, illegal dumping sites, flooding drains — go unreported or unresolved for months, sometimes years. Not because citizens don't care, but because the reporting process is **too slow, too manual, and produces zero accountability**.

Existing 311 apps generate static tickets that disappear into bureaucratic queues with:
- ❌ No AI augmentation or intelligent classification
- ❌ No community verification or peer accountability
- ❌ No feedback loop to the reporting citizen
- ❌ No geo-spatial aggregation to identify issue hotspots

The result: civic decay compounds quietly while digital tools that should help remain stuck in the 2010s.

---

## 2. Solution Overview

**CivicLens AI** is an autonomous, multi-agent civic intelligence platform that transforms a single citizen photograph into a fully structured, AI-verified municipal action item — **end to end, without any manual intervention**.

Rather than building another digital suggestion box, we built a **living civic intelligence network** powered by two autonomous Gemini agents operating in sequence:

### How It Works

**Step 1 — Citizen captures a civic issue**
A resident photographs a pothole, a broken streetlight, or an illegal dump. They open CivicLens AI, drag-and-drop the photo, and optionally share their GPS coordinates. That's the only manual step.

**Step 2 — The Intake Agent activates (< 3 seconds)**
The image is sent to **Gemini 2.5 Flash** operating as a "Professional Civil Engineering Auditor." The agent performs computer-vision-grade analysis and returns a fully structured JSON response:
- Issue **category** (Road Damage, Electrical, Sanitation, etc.)
- Structural **severity** rating: Low / Medium / High
- Engineering **severity rationale** explaining *why* that rating was assigned
- A clean, formal **description** of the issue
- A **ready-to-send municipal email draft** addressed to the relevant department

The entire AI pipeline completes in under 3 seconds. The issue is immediately persisted to MongoDB and appears on the live dashboard.

**Step 3 — Geo-Intelligence Dashboard updates in real time**
Every reported issue is plotted on a **dark-theme Google Maps** integration with severity-coded SVG markers (🔴 High / 🟡 Medium / 🟢 Low). Citizens can click any marker to see the AI's full analysis in an InfoWindow overlay. Three glassmorphic metric cards show aggregate totals — reports submitted, severe issues active, and cases resolved.

**Step 4 — Community Consensus Agent verifies (on demand)**
Any citizen can click **"Verify Issue"** on any report. This triggers the second autonomous agent: the **Community Consensus Agent**, also powered by Gemini 2.5 Flash. This agent independently re-evaluates the issue and produces:
- A **Verification Score** (80–99%) — how critical is this issue objectively?
- A **Local Impact Analysis** — two sentences on who is affected and how
- A **two-step Action Plan** — concrete immediate next steps for the municipality

At **3 community votes**, the system automatically promotes the issue status from *Reported* to **Verified**, creating a democratic peer-accountability layer.

**Step 5 — Civic Points Gamification rewards engagement**
Every verified issue awards the citizen **+50 Civic Points**. A tiered badge system (Newcomer → Active Citizen → City Guardian → Civic Hero) incentivizes continued engagement without requiring user accounts.

---

## 3. Key Features

| Feature | Description |
|---|---|
| 🤖 **Smart Intake Agent** | Gemini 2.5 Flash Vision classifies the issue category, rates severity with engineering rationale, and auto-drafts a formal municipal email — all from a single photo |
| 🗺️ **Geo-Mapping Dashboard** | Real-time Google Maps integration with severity-coded custom SVG pin markers, dark-mode cartography, InfoWindow AI previews, and auto-fitting bounds |
| 🔍 **Community Consensus Agent** | A second independent Gemini agent that produces a Verification Score, Impact Analysis, and Action Plan; auto-promotes issues to "Verified" at 3 votes |
| 🏆 **Civic Points Gamification** | Citizens earn +50 points per verified issue; tiered badge system (Newcomer → Civic Hero) drives sustained engagement |
| 📡 **Live Issue Feed** | Scrollable feed displaying AI-drafted municipal snippets, severity bars, GPS coordinates, and community vote progress |
| 🐳 **Single-Container Deployment** | Multi-stage Docker build produces one image: FastAPI serves both the REST API and the compiled React SPA — no Nginx required |
| 📊 **Real-Time Metrics** | Live aggregate queries on MongoDB for total reports, active severe issues, and resolved case counts |
| 🔐 **Structured AI Output** | All Gemini responses use `response_mime_type="application/json"` with a robust regex fallback parser for 100% reliable structured data |

---

## 4. Technologies Used

### Frontend
| Technology | Version | Role |
|---|---|---|
| **React** | 18 | UI framework with component-based architecture |
| **Vite** | 8 | Lightning-fast build tooling and HMR dev server |
| **Tailwind CSS** | v3 | Utility-first styling with custom dark design system |
| **@react-google-maps/api** | Latest | Google Maps JS API bindings — markers, InfoWindows, dark cartography |

### Backend
| Technology | Version | Role |
|---|---|---|
| **FastAPI** | 0.111 | Async REST API + unified static file serving in production |
| **Uvicorn** | 0.29 | ASGI server (2 workers in production) |
| **Pydantic v2** | 2.7 | Strict data validation and serialization |
| **Motor** | 3.4 | Fully async MongoDB driver |
| **MongoDB** | Any | Document store with GeoJSON 2dsphere indexing |

### Infrastructure & DevOps
| Technology | Role |
|---|---|
| **Docker** (multi-stage) | Node 18 Alpine builder → Python 3.10 slim runtime |
| **Google Cloud Run** | Serverless container hosting with auto-scaling to zero |

---

## 5. Google Technologies Utilized

| Google Technology | How It Is Used in CivicLens AI |
|---|---|
| **Google AI Studio — Gemini 2.5 Flash** | **Intake Agent**: Multimodal computer vision analysis of civic issue photos. Produces structured JSON output (`category`, `severity`, `severity_rationale`, `clean_description`, `municipal_draft`) with `temperature=0.1` for deterministic, professional output |
| **Google AI Studio — Gemini 2.5 Flash** | **Community Consensus Agent**: Independent text-mode re-evaluation of reported issues. Generates `verification_score` (80–99%), `impact_analysis`, and `action_plan` as a second autonomous agent pass on the same issue |
| **Google Maps JavaScript API** | Real-time geo-dashboard with custom SVG severity-coded pin markers, dark-mode cartography (18-rule custom style matching the app palette), InfoWindow AI content overlays, auto-fitting bounds across all issue markers |
| **Google Cloud Run** | Target production deployment platform. The Dockerfile reads `PORT` from the environment at runtime — Cloud Run injects this automatically. Single container serves both FastAPI and the compiled React SPA |

---

## 6. Agent Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CITIZEN INTERACTION LAYER                    │
│          React 18 SPA  ·  Tailwind Dark UI  ·  Vite            │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTP / JSON
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              FastAPI Backend  (Unified Serving)                 │
│  /api/v1/report/analyze    POST  ──→  Intake Agent              │
│  /api/v1/issues            GET   ──→  MongoDB query             │
│  /api/v1/issues/summary    GET   ──→  Aggregate metrics         │
│  /api/v1/issues/{id}/verify POST ──→  Consensus Agent           │
│  /*                              ──→  React SPA (index.html)    │
└──────┬───────────────────────────────────────────┬─────────────┘
       │                                           │
       ▼                                           ▼
┌─────────────────────────┐           ┌────────────────────────────┐
│   AGENT 1: INTAKE       │           │   AGENT 2: CONSENSUS       │
│   Gemini 2.5 Flash      │           │   Gemini 2.5 Flash         │
│   (Vision + Text)       │           │   (Text)                   │
│                         │           │                            │
│  ┌─ Analyse image ──┐   │           │  ┌─ Re-evaluate issue ──┐  │
│  │  category        │   │           │  │  verification_score  │  │
│  │  severity        │   │           │  │  impact_analysis     │  │
│  │  rationale       │   │           │  │  action_plan         │  │
│  │  description     │   │           │  └─────────────────────┘  │
│  │  municipal_draft │   │           │                            │
│  └──────────────────┘   │           │  ┌─ Auto-promote ───────┐  │
│                         │           │  │  votes ≥ 3 → Verified│  │
└──────────┬──────────────┘           │  └─────────────────────┘  │
           │                          └────────────────┬───────────┘
           ▼                                           │
┌─────────────────────────┐                           ▼
│   MongoDB (Motor async) │◄──────────────────────────┘
│   issues collection     │
│   GeoJSON 2dsphere idx  │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Google Maps JS API     │
│  Severity-coded markers │
│  Dark cartography       │
│  InfoWindow AI previews │
└─────────────────────────┘
           │
           ▼
    +50 🏆 Civic Points
```

---

## 7. What Moves Beyond Static Reporting

| Traditional 311 App | CivicLens AI |
|---|---|
| Citizen manually describes issue | Gemini Vision auto-classifies and describes |
| No severity assessment | Engineering-grade severity with rationale |
| Ticket disappears into queue | AI-drafted municipal email ready to send |
| No map visualization | Live geo-dashboard with severity markers |
| No community verification | Consensus Agent + 3-vote auto-promotion |
| No engagement incentive | Civic Points gamification with tier badges |
| Requires multiple tools | Single container: one URL for everything |

---

## 8. Live Demo

> **Run locally in one command (Windows PowerShell):**
> ```powershell
> cd CivicLensAI
> .\backend\venv\Scripts\activate
> python start.py
> ```
> Open **http://localhost:5173** — the full dashboard loads immediately.

> **Docker (production mode — unified serving):**
> ```bash
> docker build -t civiclens-ai .
> docker run -p 8080:8080 --env-file backend/.env civiclens-ai
> # Open http://localhost:8080 — FastAPI serves both API and React SPA
> ```

---

*Built with ❤️ for the Vibe2Ship Hackathon 2026 | Team: CivicLens AI*

*Problem Statement: Community Hero — Hyperlocal Problem Solver*
