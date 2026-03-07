"""
Bike Telemetry — FastAPI backend with SQLite database.

Serves:
  /api/*   REST endpoints (bikes, setups, runs, telemetry, export/import, settings)
  /ws/*    WebSocket (future real-time telemetry)
  /*       Static frontend files
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import pathlib

from .database import init_db
from .routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = FastAPI(title="Bike Telemetry", lifespan=lifespan)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(api_router)


# WebSocket (placeholder for future real-time telemetry)
@app.websocket("/ws/telemetry")
async def telemetry_ws(ws: WebSocket):
    await ws.accept()
    await ws.send_json({"type": "hello", "message": "WebSocket ready"})
    await ws.close()


# Static files — MUST be last (catch-all)
project_root = pathlib.Path(__file__).resolve().parents[2]
static_dir = project_root / "frontend"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
