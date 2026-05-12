#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if ! command -v ags >/dev/null 2>&1; then
    notify-send "Astal Niri Dock" "ags is not installed or not in PATH" 2>/dev/null || true
    printf 'astal-niri-dock: ags is not installed or not in PATH\n' >&2
    exit 127
fi

if [ -z "${NIRI_SOCKET:-}" ]; then
    notify-send "Astal Niri Dock" "NIRI_SOCKET is not set; start from inside niri" 2>/dev/null || true
    printf 'astal-niri-dock: NIRI_SOCKET is not set; start from inside niri\n' >&2
    exit 2
fi

exec ags run --gtk 4 ./src/app.tsx
