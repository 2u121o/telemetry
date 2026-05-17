#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd "$(dirname "$0")" && pwd)"
cd "$script_dir"
python_bin="$script_dir/venv/bin/python"
if [[ ! -x "$python_bin" ]]; then
  python_bin="python3"
fi
"$python_bin" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
