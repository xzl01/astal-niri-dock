# astal-niri-dock

Archived Astal/AGS GTK4 prototype dock for niri. This project is kept for reference and local experimentation.

## Current status

- Runs as an AGS GTK4 layer-shell dock on niri.
- Auto-hides with a bottom edge sensor.
- Shows a configurable left status slot that can switch between task status and weather.
- Uses `AstalApps` for desktop entries and launching.
- Uses `AstalNiri` for windows, focus, urgency, and click-to-focus.
- Has custom glass styling in `src/style.css`.
- Not configured for niri autostart.

## Location

```sh
~/Dev/astal-niri-dock
```

## Requirements

- `ags` v3 / GTK4 runtime (`aylurs-gtk-shell` on this machine)
- `libastal-4-git`
- `libastal-gjs-git`
- `libastal-apps-git`
- `libastal-niri-git`
- niri running with `NIRI_SOCKET` available

## Run

```sh
cd ~/Dev/astal-niri-dock
./scripts/start.sh
```

Direct command:

```sh
ags run --gtk 4 ./src/app.tsx
```

## Stop

```sh
cd ~/Dev/astal-niri-dock
./scripts/stop.sh
```

## Check

```sh
cd ~/Dev/astal-niri-dock
./scripts/check.sh
```

The check script validates JSON and shell syntax. Type/runtime checks are limited by locally available AGS/Astal TypeScript bindings.

## Debug

```sh
cd ~/Dev/astal-niri-dock
./scripts/debug.sh
```

This prints AGS instances, niri layer surfaces, niri windows, focused window, and `/tmp/astal-niri-dock.log`.

## Configure pinned apps

Edit `config.json`:

```json
{
  "pinned": ["firefox.desktop", "org.kde.dolphin.desktop", "code.desktop", "kitty.desktop"]
}
```

## Configure weather

`config.json` also contains a static weather block used by the dock summary and popup. Set `"enabled": false` to hide it. This is intentionally config-driven for now; live weather API integration can be added later without changing the dock layout.

## Configure left status

The left dock slot is controlled by `status`. Its default task view is static config for now:

```json
{
  "status": {
    "enabled": true,
    "initial": "task",
    "task": {
      "enabled": true,
      "title": "3 / 5 条任务",
      "subtitle": "codex",
      "progress": 0.6
    }
  }
}
```

Click the slot to switch between task and weather. Weather details only open when the slot is currently in weather mode.

Folder stack popups are not implemented yet.

## Optional niri autostart

This project does not modify niri config automatically. If resumed later, the autostart line would be:

```kdl
spawn-at-startup "~/Dev/astal-niri-dock/scripts/start.sh"
```

## Implementation notes

- Entry point: `src/app.tsx`
- Styling: `src/style.css`
- Desktop app matching: `src/app-info.ts`
- Niri integration helpers: `src/niri.ts`
- Config loader: `src/config.ts`

Focus fallback order:

```text
window.focus(id) -> AstalNiri.msg.focus_window(id) -> niri msg action focus-window --id <id>
```

## Archive note

Development paused because the preferred direction is now Qt6/QML. Keep this project as a reference for:

- visual experiments,
- AstalNiri property names,
- desktop-entry matching ideas,
- auto-hide edge sensor behavior.

Do not add new features here unless explicitly reviving the Astal prototype.
