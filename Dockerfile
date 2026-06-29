# ─────────────────────────────────────────────────────────────────────────────
# CivicLens AI — Multi-Stage Dockerfile
#
# Stage 1 │ builder  — Compiles the React 18 + Vite frontend into static assets
# Stage 2 │ runtime  — Lean Python 3.10 image that runs FastAPI + serves dist
#
# Build:   docker build -t civiclens-ai .
# Run:     docker run -p 8080:8080 --env-file backend/.env civiclens-ai
# Deploy:  gcloud run deploy civiclens-ai --image gcr.io/PROJECT/civiclens-ai
# ─────────────────────────────────────────────────────────────────────────────


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STAGE 1 — Frontend Builder  (Node 18 Alpine)                              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
FROM node:18-alpine AS builder

LABEL stage="builder"

WORKDIR /app/frontend

# ── Copy package manifests first ─────────────────────────────────────────────
# Docker layer cache: npm ci only re-runs when manifests actually change.
COPY frontend/package.json frontend/package-lock.json ./

# ── Install JS dependencies ───────────────────────────────────────────────────
# --prefer-offline uses local cache; ci = clean, reproducible, faster than install
RUN npm ci --prefer-offline

# ── Copy source and build ─────────────────────────────────────────────────────
COPY frontend/ ./

# In production the React app talks to the same origin (FastAPI serves it),
# so the API base URL is an empty string — all requests go to relative /api/…
ENV VITE_API_BASE_URL=""

RUN npm run build
# Output artifact: /app/frontend/dist/


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║  STAGE 2 — Python Runtime  (3.10-slim)                                     ║
# ╚══════════════════════════════════════════════════════════════════════════════╝
FROM python:3.10-slim AS runtime

LABEL maintainer="CivicLens AI Team"
LABEL description="CivicLens AI — Autonomous Hyperlocal Civic Issue Resolution Platform"
LABEL org.opencontainers.image.source="https://github.com/civiclens-ai/civiclens-ai"

# ── Python runtime optimisations ─────────────────────────────────────────────
# PYTHONUNBUFFERED → logs appear immediately in Cloud Run (no buffering)
# PYTHONDONTWRITEBYTECODE → skip .pyc files, keeps image clean
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Default PORT — Google Cloud Run injects its own value via the PORT env var.
# Never hard-code this; always read from environment.
ENV PORT=8080

WORKDIR /app

# ── System dependencies ───────────────────────────────────────────────────────
# curl is required for the HEALTHCHECK. Clean apt cache in the same layer to
# avoid bloating the image with package lists.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ── Python dependencies ───────────────────────────────────────────────────────
# Copy requirements first → Docker only re-runs pip install when this file changes.
COPY backend/requirements.txt ./requirements.txt

RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ── Application source ────────────────────────────────────────────────────────
# Copy backend Python package last (most frequently changed layer).
COPY backend/ ./

# ── React dist (promoted from builder stage) ──────────────────────────────────
# main.py resolves: Path(__file__).parent / "frontend" / "dist"
# WORKDIR=/app → backend files live at /app/ → dist must be at /app/frontend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist

# ── Security: drop to non-root user ──────────────────────────────────────────
RUN addgroup --system civiclens \
    && adduser --system --ingroup civiclens --no-create-home civiclens
USER civiclens

# ── Health check ──────────────────────────────────────────────────────────────
# Cloud Run surfaces /health; 15 s grace period lets uvicorn fully start.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# ── Expose & Run ──────────────────────────────────────────────────────────────
EXPOSE ${PORT}

# Shell form is intentional: ${PORT} must expand at container runtime, not build time.
# Cloud Run sets PORT automatically; locally it defaults to 8080.
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 2
