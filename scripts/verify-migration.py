#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require_contains(path: str, needles: list[str]) -> list[str]:
    text = read(path)
    return [f"{path}: missing {needle!r}" for needle in needles if needle not in text]


def main() -> int:
    errors: list[str] = []

    package = json.loads(read("package.json"))
    scripts = package.get("scripts", {})
    if scripts.get("start") != "./scripts/start.sh":
        errors.append("package.json: default start script must use the Qt launcher")
    if scripts.get("check") != "./scripts/check.sh":
        errors.append("package.json: default check script must use scripts/check.sh")
    if scripts.get("verify:runtime") != "./scripts/verify-runtime.sh":
        errors.append("package.json: runtime verification script must use scripts/verify-runtime.sh")
    if "legacy:ags:start" not in scripts:
        errors.append("package.json: legacy AGS start script should remain explicitly namespaced")

    errors += require_contains("CMakeLists.txt", [
        "find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Qml Quick QuickControls2)",
        "find_package(LayerShellQt REQUIRED)",
        "qt_add_executable(astal-niri-dock-qt",
        "qt_add_qml_module(astal-niri-dock-qt",
        "qml/Main.qml",
        "LayerShellQt::Interface",
    ])

    errors += require_contains("scripts/start.sh", [
        "cmake -S",
        "cmake --build",
        "CMakeCache.txt",
        "NIRI_SOCKET",
        "QT_QPA_PLATFORM",
        "astal-niri-dock-qt",
        'exec "$APP"',
    ])
    errors += require_contains("scripts/stop.sh", [
        "pkill -x astal-niri-dock-qt",
    ])
    errors += require_contains("scripts/debug.sh", [
        "pgrep -af astal-niri-dock-qt",
        "QT_QPA_PLATFORM",
        "QT_WAYLAND_SHELL_INTEGRATION",
        "niri msg layers",
        "niri msg -j windows",
        "niri msg -j focused-window",
    ])
    errors += require_contains("scripts/verify-runtime.sh", [
        "NIRI_SOCKET",
        "./scripts/start.sh",
        "ASTAL_NIRI_DOCK_VERIFY_VISIBLE=1",
        "./scripts/stop.sh",
        "niri msg layers",
        "Namespace: \"astal-niri-dock\"",
        "Namespace: \"astal-niri-dock-sensor\"",
        "niri msg -j windows",
        "python3 -m json.tool",
        "runtime verification passed",
    ])
    if not os.access(ROOT / "scripts/verify-runtime.sh", os.X_OK):
        errors.append("scripts/verify-runtime.sh: must be executable")

    qml = read("qml/Main.qml")
    if qml.count("Window {") < 2:
        errors.append("qml/Main.qml: expected dock and sensor Window objects")
    errors += require_contains("qml/Main.qml", [
        "layerShell.configureDock(dockWindow)",
        "layerShell.configureSensor(sensorWindow)",
        "dockController.showDock",
        "dockController.activate(index)",
        "dockController.dockEntered()",
        "dockController.edgeEntered()",
        "HoverHandler",
        "showDockAnimation",
        "hideDockAnimation",
        "modelData.focused",
        "modelData.urgent",
        "modelData.running",
        "image://themeicon/",
        "readonly property int dockHeight: 96",
        "readonly property int sensorHeight: 6",
        "width: 54",
        "height: 54",
        "width: 38",
        "height: 38",
        "dockItemBox.focused ? 20",
        "dockItemBox.running ? 4",
    ])

    errors += require_contains("src-qt/dockcontroller.cpp", [
        "constexpr int DockHideTimeoutMs = 650",
        "constexpr int EdgeHideTimeoutMs = 260",
        "constexpr int NiriPollIntervalMs = 600",
        "loadPinnedConfig",
        "config.json",
        "runNiriCommand",
        '"windows"',
        '"focused-window"',
        '"focus-window"',
        '"app_id"',
        '"wm_class"',
        "processNameForPid",
        "/proc/%1/exe",
        "/proc/%1/cmdline",
    ])

    errors += require_contains("src-qt/desktopappdatabase.cpp", [
        "StartupWMClass",
        "gtk-launch",
        "QProcess::splitCommand",
        "XDG_DATA_HOME",
        "XDG_DATA_DIRS",
        "application-x-executable",
        "desktopExecToCommandLine",
    ])

    errors += require_contains("src-qt/layershellbridge.cpp", [
        "QT_QPA_PLATFORM",
        "LayerShellQt::Shell::useLayerShell()",
        "setScope(scope)",
        "LayerOverlay",
        "KeyboardInteractivityNone",
        "AnchorBottom",
        "AnchorLeft",
        "AnchorRight",
        "setDesiredSize",
        "setExclusiveZone(0)",
    ])

    errors += require_contains("src-qt/main.cpp", [
        "/tmp/astal-niri-dock.log",
        "qInstallMessageHandler",
        "LayerShellBridge::initialize()",
        "engine.rootContext()->setContextProperty",
        "dockController",
        "layerShell",
        "addImageProvider",
        "themeicon",
    ])

    errors += require_contains("README.md", [
        "Qt6/QML dock for niri",
        "astal-niri-dock-sensor",
        "niri msg action focus-window --id",
    ])
    errors += require_contains("DEVELOPMENT.md", [
        "迁移后的功能对应",
        "验证 checklist",
        "LayerShellQt",
    ])

    for legacy_path in [
        "src/app.tsx",
        "src/app-info.ts",
        "src/niri.ts",
        "src/config.ts",
        "src/style.css",
    ]:
        if not (ROOT / legacy_path).exists():
            errors.append(f"{legacy_path}: legacy AGS reference file should remain present")

    if errors:
        for error in errors:
            print(error, file=sys.stderr)
        return 1

    print("astal-niri-dock: Qt/QML migration invariants passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
