#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

START_LOG="${ASTAL_NIRI_DOCK_VERIFY_START_LOG:-/tmp/astal-niri-dock-verify-start.log}"
DOCK_LOG="${ASTAL_NIRI_DOCK_LOG:-/tmp/astal-niri-dock.log}"
LAYERS_FILE="${ASTAL_NIRI_DOCK_VERIFY_LAYERS:-/tmp/astal-niri-dock-verify-layers.txt}"
WINDOWS_FILE="${ASTAL_NIRI_DOCK_VERIFY_WINDOWS:-/tmp/astal-niri-dock-verify-windows.json}"

require_command() {
    local command_name="$1"
    if ! command -v "$command_name" >/dev/null 2>&1; then
        printf 'astal-niri-dock: required command not found: %s\n' "$command_name" >&2
        exit 127
    fi
}

require_command cmake
require_command niri
require_command python3

if [ -z "${NIRI_SOCKET:-}" ]; then
    printf 'astal-niri-dock: NIRI_SOCKET is not set; run runtime verification inside niri\n' >&2
    exit 2
fi

cleanup() {
    ./scripts/stop.sh >/dev/null 2>&1 || true
}

trap cleanup EXIT

./scripts/stop.sh
rm -f "$START_LOG" "$DOCK_LOG" "$LAYERS_FILE" "$WINDOWS_FILE"

ASTAL_NIRI_DOCK_VERIFY_VISIBLE=1 ./scripts/start.sh >"$START_LOG" 2>&1 &
START_PID=$!

for _ in $(seq 1 50); do
    if ! kill -0 "$START_PID" >/dev/null 2>&1; then
        printf 'astal-niri-dock: start command exited before runtime verification completed\n' >&2
        sed -n '1,160p' "$START_LOG" >&2 || true
        exit 1
    fi

    if niri msg layers >"$LAYERS_FILE" 2>/dev/null \
        && grep -q 'Namespace: "astal-niri-dock"' "$LAYERS_FILE" \
        && grep -q 'Namespace: "astal-niri-dock-sensor"' "$LAYERS_FILE"; then
        break
    fi

    sleep 0.2
done

if ! grep -q 'Namespace: "astal-niri-dock"' "$LAYERS_FILE" 2>/dev/null \
    || ! grep -q 'Namespace: "astal-niri-dock-sensor"' "$LAYERS_FILE" 2>/dev/null; then
    printf 'astal-niri-dock: expected niri layer namespaces were not observed\n' >&2
    sed -n '1,200p' "$LAYERS_FILE" >&2 || true
    sed -n '1,160p' "$START_LOG" >&2 || true
    exit 1
fi

niri msg -j windows >"$WINDOWS_FILE"
python3 -m json.tool "$WINDOWS_FILE" >/dev/null

if [ -f "$DOCK_LOG" ] && grep -E '\[(critical|fatal)\]' "$DOCK_LOG" >/dev/null 2>&1; then
    printf 'astal-niri-dock: critical Qt log messages found\n' >&2
    sed -n '1,200p' "$DOCK_LOG" >&2
    exit 1
fi

printf 'astal-niri-dock: runtime verification passed\n'
printf '  layers: %s\n' "$LAYERS_FILE"
printf '  windows: %s\n' "$WINDOWS_FILE"
printf '  start log: %s\n' "$START_LOG"
printf '  dock log: %s\n' "$DOCK_LOG"
