#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
