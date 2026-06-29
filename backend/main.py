"""
CivicLens AI – FastAPI Application Entry Point
================================================
Phase 4: Unified Serving — FastAPI serves the compiled React frontend.

Production (Docker / Cloud Run):
  • FastAPI mounts and serves the compiled React dist at '/'
  • All /api/* routes and /docs take priority (registered before static files)
  • A catch-all route returns index.html for React Router client-side navigation
  • No separate web server (Nginx/Caddy) is required

Development:
  • Run the React Vite dev server separately: npm run dev  (port 5173)
  • Run this backend: python -m uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse  # FileResponse for SPA catch-all
from fastapi.staticfiles import StaticFiles               # Serves hashed Vite asset bundles

from api.intake import router as intake_router
from api.issues import router as issues_router
from config.database import connect_to_mongo, close_mongo_connection
from config.settings import get_settings
from services.gemini_service import gemini_service

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)

# ── Resolve the React dist directory ──────────────────────────────────────────
# Two possible locations depending on whether we run locally or inside Docker:
#
#   Local dev  : project_root/frontend/dist  (backend is at project_root/backend)
#   Docker     : /app/frontend/dist          (backend files are copied to /app,
#                                             dist is copied to /app/frontend/dist)
#
_THIS_DIR  = Path(__file__).resolve().parent           # …/backend  OR  /app
_DIST_DIR  = _THIS_DIR.parent / "frontend" / "dist"   # local dev path
_DIST_DIR2 = _THIS_DIR / "frontend" / "dist"          # Docker path
DIST_DIR: Path | None = (
    _DIST_DIR  if _DIST_DIR.is_dir()  else
    _DIST_DIR2 if _DIST_DIR2.is_dir() else
    None
)

if DIST_DIR:
    logger.info("Serving React build from: %s", DIST_DIR)
else:
    logger.info("No React dist found — API-only mode (run 'npm run build' in /frontend).")


# ── Application Lifespan ───────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup: initialise Gemini + connect to MongoDB. Shutdown: close MongoDB."""
    settings = get_settings()
    logger.info("Starting %s v%s …", settings.APP_NAME, settings.APP_VERSION)

    try:
        gemini_service.initialize()
    except ValueError as exc:
        logger.warning("Gemini service not configured: %s", exc)

    try:
        await connect_to_mongo()
    except Exception as exc:  # noqa: BLE001
        logger.error("Failed to connect to MongoDB: %s", exc)

    logger.info("%s is ready to serve requests.", settings.APP_NAME)
    yield

    logger.info("Shutting down %s …", settings.APP_NAME)
    await close_mongo_connection()


# ── FastAPI Application ────────────────────────────────────────────────────────
settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "CivicLens AI – An autonomous hyperlocal civic issue resolution platform. "
        "Upload an image of a civic problem and an AI agent classifies it, assigns severity, "
        "drafts a municipal report, and plots it on a live geo-dashboard. "
        "A second Consensus Agent lets the community verify reports autonomously."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)


# ── Middleware ─────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)

# GZip compresses JSON responses and large static assets automatically
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Global Exception Handler ───────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception on %s %s", request.method, request.url)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "message": "An internal server error occurred.",
            "detail": str(exc),
        },
    )


# ── API Routers ────────────────────────────────────────────────────────────────
# IMPORTANT: Routers MUST be registered BEFORE StaticFiles / catch-all routes.
# FastAPI resolves routes in registration order, so /api/* and /docs are matched
# first and never fall through to the SPA catch-all handler below.
app.include_router(intake_router)
app.include_router(issues_router)


# ── Health Check ───────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"], summary="Application health check")
async def health_check() -> dict:
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
    }


# ── Static File Serving + SPA Catch-All ───────────────────────────────────────
# Only mount when the compiled React dist exists (production / Docker).
# In local development, the Vite dev server handles all frontend traffic.
if DIST_DIR:
    # Mount Vite's hashed asset bundles at /assets so Cache-Control headers
    # work correctly for fingerprinted filenames (e.g. index-DwQ2TH5l.js).
    _ASSETS_DIR = DIST_DIR / "assets"
    if _ASSETS_DIR.is_dir():
        app.mount(
            "/assets",
            StaticFiles(directory=str(_ASSETS_DIR)),
            name="assets",
        )

    @app.get("/", tags=["Frontend"], include_in_schema=False)
    async def serve_root() -> FileResponse:
        """Serve the React SPA entry point at the root URL."""
        return FileResponse(str(DIST_DIR / "index.html"))

    @app.get("/{catchall:path}", tags=["Frontend"], include_in_schema=False)
    async def serve_spa(catchall: str, request: Request) -> FileResponse:
        """
        SPA catch-all route — supports React Router client-side navigation.

        Evaluation order (FastAPI matches routers first):
          /api/*   → handled by intake_router / issues_router (registered above)
          /docs    → FastAPI Swagger UI
          /redoc   → FastAPI ReDoc
          /health  → health_check()
          /assets/ → StaticFiles mount (hashed Vite bundles)
          *        → THIS handler → returns index.html for React Router

        If the requested path resolves to a real file inside dist (e.g. favicon.ico,
        robots.txt, manifest.json) it is served directly. Everything else falls
        through to index.html so React Router handles the URL.
        """
        candidate = DIST_DIR / catchall
        if candidate.is_file():
            return FileResponse(str(candidate))
        # Unknown path → hand off to React Router
        return FileResponse(str(DIST_DIR / "index.html"))

else:
    # No dist directory found — return a helpful JSON message in API-only mode
    @app.get("/", tags=["System"], summary="API root (no frontend built)")
    async def root() -> dict:
        return {
            "message": f"Welcome to {settings.APP_NAME} API",
            "docs": "/docs",
            "health": "/health",
            "note": "React frontend not built. Run 'npm run build' in /frontend to enable unified serving.",
        }


# ── Dev Entry Point ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info",
    )
