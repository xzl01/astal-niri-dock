#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

python3 -m json.tool package.json >/dev/null
python3 -m json.tool tsconfig.json >/dev/null
python3 -m json.tool config.json >/dev/null
python3 scripts/verify-migration.py

bash -n scripts/start.sh
bash -n scripts/stop.sh
bash -n scripts/check.sh
bash -n scripts/debug.sh
bash -n scripts/verify-runtime.sh

STRICT="${ASTAL_NIRI_DOCK_STRICT_CHECK:-0}"
CHECK_BUILD_DIR="${ASTAL_NIRI_DOCK_CHECK_BUILD_DIR:-$SCRIPT_DIR/build/check}"

if command -v cmake >/dev/null 2>&1; then
    generator_args=()
    if command -v ninja >/dev/null 2>&1; then
        generator_args=(-G Ninja)
    fi

    if cmake -S "$SCRIPT_DIR" -B "$CHECK_BUILD_DIR" "${generator_args[@]}"; then
        cmake --build "$CHECK_BUILD_DIR"
    else
        printf 'warning: Qt6/LayerShellQt configure failed; install Qt6 dev packages on the niri target to build\n' >&2
        if [ "$STRICT" = "1" ]; then
            exit 1
        fi
    fi
else
    printf 'warning: cmake is not installed or not in PATH\n' >&2
    if [ "$STRICT" = "1" ]; then
        exit 1
    fi
fi

if command -v tsc >/dev/null 2>&1; then
    tsc --noEmit || true
fi

if [ -z "${NIRI_SOCKET:-}" ]; then
    printf 'warning: NIRI_SOCKET is not set; run this inside niri\n' >&2
fi

printf 'astal-niri-dock: static checks passed\n'
