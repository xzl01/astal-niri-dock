#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if ! command -v cmake >/dev/null 2>&1; then
    notify-send "Astal Niri Dock" "cmake is not installed or not in PATH" 2>/dev/null || true
    printf 'astal-niri-dock: cmake is not installed or not in PATH\n' >&2
    exit 127
fi

if [ -z "${NIRI_SOCKET:-}" ]; then
    notify-send "Astal Niri Dock" "NIRI_SOCKET is not set; start from inside niri" 2>/dev/null || true
    printf 'astal-niri-dock: NIRI_SOCKET is not set; start from inside niri\n' >&2
    exit 2
fi

export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-wayland}"

BUILD_DIR="${ASTAL_NIRI_DOCK_BUILD_DIR:-$SCRIPT_DIR/build}"
APP="$BUILD_DIR/astal-niri-dock-qt"

generator_args=()
if [ ! -f "$BUILD_DIR/CMakeCache.txt" ]; then
    if command -v ninja >/dev/null 2>&1; then
        generator_args=(-G Ninja)
    fi
fi

cmake -S "$SCRIPT_DIR" -B "$BUILD_DIR" "${generator_args[@]}"
cmake --build "$BUILD_DIR"
exec "$APP"
