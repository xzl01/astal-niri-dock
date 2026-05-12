#!/usr/bin/env -S ags run --gtk 4

import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createBinding, createComputed, createState, For } from "ags"
import css from "./style.css"
import { findApp, matchAppId, type AppInfo } from "./app-info"
import { loadConfig } from "./config"
import { focusWindow, getNiri, windowAppId, windowIsFocused, windowIsUrgent, windowTitle, type NiriWindow } from "./niri"

const config = loadConfig()
let niri = getNiri()
let niriRetryTimer: ReturnType<typeof setTimeout> | null = null
const pinnedApps = config.pinned.map(findApp)

function uniqueBy<T>(items: T[], key: (item: T) => string): T[] {
  const seen = new Set<string>()
  const result: T[] = []

  for (const item of items) {
    const value = key(item)
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(item)
  }

  return result
}

type DockEntry = {
  appInfo: AppInfo
  windows: NiriWindow[]
  focused: boolean
}

function buildDockEntries(windows: NiriWindow[], focusedWindow: NiriWindow | null): DockEntry[] {
  const pinnedEntries = pinnedApps.map((appInfo) => {
    const matchedWindows = windows.filter((window) => matchAppId(appInfo, windowAppId(window)))

    return {
      appInfo,
      windows: matchedWindows,
      focused: matchedWindows.some((window) => windowIsFocused(window) || (focusedWindow ? window.id === focusedWindow.id : false)),
    }
  })

  const unpinnedApps = uniqueBy(
    windows
      .map((window) => findApp(windowAppId(window)))
      .filter((appInfo) => !pinnedApps.some((pinned) => matchAppId(pinned, appInfo.id))),
    (appInfo) => appInfo.id,
  )

  const unpinnedEntries = unpinnedApps.map((appInfo) => {
    const matchedWindows = windows.filter((window) => matchAppId(appInfo, windowAppId(window)))

    return {
      appInfo,
      windows: matchedWindows,
      focused: matchedWindows.some((window) => windowIsFocused(window) || (focusedWindow ? window.id === focusedWindow.id : false)),
    }
  })

  return [...pinnedEntries, ...unpinnedEntries]
}

const DOCK_HIDE_TIMEOUT = 650
const EDGE_HIDE_TIMEOUT = 260

function DockItem({ entry }: { entry: DockEntry }) {
  const { appInfo, windows, focused } = entry
  const urgent = windows.some(windowIsUrgent)

  return (
    <box orientation={Gtk.Orientation.VERTICAL} class="DockItemBox">
      <button
        class={urgent ? "DockItem urgent" : focused ? "DockItem focused" : "DockItem"}
        tooltipText={windows.length > 0 ? `${appInfo.name}: ${windows.map(windowTitle).join(" / ")}` : appInfo.name}
        onClicked={() => {
          const target = windows[0]
          if (target) {
            focusWindow(target)
          } else {
            appInfo.launch()
          }
        }}
      >
        <image class="DockIcon" iconName={appInfo.iconName} pixelSize={38} />
      </button>
      <centerbox>
        <box />
        <box class={focused ? "RunningDot focused" : windows.length > 0 ? "RunningDot" : ""} />
        <box />
      </centerbox>
    </box>
  )
}

function FallbackItem({ appInfo }: { appInfo: AppInfo }) {
  return (
    <button class="DockItem" tooltipText={appInfo.name} onClicked={() => appInfo.launch()}>
      <image class="DockIcon" iconName={appInfo.iconName} pixelSize={38} />
    </button>
  )
}

function EdgeSensor({ setDockTrigger }: { setDockTrigger: (value: boolean) => void }) {
  let triggerTimeout: number | null = null

  const show = () => {
    if (triggerTimeout) {
      clearTimeout(triggerTimeout)
      triggerTimeout = null
    }
    setDockTrigger(true)
  }

  const hide = () => {
    if (triggerTimeout) clearTimeout(triggerTimeout)
    triggerTimeout = setTimeout(() => {
      setDockTrigger(false)
      triggerTimeout = null
    }, EDGE_HIDE_TIMEOUT)
  }

  return (
    <window
      visible
      name="astal-niri-dock-sensor"
      namespace="astal-niri-dock-sensor"
      class="EdgeSensor"
      layer={Astal.Layer.BACKGROUND}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      anchor={Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
      defaultHeight={6}
      $={(self) => {
        const motion = new Gtk.EventControllerMotion()
        motion.connect("enter", show)
        motion.connect("leave", hide)
        self.add_controller(motion)
      }}
    >
      <box class="EdgeSensorFill" />
    </window>
  )
}

function Dock({ setDockHovered }: {
  setDockHovered: (value: boolean) => void
}) {
  let leaveTimeout: number | null = null

  const onEnterDock = () => {
    if (leaveTimeout) {
      clearTimeout(leaveTimeout)
      leaveTimeout = null
    }
    setDockHovered(true)
  }

  const onLeaveDock = () => {
    if (leaveTimeout) clearTimeout(leaveTimeout)
    leaveTimeout = setTimeout(() => {
      setDockHovered(false)
      leaveTimeout = null
    }, DOCK_HIDE_TIMEOUT)
  }

  const attachHover = (self: Gtk.Widget) => {
    const motion = new Gtk.EventControllerMotion()
    motion.connect("enter", onEnterDock)
    motion.connect("leave", onLeaveDock)
    self.add_controller(motion)
  }

  if (!niri) {
    return (
      <box
        class="DockBarContainer"
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.END}
        $={attachHover}
      >
        <box class="DockBar">
          <For each={pinnedApps}>{(appInfo) => <FallbackItem appInfo={appInfo} />}</For>
        </box>
      </box>
    )
  }

  const windows = createBinding(niri, "windows")
  const focusedWindow = createBinding(niri, "focusedWindow")
  const dockEntries = createComputed([windows, focusedWindow], buildDockEntries)

  return (
    <box
      class="DockBarContainer"
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.END}
      $={attachHover}
    >
      <box class="DockBar">
        <For each={dockEntries}>{(entry) => <DockItem entry={entry} />}</For>
      </box>
    </box>
  )
}

app.start({
  instanceName: "astal-niri-dock",
  css,
  main() {
    const [dockTrigger, setDockTrigger] = createState(false)
    const [dockHovered, setDockHovered] = createState(false)
    const [niriRefresh, setNiriRefresh] = createState(0)
    const showDock = createComputed([dockTrigger, dockHovered], (trigger, hovered) => trigger || hovered)

    void niriRefresh

    if (!niri && !niriRetryTimer) {
      const retryNiri = () => {
        niriRetryTimer = null
        if (niri) return

        const discovered = getNiri()
        if (discovered) {
          niri = discovered
          setNiriRefresh(Date.now())
          return
        }

        niriRetryTimer = setTimeout(retryNiri, 1000)
      }

      niriRetryTimer = setTimeout(retryNiri, 1000)
    }

    return [
      <window
        visible={showDock}
        name="astal-niri-dock"
        namespace="astal-niri-dock"
        class="DockWindow"
        layer={Astal.Layer.OVERLAY}
        exclusivity={Astal.Exclusivity.IGNORE}
        keymode={Astal.Keymode.NONE}
        anchor={Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
        defaultHeight={96}
        marginBottom={4}
      >
        <Dock setDockHovered={setDockHovered} />
      </window>,
      <EdgeSensor setDockTrigger={setDockTrigger} />,
    ]
  },
})
