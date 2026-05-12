#!/bin/bash

set -euo pipefail

printf '== AGS instances ==\n'
ags list 2>/dev/null || true

printf '\n== niri layers ==\n'
niri msg layers

printf '\n== niri windows ==\n'
niri msg -j windows

printf '\n\n== niri focused window ==\n'
niri msg -j focused-window || true

printf '\n\n== dock log ==\n'
if [ -f /tmp/astal-niri-dock.log ]; then
    sed -n '1,160p' /tmp/astal-niri-dock.log
fi
