"""
CivicLens AI – Single-Click Launcher  (start.py)
=================================================
Run from the project root:

    python start.py

This script resolves the PowerShell venv path issue by using sys.executable
(always the correct Python binary, whether inside a venv or not) to launch
uvicorn as a module instead of relying on the shell PATH.

Both processes run concurrently; Ctrl+C cleanly shuts them both down.
"""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import time
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).resolve().parent
BACKEND_DIR = ROOT / "backend"
FRONTEND_DIR = ROOT / "frontend"

# ── Colour helpers (ANSI – works on modern Windows terminals) ──────────────────
RESET  = "\033[0m"
BOLD   = "\033[1m"
TEAL   = "\033[96m"
AMBER  = "\033[93m"
GREEN  = "\033[92m"
RED    = "\033[91m"

def banner():
    print(f"""
{TEAL}{BOLD}
  ╔══════════════════════════════════════════════╗
  ║        CivicLens AI  –  Unified Launcher     ║
  ║   Backend (FastAPI)  +  Frontend (Vite)      ║
  ╚══════════════════════════════════════════════╝
{RESET}""")

def log(tag: str, colour: str, msg: str):
    print(f"  {colour}{BOLD}[{tag}]{RESET}  {msg}")


# ── Pre-flight checks ─────────────────────────────────────────────────────────

def check_venv():
    """Warn if we're not inside a virtualenv, but don't block startup."""
    if sys.prefix == sys.base_prefix:
        log("WARN", AMBER,
            "No virtualenv detected. Consider activating backend/venv first.\n"
            "         Running with system Python: " + sys.executable)
    else:
        log("ENV ", GREEN, f"Using Python: {sys.executable}")


def install_backend_deps():
    """Ensure all backend requirements are installed via pip (fast no-op if up-to-date)."""
    req_file = BACKEND_DIR / "requirements.txt"
    log("PIP ", TEAL, "Checking backend dependencies…")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(req_file), "--quiet"],
        cwd=str(BACKEND_DIR),
    )
    if result.returncode != 0:
        log("ERR ", RED, "pip install failed. Check requirements.txt.")
        sys.exit(1)
    log("PIP ", GREEN, "Backend dependencies OK.")


# ── Process launchers ─────────────────────────────────────────────────────────

def start_backend() -> subprocess.Popen:
    """
    Launch uvicorn as a Python module so we NEVER depend on the PATH having
    a 'uvicorn' binary — the venv's Python is used directly.
    """
    cmd = [
        sys.executable, "-m", "uvicorn",
        "main:app",
        "--reload",
        "--port", "8000",
        "--host", "0.0.0.0",
    ]
    log("API ", TEAL, f"Starting FastAPI on http://localhost:8000  →  {' '.join(cmd)}")
    return subprocess.Popen(
        cmd,
        cwd=str(BACKEND_DIR),
        env={**os.environ, "PYTHONPATH": str(BACKEND_DIR)},
    )


def start_frontend() -> subprocess.Popen:
    """Launch the Vite dev server."""
    # npm is always on PATH; use 'npm.cmd' on Windows for subprocess compatibility
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    cmd = [npm, "run", "dev"]
    log("WEB ", AMBER, f"Starting Vite frontend on http://localhost:5173  →  {' '.join(cmd)}")
    return subprocess.Popen(cmd, cwd=str(FRONTEND_DIR))


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    banner()
    check_venv()
    install_backend_deps()

    print()
    backend_proc  = start_backend()
    time.sleep(1)          # small stagger so logs are easier to read
    frontend_proc = start_frontend()

    print(f"""
  {GREEN}{BOLD}✓ Both services are starting up…{RESET}

    {TEAL}Backend API  →  http://localhost:8000{RESET}   (FastAPI / Swagger at /docs)
    {AMBER}Frontend UI  →  http://localhost:5173{RESET}  (React / Vite)

  Press {BOLD}Ctrl+C{RESET} to stop both servers.
""")

    def _shutdown(signum=None, frame=None):
        print(f"\n  {RED}{BOLD}[STOP]{RESET}  Shutting down CivicLens AI…")
        for proc in (backend_proc, frontend_proc):
            if proc.poll() is None:
                proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT,  _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    # Wait; if either process dies unexpectedly, report and kill the other
    while True:
        if backend_proc.poll() is not None:
            log("ERR ", RED, f"Backend exited with code {backend_proc.returncode}. Stopping.")
            _shutdown()
        if frontend_proc.poll() is not None:
            log("ERR ", RED, f"Frontend exited with code {frontend_proc.returncode}. Stopping.")
            _shutdown()
        time.sleep(2)


if __name__ == "__main__":
    main()
