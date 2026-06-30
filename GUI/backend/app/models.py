"""Pydantic models for request/response validation."""

from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Optional


# ===== Bikes =====
class BikeCreate(BaseModel):
    name: str = ""
    frame_brand: str = ""
    frame_model: str = ""
    frame_size: str = ""
    frame_year: str = ""
    weight_kg: Optional[float] = None
    fork_brand: str = ""
    fork_model: str = ""
    fork_travel_mm: Optional[float] = None
    shock_brand: str = ""
    shock_model: str = ""
    shock_travel_mm: Optional[float] = None
    tyre_front_brand: str = ""
    tyre_front_model: str = ""
    tyre_front_size: str = ""
    tyre_rear_brand: str = ""
    tyre_rear_model: str = ""
    tyre_rear_size: str = ""
    drivetrain_type: str = ""
    chainring: str = ""
    cassette: str = ""
    brake_front: str = ""
    brake_rear: str = ""
    brake_rotor_front_mm: Optional[float] = None
    brake_rotor_rear_mm: Optional[float] = None
    brake_pad_type: str = ""
    wheel_front: str = ""
    wheel_rear: str = ""
    notes: str = ""


class BikeUpdate(BikeCreate):
    pass


class BikeOut(BikeCreate):
    id: int
    created_at: str = ""
    updated_at: str = ""


# ===== Setups =====
class SetupCreate(BaseModel):
    bike_id: Optional[int] = None
    name: str = ""
    fork_pressure_psi: Optional[float] = None
    fork_hsc: str = ""
    fork_lsc: str = ""
    fork_hsr: str = ""
    fork_lsr: str = ""
    fork_tokens: Optional[int] = None
    shock_pressure_psi: Optional[float] = None
    shock_hsc: str = ""
    shock_lsc: str = ""
    shock_hsr: str = ""
    shock_lsr: str = ""
    shock_tokens: Optional[int] = None
    tyre_front_pressure_bar: Optional[float] = None
    tyre_front_insert: str = ""
    tyre_rear_pressure_bar: Optional[float] = None
    tyre_rear_insert: str = ""
    notes: str = ""


class SetupUpdate(SetupCreate):
    pass


class SetupOut(SetupCreate):
    id: int
    created_at: str = ""
    updated_at: str = ""


# ===== Runs =====
class SplitLineSegment(BaseModel):
    start: dict
    end: dict
    center: dict
    bearing: float


class SplitsData(BaseModel):
    start: Optional[float] = None
    end: Optional[float] = None
    intermediates: list[float] = Field(default_factory=list)
    line_segments: dict = Field(default_factory=lambda: {"start": None, "end": None, "intermediates": []})


class RunNotesData(BaseModel):
    date: str = ""
    location: str = ""
    track_name: str = ""
    weather: str = ""
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    trail_condition: str = ""
    rider_name: str = ""
    rider_weight_kg: Optional[float] = None
    session_goal: str = ""
    setup_changes: str = ""
    feeling_rating: int = 3
    feeling_notes: str = ""
    tags: str = ""


class RunCreate(BaseModel):
    name: str = ""
    file_name: str = ""
    bike_id: Optional[int] = None
    setup_id: Optional[int] = None
    notes_data: RunNotesData = Field(default_factory=RunNotesData)
    splits: SplitsData = Field(default_factory=SplitsData)
    sensor_settings: dict = Field(default_factory=dict)
    chart_configs: list = Field(default_factory=list)
    filter_configs: list = Field(default_factory=list)
    notes: str = ""


class RunUpdate(BaseModel):
    name: Optional[str] = None
    bike_id: Optional[int] = None
    setup_id: Optional[int] = None
    notes_data: Optional[RunNotesData] = None
    splits: Optional[SplitsData] = None
    chart_configs: Optional[list] = None
    filter_configs: Optional[list] = None
    notes: Optional[str] = None


class RunOut(BaseModel):
    id: int
    name: str = ""
    file_name: str = ""
    bike_id: Optional[int] = None
    setup_id: Optional[int] = None
    date: str = ""
    location: str = ""
    track_name: str = ""
    weather: str = ""
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    trail_condition: str = ""
    rider_name: str = ""
    rider_weight_kg: Optional[float] = None
    session_goal: str = ""
    setup_changes: str = ""
    feeling_rating: int = 3
    feeling_notes: str = ""
    tags: str = ""
    sensor_settings: dict = Field(default_factory=dict)
    splits: SplitsData = Field(default_factory=SplitsData)
    chart_configs: list = Field(default_factory=list)
    filter_configs: list = Field(default_factory=list)
    sample_count: int = 0
    duration_s: float = 0
    columns: list[str] = Field(default_factory=list)
    notes: str = ""
    created_at: str = ""
    updated_at: str = ""
    # Optionally populated
    bike: Optional[BikeOut] = None
    setup: Optional[SetupOut] = None


class RunListOut(BaseModel):
    """Lightweight run info for listing (no telemetry data)."""
    id: int
    name: str = ""
    file_name: str = ""
    bike_id: Optional[int] = None
    setup_id: Optional[int] = None
    sample_count: int = 0
    duration_s: float = 0
    date: str = ""
    location: str = ""
    track_name: str = ""
    weather: str = ""
    feeling_rating: int = 3
    tags: str = ""
    created_at: str = ""
    bike_name: Optional[str] = None
    setup_name: Optional[str] = None


# ===== Telemetry upload =====
class TelemetryUpload(BaseModel):
    """Raw CSV text + metadata for creating a run with telemetry."""
    csv_text: str
    run: RunCreate = Field(default_factory=RunCreate)


# ===== Export / Import bundle =====
class ExportBundle(BaseModel):
    """A complete run export: bike + setup + run metadata + telemetry + splits."""
    version: int = 1
    bike: Optional[BikeOut] = None
    setup: Optional[SetupOut] = None
    run: RunOut
    telemetry_columns: list[str] = Field(default_factory=list)
    telemetry_data: list[dict] = Field(default_factory=list)


# ===== Settings =====
class SettingItem(BaseModel):
    key: str
    value: str


class SettingsBulk(BaseModel):
    settings: dict[str, str] = Field(default_factory=dict)
