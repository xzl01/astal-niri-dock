# AGENTS.md — astal-niri-dock

## Project status

This is an Astal/AGS GTK4 prototype dock for niri.

## Working directory

```sh
~/Dev/astal-niri-dock
```

## Rules for future agents

- Treat this project as archived unless the user explicitly asks to revive it.
- Do not add features proactively.
- Keep changes minimal and reversible.
- Preserve niri compatibility; do not introduce Hyprland-only APIs.
- Do not add autostart entries unless explicitly requested.
- Prefer Qt6/QML for any new dock direction unless the user specifically asks for Astal/AGS.

## Architecture

- `src/app.tsx`: AGS GTK4 entry point, dock UI, auto-hide sensor, click handling.
- `src/style.css`: visual styling for glass dock, hover states, running indicators.
- `src/app-info.ts`: `AstalApps` desktop-entry lookup, icon names, app matching.
- `src/niri.ts`: `AstalNiri` helpers for app id, focus, urgency, and CLI fallback.
- `src/config.ts`: loads `config.json` from the project working directory.
- `scripts/start.sh`: starts the AGS instance.
- `scripts/stop.sh`: stops the AGS instance.
- `scripts/check.sh`: static checks.
- `scripts/debug.sh`: prints AGS/niri/debug status.

## Validation commands

```sh
cd ~/Dev/astal-niri-dock
./scripts/check.sh
./scripts/stop.sh
./scripts/start.sh
./scripts/debug.sh
```

Expected niri layers when running:

```text
Overlay layer:
  Namespace: "astal-niri-dock"
  Namespace: "astal-niri-dock-sensor"
```

## Known dependencies

- `aylurs-gtk-shell` provides `ags`.
- `libastal-4-git`
- `libastal-gjs-git`
- `libastal-apps-git`
- `libastal-niri-git`

## Known caveats

- AGS needs `--gtk 4` for this entry point.
- Some Astal/Niri examples use both `appId` and `app_id`; this project handles both.
- `Window.focus()` in AstalNiri requires an id argument.
- The project is not installed and not autostarted.

## Future direction

If the user asks to continue dock work, first consider whether the requested work belongs in a new Qt6/QML project instead of this Astal archive.
