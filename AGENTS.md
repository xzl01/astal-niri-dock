# AGENTS.md — astal-niri-dock

## Project status

This project has been revived as a Qt6/QML dock for niri. The original Astal/AGS GTK4 prototype is kept in `src/*.ts(x)` as migration reference, but the active implementation is Qt/QML.

## Working directory

```sh
~/Dev/astal-niri-dock
```

## Rules for future agents

- Do not add features proactively.
- Keep changes minimal and reversible.
- Preserve niri compatibility; do not introduce Hyprland-only APIs.
- Do not add autostart entries unless explicitly requested.
- Keep the Qt6/QML implementation as the active direction unless the user specifically asks for Astal/AGS.

## Architecture

- `CMakeLists.txt`: Qt6/C++ build entry point.
- `qml/Main.qml`: dock UI, glass styling, hover animations, running/focused/urgent indicators, bottom sensor.
- `src-qt/main.cpp`: Qt application entry point and QML context setup.
- `src-qt/dockcontroller.*`: config loading, auto-hide state, niri polling, dock entry model, click handling.
- `src-qt/desktopappdatabase.*`: `.desktop` lookup, icon names, app matching, launching.
- `src-qt/layershellbridge.*`: LayerShellQt setup for niri overlay layer windows.
- `src-qt/themeiconprovider.*`: QML image provider for themed desktop icons.
- `src/*.ts(x)`: legacy AGS prototype reference only.
- `scripts/start.sh`: builds if needed and starts the Qt dock.
- `scripts/stop.sh`: stops the Qt dock and any legacy AGS instance.
- `scripts/check.sh`: JSON/shell checks and Qt build when dependencies are installed.
- `scripts/debug.sh`: prints Qt process, legacy AGS/niri/debug status.

## Validation commands

```sh
cd ~/Dev/astal-niri-dock
./scripts/check.sh
./scripts/stop.sh
./scripts/start.sh
./scripts/debug.sh
./scripts/verify-runtime.sh
```

Expected niri layers when running:

```text
Overlay layer:
  Namespace: "astal-niri-dock"
  Namespace: "astal-niri-dock-sensor"
```

## Known dependencies

- Qt6 development packages: Core, Gui, Qml, Quick, QuickControls2.
- Qt Wayland runtime/plugin.
- `layer-shell-qt` / `LayerShellQt` development package for Wayland layer-shell support.
- `niri` with `NIRI_SOCKET` available.
- `cmake` and optionally `ninja`.

## Known caveats

- **CRITICAL: niri 26.04 + Qt 6.11 Wayland incompatibility.** `wl_compositor` v6's `preferred_buffer_scale` event has no handler in Qt's Wayland client, preventing all surface creation. The Qt dock code compiles but produces invisible windows. Use the AGS/GTK4 prototype (master branch) until Qt or niri resolves this. Full analysis in `DEVELOPMENT.md`.
- The project is not installed and not autostarted.
- Runtime validation must happen inside a niri session.
- LayerShellQt is required. Without it, the dock layer behavior is not complete and the Qt build should fail.

## Future direction

Continue the Qt6/QML implementation unless the user explicitly asks to inspect or restore the legacy Astal/AGS prototype.

Before attempting to run the Qt dock, verify the Qt+Wayland+niri compatibility as described in `DEVELOPMENT.md`.
