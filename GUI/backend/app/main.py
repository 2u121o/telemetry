from fastapi import FastAPI, WebSocket
from fastapi.staticfiles import StaticFiles
import pathlib

app = FastAPI(title="Telemetry")

project_root = pathlib.Path(__file__).resolve().parents[2]
static_dir = project_root / "frontend"
if not static_dir.exists():
    raise RuntimeError(f"Frontend not found at: {static_dir}")

app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.websocket("/ws/telemetry")
async def telemetry_ws(ws: WebSocket):
    await ws.accept()
    await ws.send_json({"type": "hello", "message": "WebSocket ready"})
    await ws.close()
