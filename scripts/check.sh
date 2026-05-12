#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

python3 -m json.tool package.json >/dev/null
python3 -m json.tool tsconfig.json >/dev/null
python3 -m json.tool config.json >/dev/null

bash -n scripts/start.sh
bash -n scripts/stop.sh
bash -n scripts/check.sh
bash -n scripts/debug.sh

if command -v tsc >/dev/null 2>&1; then
    tsc --noEmit || true
fi

if ! command -v ags >/dev/null 2>&1; then
    printf 'warning: ags is not installed or not in PATH\n' >&2
fi

if [ -z "${NIRI_SOCKET:-}" ]; then
    printf 'warning: NIRI_SOCKET is not set; run this inside niri\n' >&2
fi

printf 'astal-niri-dock: static checks passed\n'
