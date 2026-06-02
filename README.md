# astal-niri-dock

Qt6/QML dock for niri, migrated from the archived Astal/AGS GTK4 prototype in this repository.

## Current status

- Uses Qt6/QML for the dock UI.
- Uses LayerShellQt for Wayland overlay-layer windows on niri.
- Auto-hides with a bottom edge sensor.
- Reads pinned applications from `config.json`.
- Parses `.desktop` files for names, icon names, launch commands, `StartupWMClass`, and executable matching.
- Uses `niri msg -j windows` and `niri msg -j focused-window` for running windows, focus, urgency, and app-id fallback.
- Clicks focus an existing niri window, or launch the pinned desktop application when no window exists.
- Not configured for niri autostart.

The old AGS implementation remains under `src/*.ts(x)` as reference only. The active implementation is under `src-qt/` and `qml/`.

## Requirements

- Qt 6 development packages: Core, Gui, Qml, Quick, QuickControls2
- Qt Wayland runtime/plugin
- `layer-shell-qt` / `LayerShellQt` development package
- `niri` running with `NIRI_SOCKET` available
- `cmake`
- `ninja` optional

## Run

```sh
cd ~/Dev/astal-niri-dock
./scripts/start.sh
```

`start.sh` runs CMake configure, performs an incremental build, then executes `build/astal-niri-dock-qt`.

Direct build:

```sh
cmake -S . -B build -G Ninja
cmake --build build
./build/astal-niri-dock-qt
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

On a machine with Qt6 and LayerShellQt development packages installed, this configures and builds the Qt dock. On machines without those packages, it still validates JSON and shell syntax and prints a dependency warning.

For strict CI-style behavior:

```sh
ASTAL_NIRI_DOCK_STRICT_CHECK=1 ./scripts/check.sh
```

## Debug

```sh
cd ~/Dev/astal-niri-dock
./scripts/debug.sh
```

This prints the Qt process, Qt/niri environment, niri layers/windows, the focused niri window, and `/tmp/astal-niri-dock.log`.

Expected niri layers when running:

```text
Overlay layer:
  Namespace: "astal-niri-dock"
  Namespace: "astal-niri-dock-sensor"
```

## Runtime verification

Inside a niri session with Qt6 and LayerShellQt installed:

```sh
cd ~/Dev/astal-niri-dock
./scripts/verify-runtime.sh
```

This stops any existing dock instance, builds and starts the Qt dock with `ASTAL_NIRI_DOCK_VERIFY_VISIBLE=1`, waits for both niri layer namespaces, validates `niri msg -j windows` JSON, checks the Qt log for critical/fatal messages, then stops the dock. Normal startup still begins in the auto-hidden state.

## Configure pinned apps

Edit `config.json`:

```json
{
  "pinned": ["firefox.desktop", "org.kde.dolphin.desktop", "code.desktop", "kitty.desktop"]
}
```

## Implementation notes

- UI and animation: `qml/Main.qml`
- Dock state and niri polling: `src-qt/dockcontroller.cpp`
- Desktop entry lookup and matching: `src-qt/desktopappdatabase.cpp`
- Layer-shell setup: `src-qt/layershellbridge.cpp`
- Theme icon rendering: `src-qt/themeiconprovider.cpp`

Focus path:

```text
click dock item -> niri msg action focus-window --id <id>
```

App identity fallback:

```text
niri app_id -> wm_class -> /proc/<pid>/exe basename -> /proc/<pid>/cmdline basename
```
