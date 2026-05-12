#!/bin/bash

set -euo pipefail

if command -v ags >/dev/null 2>&1; then
    ags quit --instance astal-niri-dock 2>/dev/null || true
fi

pkill -f 'astal-niri-dock/src/app\.tsx|ags run --gtk 4 ./src/app\.tsx' 2>/dev/null || true
