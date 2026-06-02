#!/usr/bin/env -S ags run --gtk 4

import app from "ags/gtk4/app"
import { Astal, Gtk } from "ags/gtk4"
import { createBinding, createComputed, createState, For } from "ags"
import css from "./style.css"
import { findApp, matchAppId, type AppInfo } from "./app-info"
import { loadConfig, type StatusConfig, type StatusMode, type WeatherConfig, type WeatherForecast } from "./config"
import { focusWindow, getNiri, windowAppId, windowIsFocused, windowIsUrgent, windowTitle, type NiriWindow } from "./niri"

const config = loadConfig()
let niri = getNiri()
let niriRetryTimer: ReturnType<typeof setTimeout> | null = null
const pinnedApps = config.pinned.map(findApp)
const status = config.status
const weather = config.weather

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
const WEATHER_POPUP_HIDE_TIMEOUT = 420

function weatherRangeLabel(weather: WeatherConfig): string {
  const [low, high] = weather.range.split("-")
  if (low && high) return `最低 ${low}，最高 ${high}`
  return weather.range
}

const showStatusSlot = status.enabled && (status.task.enabled || weather.enabled)

function normalizeStatusMode(mode: StatusMode): StatusMode {
  if (mode === "weather" && weather.enabled) return "weather"
  if (status.task.enabled) return "task"
  return "weather"
}

function nextStatusMode(mode: StatusMode): StatusMode {
  if (mode === "task" && weather.enabled) return "weather"
  if (mode === "weather" && status.task.enabled) return "task"
  return normalizeStatusMode(mode)
}

function StatusDockItem({
  mode,
  status,
  weather,
  toggleStatus,
  showWeatherPopup,
  hideWeatherPopup,
}: {
  mode: ReturnType<typeof createComputed<StatusMode>>
  status: StatusConfig
  weather: WeatherConfig
  toggleStatus: () => void
  showWeatherPopup: () => void
  hideWeatherPopup: () => void
}) {
  const progressWidth = Math.round(78 * status.task.progress)
  const itemClass = createComputed((get) => `StatusDockItem ${get(mode)}`)
  const iconClass = createComputed((get) => `StatusDockIcon ${get(mode)}`)
  const iconName = createComputed((get) => get(mode) === "weather" ? weather.iconName : status.task.iconName)
  const title = createComputed((get) => get(mode) === "weather" ? `${weather.temperature}°C` : status.task.title)
  const subtitle = createComputed((get) => get(mode) === "weather" ? `${weather.condition} ${weather.range}` : status.task.subtitle)
  const progressVisible = createComputed((get) => get(mode) === "task")

  return (
    <button
      class={itemClass}
      tooltipText="点击切换状态；天气状态悬停显示详情"
      onClicked={toggleStatus}
      $={(self) => {
        const motion = new Gtk.EventControllerMotion()
        motion.connect("enter", showWeatherPopup)
        motion.connect("leave", hideWeatherPopup)
        self.add_controller(motion)
      }}
    >
      <box class="StatusDockContent">
        <image class={iconClass} iconName={iconName} pixelSize={28} />
        <box orientation={Gtk.Orientation.VERTICAL} class="StatusDockText">
          <label class="StatusDockTitle" label={title} xalign={0} />
          <box class="StatusProgress" visible={progressVisible}>
            <box class="StatusProgressFill" widthRequest={progressWidth} />
          </box>
          <label class="StatusDockSubtitle" label={subtitle} xalign={0} />
        </box>
      </box>
    </button>
  )
}

function WeatherForecastRow({ item }: { item: WeatherForecast }) {
  return (
    <box class="WeatherForecastRow">
      <label class="WeatherForecastDay" label={item.day} xalign={0} />
      <label class="WeatherForecastRange" label={item.range} xalign={1} />
      <image class="WeatherForecastIcon" iconName={item.iconName} pixelSize={18} />
    </box>
  )
}

function WeatherPopup({
  visible,
  showWeatherPopup,
  hideWeatherPopup,
}: {
  visible: ReturnType<typeof createComputed<boolean>>
  showWeatherPopup: () => void
  hideWeatherPopup: () => void
}) {
  const attachHover = (self: Gtk.Widget) => {
    const motion = new Gtk.EventControllerMotion()
    motion.connect("enter", showWeatherPopup)
    motion.connect("leave", hideWeatherPopup)
    self.add_controller(motion)
  }

  return (
    <window
      visible={visible}
      name="astal-niri-dock-weather"
      namespace="astal-niri-dock-weather"
      class="WeatherPopupWindow"
      layer={Astal.Layer.OVERLAY}
      exclusivity={Astal.Exclusivity.IGNORE}
      keymode={Astal.Keymode.NONE}
      anchor={Astal.WindowAnchor.BOTTOM}
      defaultWidth={660}
      defaultHeight={460}
      marginBottom={92}
    >
      <box class="WeatherPopupContainer" halign={Gtk.Align.CENTER} valign={Gtk.Align.END}>
        <box class="WeatherPanel" $={attachHover}>
          <box class="WeatherTodayPane" orientation={Gtk.Orientation.VERTICAL}>
            <box class="WeatherHeroIconWrap">
              <image class="WeatherHeroIcon" iconName={weather.iconName} pixelSize={82} />
            </box>
            <label class="WeatherLocation" label={`${weather.location}  ${weather.currentLabel}`} />
            <box class="WeatherNowLine">
              <label class="WeatherNowTemp" label={weather.temperature} />
              <label class="WeatherNowUnit" label={`/ ${weather.unit}`} valign={Gtk.Align.END} />
            </box>
            <box class="WeatherTodayFooter">
              <box orientation={Gtk.Orientation.VERTICAL}>
                <label class="WeatherRangeLabel" label={weatherRangeLabel(weather)} xalign={0} />
              </box>
              <label class="WeatherTodayCondition" label={weather.condition} />
            </box>
          </box>
          <box class="WeatherForecastPane" orientation={Gtk.Orientation.VERTICAL}>
            <box class="WeatherForecastPane" orientation={Gtk.Orientation.VERTICAL}>
              {weather.forecast.map((item) => <WeatherForecastRow item={item} />)}
            </box>
          </box>
        </box>
      </box>
    </window>
  )
}

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
      layer={Astal.Layer.OVERLAY}
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

function Dock({
  showDock,
  setDockHovered,
  statusMode,
  toggleStatus,
  showWeatherPopup,
  hideWeatherPopup,
}: {
  showDock: ReturnType<typeof createComputed<boolean>>
  setDockHovered: (value: boolean) => void
  statusMode: ReturnType<typeof createComputed<StatusMode>>
  toggleStatus: () => void
  showWeatherPopup: () => void
  hideWeatherPopup: () => void
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
        class={createComputed((get) => `DockBarContainer${get(showDock) ? "" : " slide-out"}`)}
        halign={Gtk.Align.CENTER}
        valign={Gtk.Align.END}
        $={attachHover}
      >
        <box class="DockBar">
          {showStatusSlot ? (
            <StatusDockItem
              mode={statusMode}
              status={status}
              weather={weather}
              toggleStatus={toggleStatus}
              showWeatherPopup={showWeatherPopup}
              hideWeatherPopup={hideWeatherPopup}
            />
          ) : null}
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
      class={createComputed((get) => `DockBarContainer${get(showDock) ? "" : " slide-out"}`)}
      halign={Gtk.Align.CENTER}
      valign={Gtk.Align.END}
      $={attachHover}
    >
      <box class="DockBar">
        {showStatusSlot ? (
          <StatusDockItem
            mode={statusMode}
            status={status}
            weather={weather}
            toggleStatus={toggleStatus}
            showWeatherPopup={showWeatherPopup}
            hideWeatherPopup={hideWeatherPopup}
          />
        ) : null}
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
    const initialStatusMode = normalizeStatusMode(status.initial)
    const [statusMode, setStatusMode] = createState<StatusMode>(initialStatusMode)
    const [weatherPopupVisible, setWeatherPopupVisible] = createState(false)
    const [niriRefresh, setNiriRefresh] = createState(0)
    const showDock = createComputed([dockTrigger, dockHovered], (trigger, hovered) => trigger || hovered)
    const currentStatusMode = createComputed([statusMode], (mode) => mode)
    const showWeatherPopup = createComputed(
      [weatherPopupVisible, statusMode],
      (popupVisible, mode) => weather.enabled && mode === "weather" && popupVisible,
    )
    let weatherPopupHideTimer: number | null = null
    let activeStatusMode = initialStatusMode

    const showWeatherPopupNow = () => {
      if (!weather.enabled) return
      if (weatherPopupHideTimer) {
        clearTimeout(weatherPopupHideTimer)
        weatherPopupHideTimer = null
      }
      setWeatherPopupVisible(true)
    }

    const hideWeatherPopupNow = () => {
      if (weatherPopupHideTimer) {
        clearTimeout(weatherPopupHideTimer)
        weatherPopupHideTimer = null
      }
      setWeatherPopupVisible(false)
    }

    const hideWeatherPopupSoon = () => {
      if (weatherPopupHideTimer) clearTimeout(weatherPopupHideTimer)
      weatherPopupHideTimer = setTimeout(() => {
        setWeatherPopupVisible(false)
        weatherPopupHideTimer = null
      }, WEATHER_POPUP_HIDE_TIMEOUT)
    }

    const toggleStatus = () => {
      const nextMode = nextStatusMode(activeStatusMode)
      activeStatusMode = nextMode
      setStatusMode(nextMode)

      if (nextMode === "weather") {
        showWeatherPopupNow()
      } else {
        hideWeatherPopupNow()
      }
    }

    const showWeatherPopupForStatus = () => {
      if (activeStatusMode === "weather") showWeatherPopupNow()
    }

    const hideWeatherPopupForStatus = () => {
      if (activeStatusMode === "weather") hideWeatherPopupSoon()
    }

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
        <Dock
          showDock={showDock}
          setDockHovered={setDockHovered}
          statusMode={currentStatusMode}
          toggleStatus={toggleStatus}
          showWeatherPopup={showWeatherPopupForStatus}
          hideWeatherPopup={hideWeatherPopupForStatus}
        />
      </window>,
      <WeatherPopup visible={showWeatherPopup} showWeatherPopup={showWeatherPopupNow} hideWeatherPopup={hideWeatherPopupSoon} />,
      <EdgeSensor setDockTrigger={setDockTrigger} />,
    ]
  },
})
