#!/usr/bin/env bash
# Export all four printable half-rings + optional layout previews (OpenSCAD).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCAD="$HERE/fork_travel_sensor_mount.scad"
OUT="${1:-$HERE/stl}"
mkdir -p "$OUT"

one() {
  local part="$1" fname="$2"
  echo "[$part] -> $fname"
  openscad -D "PART=\"$part\"" -o "$OUT/$fname" "$SCAD"
}

one stanchion_upper   fork_travel_stanchion_upper.stl
one stanchion_lower   fork_travel_stanchion_lower.stl
one lowerleg_upper    fork_travel_lowerleg_upper.stl
one lowerleg_lower    fork_travel_lowerleg_lower.stl
one stanchion_layout  fork_travel_stanchion_layout.stl
one lowerleg_layout   fork_travel_lowerleg_layout.stl
one both_kits_layout  fork_travel_both_kits_layout.stl

echo "[fork_air_valve_cap_clip.scad] -> fork_air_valve_cap_clip.stl"
openscad -o "$OUT/fork_air_valve_cap_clip.stl" "$HERE/fork_air_valve_cap_clip.scad"

echo "Done -> $OUT"
