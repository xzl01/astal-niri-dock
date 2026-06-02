#!/bin/bash

set -euo pipefail

printf '== Qt dock process ==\n'
pgrep -af astal-niri-dock-qt 2>/dev/null || true

printf '\n== Environment ==\n'
printf 'NIRI_SOCKET=%s\n' "${NIRI_SOCKET:-}"
printf 'QT_QPA_PLATFORM=%s\n' "${QT_QPA_PLATFORM:-}"
printf 'QT_WAYLAND_SHELL_INTEGRATION=%s\n' "${QT_WAYLAND_SHELL_INTEGRATION:-}"

printf '\n== Legacy AGS instances ==\n'
ags list 2>/dev/null || true

printf '\n== niri layers ==\n'
if command -v niri >/dev/null 2>&1 && [ -n "${NIRI_SOCKET:-}" ]; then
    niri msg layers || true
else
    printf 'niri is unavailable or NIRI_SOCKET is not set\n'
fi

printf '\n== niri windows ==\n'
if command -v niri >/dev/null 2>&1 && [ -n "${NIRI_SOCKET:-}" ]; then
    niri msg -j windows || true
else
    printf 'niri is unavailable or NIRI_SOCKET is not set\n'
fi

printf '\n\n== niri focused window ==\n'
if command -v niri >/dev/null 2>&1 && [ -n "${NIRI_SOCKET:-}" ]; then
    niri msg -j focused-window || true
else
    printf 'niri is unavailable or NIRI_SOCKET is not set\n'
fi

printf '\n\n== dock log ==\n'
if [ -f /tmp/astal-niri-dock.log ]; then
    sed -n '1,160p' /tmp/astal-niri-dock.log
fi
