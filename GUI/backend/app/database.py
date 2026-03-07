"""
SQLite database module — async via aiosqlite.

Tables:
  bikes          – static bike config (frame, wheels, brakes, drivetrain)
  setups         – tunable parameters (suspension, tyres) linked to a bike
  runs           – a single recording session (file), linked to bike + setup
  telemetry_data – raw telemetry rows for a run
  splits         – start / end / intermediate split points for a run
  run_notes      – per-run metadata (weather, rider, feeling, etc.)
"""

from __future__ import annotations

import aiosqlite
import json
import pathlib
from datetime import datetime

DB_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"
DB_PATH = DB_DIR / "telemetry.db"


async def get_db() -> aiosqlite.Connection:
    """Return an open connection (caller must close or use as context-manager).
    Always ensures tables exist (all CREATE IF NOT EXISTS, so idempotent).
    """
    DB_DIR.mkdir(parents=True, exist_ok=True)
    db = await aiosqlite.connect(str(DB_PATH))
    db.row_factory = aiosqlite.Row
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA foreign_keys=ON")
    await db.executescript(SCHEMA_SQL)
    await db.commit()
    return db


async def init_db():
    """Create tables if they don't exist."""
    db = await get_db()
    try:
        await db.executescript(SCHEMA_SQL)
        await db.commit()
    finally:
        await db.close()


SCHEMA_SQL = """
-- ============================================================
-- BIKES — static bike configuration (one per season typically)
-- ============================================================
CREATE TABLE IF NOT EXISTS bikes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL DEFAULT '',
    -- Frame
    frame_brand     TEXT DEFAULT '',
    frame_model     TEXT DEFAULT '',
    frame_size      TEXT DEFAULT '',
    frame_year      TEXT DEFAULT '',
    weight_kg       REAL,
    -- Fork
    fork_brand      TEXT DEFAULT '',
    fork_model      TEXT DEFAULT '',
    fork_travel_mm  REAL,
    -- Shock
    shock_brand     TEXT DEFAULT '',
    shock_model     TEXT DEFAULT '',
    shock_travel_mm REAL,
    -- Tyres
    tyre_front_brand TEXT DEFAULT '',
    tyre_front_model TEXT DEFAULT '',
    tyre_front_size  TEXT DEFAULT '',
    tyre_rear_brand  TEXT DEFAULT '',
    tyre_rear_model  TEXT DEFAULT '',
    tyre_rear_size   TEXT DEFAULT '',
    -- Drivetrain
    drivetrain_type TEXT DEFAULT '',
    chainring       TEXT DEFAULT '',
    cassette        TEXT DEFAULT '',
    -- Brakes
    brake_front     TEXT DEFAULT '',
    brake_rear      TEXT DEFAULT '',
    brake_rotor_front_mm REAL,
    brake_rotor_rear_mm  REAL,
    brake_pad_type  TEXT DEFAULT '',
    -- Wheels
    wheel_front     TEXT DEFAULT '',
    wheel_rear      TEXT DEFAULT '',
    -- Meta
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- SETUPS — tunable parameters, linked to a bike
-- ============================================================
CREATE TABLE IF NOT EXISTS setups (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bike_id         INTEGER REFERENCES bikes(id) ON DELETE SET NULL,
    name            TEXT NOT NULL DEFAULT '',
    -- Fork tuning
    fork_pressure_psi   REAL,
    fork_hsc        TEXT DEFAULT '',
    fork_lsc        TEXT DEFAULT '',
    fork_hsr        TEXT DEFAULT '',
    fork_lsr        TEXT DEFAULT '',
    fork_tokens     INTEGER,
    -- Shock tuning
    shock_pressure_psi  REAL,
    shock_hsc       TEXT DEFAULT '',
    shock_lsc       TEXT DEFAULT '',
    shock_hsr       TEXT DEFAULT '',
    shock_lsr       TEXT DEFAULT '',
    shock_tokens    INTEGER,
    -- Tyre pressures
    tyre_front_pressure_bar REAL,
    tyre_front_insert       TEXT DEFAULT '',
    tyre_rear_pressure_bar  REAL,
    tyre_rear_insert        TEXT DEFAULT '',
    -- Meta
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- RUNS — a single recording / file import
-- ============================================================
CREATE TABLE IF NOT EXISTS runs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL DEFAULT '',
    file_name       TEXT DEFAULT '',
    bike_id         INTEGER REFERENCES bikes(id) ON DELETE SET NULL,
    setup_id        INTEGER REFERENCES setups(id) ON DELETE SET NULL,
    -- Run notes (inline for simplicity)
    date            TEXT DEFAULT '',
    location        TEXT DEFAULT '',
    track_name      TEXT DEFAULT '',
    weather         TEXT DEFAULT '',
    temperature_c   REAL,
    humidity_pct    REAL,
    trail_condition TEXT DEFAULT '',
    rider_name      TEXT DEFAULT '',
    rider_weight_kg REAL,
    session_goal    TEXT DEFAULT '',
    setup_changes   TEXT DEFAULT '',
    feeling_rating  INTEGER DEFAULT 3,
    feeling_notes   TEXT DEFAULT '',
    tags            TEXT DEFAULT '',
    -- Sensor settings used during import
    sensor_settings TEXT DEFAULT '{}',
    -- Splits (stored as JSON for flexibility)
    splits_json     TEXT DEFAULT '{"start":null,"end":null,"intermediates":[]}',
    -- Chart configs (stored as JSON)
    chart_configs   TEXT DEFAULT '[]',
    -- Filter configs
    filter_configs  TEXT DEFAULT '[]',
    -- Stats
    sample_count    INTEGER DEFAULT 0,
    duration_s      REAL DEFAULT 0,
    columns_json    TEXT DEFAULT '[]',
    -- Meta
    notes           TEXT DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- TELEMETRY_DATA — raw data rows, linked to a run
-- Uses a compact storage: one row per sample, columns stored as JSON
-- For large datasets this is much faster than one column per DB column.
-- ============================================================
CREATE TABLE IF NOT EXISTS telemetry_data (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id  INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    row_idx INTEGER NOT NULL,
    data    TEXT NOT NULL   -- JSON object: {"timestamp":1.23, "ax":0.1, ...}
);

CREATE INDEX IF NOT EXISTS idx_telemetry_run ON telemetry_data(run_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_run_row ON telemetry_data(run_id, row_idx);

-- ============================================================
-- SETTINGS — app-wide key-value settings
-- ============================================================
CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
);
"""


# ===== Helper: dict from Row =====
def row_to_dict(row: aiosqlite.Row | None) -> dict | None:
    if row is None:
        return None
    return dict(row)


def rows_to_list(rows: list[aiosqlite.Row]) -> list[dict]:
    return [dict(r) for r in rows]
