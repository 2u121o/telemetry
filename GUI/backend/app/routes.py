"""
API routes for the telemetry application.

Endpoints:
  /api/bikes          CRUD for bikes
  /api/setups         CRUD for setups
  /api/runs           CRUD for runs (with telemetry upload)
  /api/runs/{id}/data GET telemetry data for a run
  /api/runs/{id}/export  GET full export bundle
  /api/import         POST import a bundle
  /api/settings       GET/PUT app settings
"""

from __future__ import annotations

import json
import struct
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query

from .database import get_db, row_to_dict, rows_to_list
from .models import (
    BikeCreate, BikeUpdate, BikeOut,
    SetupCreate, SetupUpdate, SetupOut,
    RunCreate, RunUpdate, RunOut, RunListOut,
    SplitsData, RunNotesData,
    TelemetryUpload, ExportBundle,
    SettingsBulk,
)

router = APIRouter(prefix="/api")

BINARY_MAGIC = b"TLM2BIN1"
BINARY_HEADER_SIZE = 512
BINARY_RECORD = struct.Struct("<Q14f4B4x")
BINARY_RAW_COLUMNS = [
    "timestamp_ns",
    "gps_lat_deg",
    "gps_lon_deg",
    "gps_alt_m",
    "gps_speed_kn",
    "gps_course_deg",
    "gps_hdop",
    "ax_g",
    "ay_g",
    "az_g",
    "wx_dps",
    "wy_dps",
    "wz_dps",
    "travel1_v",
    "travel2_v",
    "gps_fix_quality",
    "gps_sats",
    "imu_ok",
    "travel_ok",
]


@router.get("/health")
async def health():
    return {"status": "ok"}


# ===================================================================
# BIKES
# ===================================================================
@router.get("/bikes", response_model=list[BikeOut])
async def list_bikes():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM bikes ORDER BY updated_at DESC")
        rows = await cursor.fetchall()
        return rows_to_list(rows)
    finally:
        await db.close()


@router.get("/bikes/{bike_id}", response_model=BikeOut)
async def get_bike(bike_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM bikes WHERE id = ?", (bike_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Bike not found")
        return row_to_dict(row)
    finally:
        await db.close()


@router.post("/bikes", response_model=BikeOut, status_code=201)
async def create_bike(body: BikeCreate):
    db = await get_db()
    try:
        data = body.model_dump()
        cols = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        cursor = await db.execute(
            f"INSERT INTO bikes ({cols}) VALUES ({placeholders})",
            list(data.values()),
        )
        await db.commit()
        bike_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM bikes WHERE id = ?", (bike_id,))
        return row_to_dict(await cursor.fetchone())
    finally:
        await db.close()


@router.put("/bikes/{bike_id}", response_model=BikeOut)
async def update_bike(bike_id: int, body: BikeUpdate):
    db = await get_db()
    try:
        data = body.model_dump()
        data["updated_at"] = datetime.now().isoformat()
        set_clause = ", ".join(f"{k} = ?" for k in data.keys())
        await db.execute(
            f"UPDATE bikes SET {set_clause} WHERE id = ?",
            list(data.values()) + [bike_id],
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM bikes WHERE id = ?", (bike_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Bike not found")
        return row_to_dict(row)
    finally:
        await db.close()


@router.delete("/bikes/{bike_id}")
async def delete_bike(bike_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM bikes WHERE id = ?", (bike_id,))
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


# ===================================================================
# SETUPS
# ===================================================================
@router.get("/setups", response_model=list[SetupOut])
async def list_setups(bike_id: Optional[int] = Query(None)):
    db = await get_db()
    try:
        if bike_id is not None:
            cursor = await db.execute(
                "SELECT * FROM setups WHERE bike_id = ? ORDER BY updated_at DESC",
                (bike_id,),
            )
        else:
            cursor = await db.execute("SELECT * FROM setups ORDER BY updated_at DESC")
        return rows_to_list(await cursor.fetchall())
    finally:
        await db.close()


@router.get("/setups/{setup_id}", response_model=SetupOut)
async def get_setup(setup_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM setups WHERE id = ?", (setup_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Setup not found")
        return row_to_dict(row)
    finally:
        await db.close()


@router.post("/setups", response_model=SetupOut, status_code=201)
async def create_setup(body: SetupCreate):
    db = await get_db()
    try:
        data = body.model_dump()
        cols = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        cursor = await db.execute(
            f"INSERT INTO setups ({cols}) VALUES ({placeholders})",
            list(data.values()),
        )
        await db.commit()
        setup_id = cursor.lastrowid
        cursor = await db.execute("SELECT * FROM setups WHERE id = ?", (setup_id,))
        return row_to_dict(await cursor.fetchone())
    finally:
        await db.close()


@router.put("/setups/{setup_id}", response_model=SetupOut)
async def update_setup(setup_id: int, body: SetupUpdate):
    db = await get_db()
    try:
        data = body.model_dump()
        data["updated_at"] = datetime.now().isoformat()
        set_clause = ", ".join(f"{k} = ?" for k in data.keys())
        await db.execute(
            f"UPDATE setups SET {set_clause} WHERE id = ?",
            list(data.values()) + [setup_id],
        )
        await db.commit()
        cursor = await db.execute("SELECT * FROM setups WHERE id = ?", (setup_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Setup not found")
        return row_to_dict(row)
    finally:
        await db.close()


@router.delete("/setups/{setup_id}")
async def delete_setup(setup_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM setups WHERE id = ?", (setup_id,))
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


# ===================================================================
# RUNS
# ===================================================================
@router.get("/runs", response_model=list[RunListOut])
async def list_runs():
    db = await get_db()
    try:
        cursor = await db.execute("""
            SELECT r.*,
                   b.name AS bike_name,
                   s.name AS setup_name
            FROM runs r
            LEFT JOIN bikes b ON r.bike_id = b.id
            LEFT JOIN setups s ON r.setup_id = s.id
            ORDER BY r.created_at DESC
        """)
        rows = await cursor.fetchall()
        return rows_to_list(rows)
    finally:
        await db.close()


@router.get("/runs/{run_id}", response_model=RunOut)
async def get_run(run_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Run not found")
        run_dict = row_to_dict(row)
        run_out = _run_row_to_out(run_dict)

        # Attach bike and setup
        if run_out.bike_id:
            cursor = await db.execute("SELECT * FROM bikes WHERE id = ?", (run_out.bike_id,))
            bike_row = await cursor.fetchone()
            if bike_row:
                run_out.bike = BikeOut(**row_to_dict(bike_row))
        if run_out.setup_id:
            cursor = await db.execute("SELECT * FROM setups WHERE id = ?", (run_out.setup_id,))
            setup_row = await cursor.fetchone()
            if setup_row:
                run_out.setup = SetupOut(**row_to_dict(setup_row))

        return run_out
    finally:
        await db.close()


@router.post("/runs", response_model=RunOut, status_code=201)
async def create_run(body: TelemetryUpload):
    """Create a new run by uploading CSV text + metadata."""
    db = await get_db()
    try:
        # Parse CSV
        columns, data_rows = _parse_csv(body.csv_text, body.run.sensor_settings)
        sample_count = len(data_rows)
        duration_s = 0.0
        if sample_count > 0 and "timestamp" in columns:
            ts_vals = [r.get("timestamp") for r in data_rows if r.get("timestamp") is not None]
            if ts_vals:
                duration_s = max(ts_vals) - min(ts_vals)

        run_data = body.run
        notes_data = run_data.notes_data

        now = datetime.now().isoformat()
        cursor = await db.execute(
            """INSERT INTO runs (
                name, file_name, bike_id, setup_id,
                date, location, track_name, weather, temperature_c, humidity_pct,
                trail_condition, rider_name, rider_weight_kg,
                session_goal, setup_changes, feeling_rating, feeling_notes, tags,
                sensor_settings, splits_json, chart_configs, filter_configs,
                sample_count, duration_s, columns_json, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run_data.name or run_data.file_name,
                run_data.file_name,
                run_data.bike_id,
                run_data.setup_id,
                notes_data.date,
                notes_data.location,
                notes_data.track_name,
                notes_data.weather,
                notes_data.temperature_c,
                notes_data.humidity_pct,
                notes_data.trail_condition,
                notes_data.rider_name,
                notes_data.rider_weight_kg,
                notes_data.session_goal,
                notes_data.setup_changes,
                notes_data.feeling_rating,
                notes_data.feeling_notes,
                notes_data.tags,
                json.dumps(run_data.sensor_settings),
                run_data.splits.model_dump_json(),
                json.dumps(run_data.chart_configs),
                json.dumps(run_data.filter_configs),
                sample_count,
                duration_s,
                json.dumps(columns),
                run_data.notes,
                now, now,
            ),
        )
        run_id = cursor.lastrowid

        # Insert telemetry data in batches
        BATCH_SIZE = 500
        for i in range(0, len(data_rows), BATCH_SIZE):
            batch = data_rows[i:i + BATCH_SIZE]
            values = [(run_id, i + j, json.dumps(row)) for j, row in enumerate(batch)]
            await db.executemany(
                "INSERT INTO telemetry_data (run_id, row_idx, data) VALUES (?, ?, ?)",
                values,
            )

        await db.commit()

        # Return created run
        cursor = await db.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        row = await cursor.fetchone()
        return _run_row_to_out(row_to_dict(row))
    finally:
        await db.close()


@router.put("/runs/{run_id}", response_model=RunOut)
async def update_run(run_id: int, body: RunUpdate):
    db = await get_db()
    try:
        # Check run exists
        cursor = await db.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(404, "Run not found")

        updates = {}
        if body.name is not None:
            updates["name"] = body.name
        if body.bike_id is not None:
            updates["bike_id"] = body.bike_id
        if body.setup_id is not None:
            updates["setup_id"] = body.setup_id
        if body.notes is not None:
            updates["notes"] = body.notes
        if body.splits is not None:
            updates["splits_json"] = body.splits.model_dump_json()
        if body.chart_configs is not None:
            updates["chart_configs"] = json.dumps(body.chart_configs)
        if body.filter_configs is not None:
            updates["filter_configs"] = json.dumps(body.filter_configs)
        if body.notes_data is not None:
            nd = body.notes_data
            updates.update({
                "date": nd.date, "location": nd.location, "track_name": nd.track_name,
                "weather": nd.weather, "temperature_c": nd.temperature_c,
                "humidity_pct": nd.humidity_pct, "trail_condition": nd.trail_condition,
                "rider_name": nd.rider_name, "rider_weight_kg": nd.rider_weight_kg,
                "session_goal": nd.session_goal, "setup_changes": nd.setup_changes,
                "feeling_rating": nd.feeling_rating, "feeling_notes": nd.feeling_notes,
                "tags": nd.tags,
            })

        if updates:
            updates["updated_at"] = datetime.now().isoformat()
            set_clause = ", ".join(f"{k} = ?" for k in updates.keys())
            await db.execute(
                f"UPDATE runs SET {set_clause} WHERE id = ?",
                list(updates.values()) + [run_id],
            )
            await db.commit()

        cursor = await db.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        row = await cursor.fetchone()
        run_out = _run_row_to_out(row_to_dict(row))

        # Attach bike and setup
        if run_out.bike_id:
            cursor = await db.execute("SELECT * FROM bikes WHERE id = ?", (run_out.bike_id,))
            bike_row = await cursor.fetchone()
            if bike_row:
                run_out.bike = BikeOut(**row_to_dict(bike_row))
        if run_out.setup_id:
            cursor = await db.execute("SELECT * FROM setups WHERE id = ?", (run_out.setup_id,))
            setup_row = await cursor.fetchone()
            if setup_row:
                run_out.setup = SetupOut(**row_to_dict(setup_row))

        return run_out
    finally:
        await db.close()


@router.delete("/runs/{run_id}")
async def delete_run(run_id: int):
    db = await get_db()
    try:
        # CASCADE will delete telemetry_data
        await db.execute("DELETE FROM runs WHERE id = ?", (run_id,))
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


# ===================================================================
# TELEMETRY DATA
# ===================================================================
@router.get("/runs/{run_id}/data")
async def get_run_data(
    run_id: int,
    offset: int = Query(0, ge=0),
    limit: int = Query(0, ge=0, description="0 = all"),
):
    """Get telemetry data rows for a run."""
    db = await get_db()
    try:
        # Check run exists
        cursor = await db.execute("SELECT columns_json, sample_count FROM runs WHERE id = ?", (run_id,))
        run_row = await cursor.fetchone()
        if not run_row:
            raise HTTPException(404, "Run not found")

        columns = json.loads(run_row["columns_json"])

        if limit > 0:
            cursor = await db.execute(
                "SELECT data FROM telemetry_data WHERE run_id = ? ORDER BY row_idx LIMIT ? OFFSET ?",
                (run_id, limit, offset),
            )
        else:
            cursor = await db.execute(
                "SELECT data FROM telemetry_data WHERE run_id = ? ORDER BY row_idx",
                (run_id,),
            )
        rows = await cursor.fetchall()
        data = [json.loads(r["data"]) for r in rows]

        return {
            "run_id": run_id,
            "columns": columns,
            "sample_count": run_row["sample_count"],
            "offset": offset,
            "count": len(data),
            "data": data,
        }
    finally:
        await db.close()


# ===================================================================
# EXPORT / IMPORT
# ===================================================================
@router.get("/runs/{run_id}/export")
async def export_run(run_id: int):
    """Export a complete run bundle (bike + setup + notes + telemetry)."""
    db = await get_db()
    try:
        # Get run
        cursor = await db.execute("SELECT * FROM runs WHERE id = ?", (run_id,))
        run_row = await cursor.fetchone()
        if not run_row:
            raise HTTPException(404, "Run not found")
        run_dict = row_to_dict(run_row)
        run_out = _run_row_to_out(run_dict)

        # Get bike
        bike_out = None
        if run_out.bike_id:
            cursor = await db.execute("SELECT * FROM bikes WHERE id = ?", (run_out.bike_id,))
            bike_row = await cursor.fetchone()
            if bike_row:
                bike_out = BikeOut(**row_to_dict(bike_row))

        # Get setup
        setup_out = None
        if run_out.setup_id:
            cursor = await db.execute("SELECT * FROM setups WHERE id = ?", (run_out.setup_id,))
            setup_row = await cursor.fetchone()
            if setup_row:
                setup_out = SetupOut(**row_to_dict(setup_row))

        # Get telemetry
        cursor = await db.execute(
            "SELECT data FROM telemetry_data WHERE run_id = ? ORDER BY row_idx",
            (run_id,),
        )
        telem_rows = await cursor.fetchall()
        telemetry_data = [json.loads(r["data"]) for r in telem_rows]
        columns = json.loads(run_dict.get("columns_json", "[]"))

        bundle = ExportBundle(
            version=1,
            bike=bike_out,
            setup=setup_out,
            run=run_out,
            telemetry_columns=columns,
            telemetry_data=telemetry_data,
        )
        return bundle
    finally:
        await db.close()


@router.post("/import", response_model=RunOut, status_code=201)
async def import_run(bundle: ExportBundle):
    """Import a complete run bundle. Creates bike/setup if they don't exist."""
    db = await get_db()
    try:
        bike_id = None
        setup_id = None

        # Import bike if present
        if bundle.bike:
            bike_data = bundle.bike.model_dump(exclude={"id", "created_at", "updated_at"})
            # Check if bike with same name already exists
            cursor = await db.execute("SELECT id FROM bikes WHERE name = ?", (bike_data.get("name", ""),))
            existing = await cursor.fetchone()
            if existing:
                bike_id = existing["id"]
            else:
                cols = ", ".join(bike_data.keys())
                placeholders = ", ".join(["?"] * len(bike_data))
                cursor = await db.execute(
                    f"INSERT INTO bikes ({cols}) VALUES ({placeholders})",
                    list(bike_data.values()),
                )
                bike_id = cursor.lastrowid

        # Import setup if present
        if bundle.setup:
            setup_data = bundle.setup.model_dump(exclude={"id", "created_at", "updated_at"})
            setup_data["bike_id"] = bike_id  # Link to imported/existing bike
            cols = ", ".join(setup_data.keys())
            placeholders = ", ".join(["?"] * len(setup_data))
            cursor = await db.execute(
                f"INSERT INTO setups ({cols}) VALUES ({placeholders})",
                list(setup_data.values()),
            )
            setup_id = cursor.lastrowid

        # Create run
        run = bundle.run
        now = datetime.now().isoformat()
        columns = bundle.telemetry_columns or run.columns
        sample_count = len(bundle.telemetry_data)
        duration_s = 0.0
        if sample_count > 0 and "timestamp" in columns:
            ts_vals = [r.get("timestamp") for r in bundle.telemetry_data if r.get("timestamp") is not None]
            if ts_vals:
                duration_s = max(ts_vals) - min(ts_vals)

        cursor = await db.execute(
            """INSERT INTO runs (
                name, file_name, bike_id, setup_id,
                date, location, track_name, weather, temperature_c, humidity_pct,
                trail_condition, rider_name, rider_weight_kg,
                session_goal, setup_changes, feeling_rating, feeling_notes, tags,
                sensor_settings, splits_json, chart_configs, filter_configs,
                sample_count, duration_s, columns_json, notes,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                run.name or run.file_name,
                run.file_name,
                bike_id,
                setup_id,
                run.date, run.location, run.track_name,
                run.weather, run.temperature_c, run.humidity_pct,
                run.trail_condition, run.rider_name, run.rider_weight_kg,
                run.session_goal, run.setup_changes, run.feeling_rating, run.feeling_notes, run.tags,
                json.dumps(run.sensor_settings),
                run.splits.model_dump_json() if run.splits else '{"start":null,"end":null,"intermediates":[]}',
                json.dumps(run.chart_configs),
                json.dumps(run.filter_configs),
                sample_count,
                duration_s,
                json.dumps(columns),
                run.notes,
                now, now,
            ),
        )
        new_run_id = cursor.lastrowid

        # Insert telemetry
        BATCH_SIZE = 500
        for i in range(0, len(bundle.telemetry_data), BATCH_SIZE):
            batch = bundle.telemetry_data[i:i + BATCH_SIZE]
            values = [(new_run_id, i + j, json.dumps(row)) for j, row in enumerate(batch)]
            await db.executemany(
                "INSERT INTO telemetry_data (run_id, row_idx, data) VALUES (?, ?, ?)",
                values,
            )

        await db.commit()

        cursor = await db.execute("SELECT * FROM runs WHERE id = ?", (new_run_id,))
        row = await cursor.fetchone()
        return _run_row_to_out(row_to_dict(row))
    finally:
        await db.close()


# ===================================================================
# UPLOAD CSV FILE (multipart form)
# ===================================================================
@router.post("/runs/upload", response_model=RunOut, status_code=201)
async def upload_run_file(
    file: UploadFile = File(...),
    bike_id: Optional[int] = Form(None),
    setup_id: Optional[int] = Form(None),
    name: str = Form(""),
    sensor_settings: str = Form("{}"),
):
    """Upload a CSV/TXT file directly as multipart form data."""
    content = await file.read()
    if content.startswith(BINARY_MAGIC):
        csv_text = _binary_to_csv_text(content)
    else:
        csv_text = content.decode("utf-8", errors="replace")

    settings_dict = {}
    try:
        settings_dict = json.loads(sensor_settings)
    except Exception:
        pass

    upload = TelemetryUpload(
        csv_text=csv_text,
        run=RunCreate(
            name=name or file.filename or "",
            file_name=file.filename or "",
            bike_id=bike_id,
            setup_id=setup_id,
            sensor_settings=settings_dict,
        ),
    )
    return await create_run(upload)


@router.get("/debug/bin-file")
async def debug_bin_file(path: str = "/media/dario.zurlo/telemetry/LOG0001.BIN"):
    file_path = Path(path)
    if not file_path.exists():
        raise HTTPException(404, f"File non trovato: {path}")
    content = file_path.read_bytes()
    csv_text = _binary_to_csv_text(content)
    columns, data_rows = _parse_csv(csv_text, None)
    return {
        "file_name": file_path.name,
        "size": len(content),
        "columns": columns,
        "data": data_rows,
    }


# ===================================================================
# SETTINGS
# ===================================================================
@router.get("/settings")
async def get_settings():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT key, value FROM settings")
        rows = await cursor.fetchall()
        return {r["key"]: r["value"] for r in rows}
    finally:
        await db.close()


@router.put("/settings")
async def update_settings(body: SettingsBulk):
    db = await get_db()
    try:
        for key, value in body.settings.items():
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, str(value)),
            )
        await db.commit()
        return {"ok": True}
    finally:
        await db.close()


# ===================================================================
# HELPERS
# ===================================================================
def _binary_to_csv_text(content: bytes) -> str:
    if len(content) <= BINARY_HEADER_SIZE:
        raise HTTPException(400, "File binario vuoto o incompleto")

    rows = [",".join(BINARY_RAW_COLUMNS)]
    payload = memoryview(content)[BINARY_HEADER_SIZE:]
    row_count = len(payload) // BINARY_RECORD.size
    for index in range(row_count):
        offset = index * BINARY_RECORD.size
        values = BINARY_RECORD.unpack_from(payload, offset)
        rows.append(",".join(str(value) for value in values))

    if row_count == 0:
        raise HTTPException(400, "Nessun campione binario valido trovato")

    return "\n".join(rows)


# Maps raw CSV column names → canonical names used by the GUI.
_COLUMN_ALIASES: dict[str, str] = {
    "timestamp_ns": "timestamp",
    "timestamp_ms": "timestamp",
    "gps_lat_deg":  "lat",
    "gps_lon_deg":  "lon",
    "gps_alt_m":    "alt_m",
    "gps_speed_kn": "speed_kn",
    "gps_course_deg": "course_deg",
    "gps_sats":     "sats",
    "gps_hdop":     "hdop",
    "gps_fix":      "fix",
    "gps_fix_quality": "fix_quality",
    "ax_g": "ax", "ay_g": "ay", "az_g": "az",
    "wx_dps": "wx", "wy_dps": "wy", "wz_dps": "wz",
    "travel1_v": "travel_r_v",
    "travel2_v": "travel_f_v",
}

# Divisor to convert the raw timestamp column value to seconds.
_TIMESTAMP_SCALES: dict[str, float] = {
    "timestamp_ns": 1_000_000_000.0,
    "timestamp_ms": 1_000.0,
}


def _parse_csv(text: str, sensor_settings: dict | None = None) -> tuple[list[str], list[dict]]:
    """Parse CSV text into (columns, rows). Applies column aliasing and timestamp conversion."""
    lines = text.strip().split("\n")
    if len(lines) < 2:
        raise HTTPException(400, "File vuoto o formato non valido")

    raw_header = [h.strip().replace(" ", "_") for h in lines[0].split(",")]

    # Determine timestamp scaling from original column name; fallback to sensor_settings.
    ts_scale: float | None = None
    for raw_col in raw_header:
        if raw_col in _TIMESTAMP_SCALES:
            ts_scale = _TIMESTAMP_SCALES[raw_col]
            break
    if ts_scale is None:
        ts_unit = (sensor_settings or {}).get("timestampUnit", "ms_to_s")
        if ts_unit == "ms_to_s":
            ts_scale = 1_000.0

    # Build canonical header (apply aliases, deduplicate).
    header: list[str] = []
    seen: set[str] = set()
    for raw_col in raw_header:
        canonical = _COLUMN_ALIASES.get(raw_col, raw_col)
        if canonical in seen:
            canonical = raw_col  # keep original if alias already used
        seen.add(canonical)
        header.append(canonical)

    data = []

    for i in range(1, len(lines)):
        line = lines[i].strip()
        if not line:
            continue
        parts = line.split(",")
        if len(parts) != len(raw_header):
            continue
        row = {}
        for j, col in enumerate(header):
            val = parts[j].strip()
            if val == "":
                row[col] = None
            else:
                try:
                    num = float(val)
                    if col == "timestamp" and ts_scale:
                        num /= ts_scale
                    row[col] = num
                except ValueError:
                    row[col] = val
        data.append(row)

    # Apply travel conversion
    if "travel_r_v" in header:
        settings = sensor_settings or {}
        v_max = float(settings.get("travel_vMax", 3.3))
        v_min = float(settings.get("travel_vMin", 0))
        stroke = float(settings.get("travel_strokeMm", 200))
        inverted = bool(settings.get("travel_inverted", False))

        if "travel_r_mm" not in header:
            header.append("travel_r_mm")
        if "travel_r_pct" not in header:
            header.append("travel_r_pct")

        for row in data:
            v = row.get("travel_r_v")
            if v is not None and isinstance(v, (int, float)):
                r = (v - v_min) / (v_max - v_min) if v_max != v_min else 0
                if not inverted:
                    r = 1 - r
                r = max(0, min(1, r))
                row["travel_r_mm"] = round(r * stroke, 3)
                row["travel_r_pct"] = round(r * 100, 2)
            else:
                row["travel_r_mm"] = None
                row["travel_r_pct"] = None

    return header, data


def _run_row_to_out(d: dict) -> RunOut:
    """Convert a raw DB row dict to a RunOut model."""
    splits = SplitsData()
    try:
        splits = SplitsData(**json.loads(d.get("splits_json", "{}")))
    except Exception:
        pass

    sensor_settings = {}
    try:
        sensor_settings = json.loads(d.get("sensor_settings", "{}"))
    except Exception:
        pass

    chart_configs = []
    try:
        chart_configs = json.loads(d.get("chart_configs", "[]"))
    except Exception:
        pass

    filter_configs = []
    try:
        filter_configs = json.loads(d.get("filter_configs", "[]"))
    except Exception:
        pass

    columns = []
    try:
        columns = json.loads(d.get("columns_json", "[]"))
    except Exception:
        pass

    return RunOut(
        id=d["id"],
        name=d.get("name", ""),
        file_name=d.get("file_name", ""),
        bike_id=d.get("bike_id"),
        setup_id=d.get("setup_id"),
        date=d.get("date", ""),
        location=d.get("location", ""),
        track_name=d.get("track_name", ""),
        weather=d.get("weather", ""),
        temperature_c=d.get("temperature_c"),
        humidity_pct=d.get("humidity_pct"),
        trail_condition=d.get("trail_condition", ""),
        rider_name=d.get("rider_name", ""),
        rider_weight_kg=d.get("rider_weight_kg"),
        session_goal=d.get("session_goal", ""),
        setup_changes=d.get("setup_changes", ""),
        feeling_rating=d.get("feeling_rating", 3),
        feeling_notes=d.get("feeling_notes", ""),
        tags=d.get("tags", ""),
        sensor_settings=sensor_settings,
        splits=splits,
        chart_configs=chart_configs,
        filter_configs=filter_configs,
        sample_count=d.get("sample_count", 0),
        duration_s=d.get("duration_s", 0),
        columns=columns,
        notes=d.get("notes", ""),
        created_at=d.get("created_at", ""),
        updated_at=d.get("updated_at", ""),
    )
