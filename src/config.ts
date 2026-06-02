import Gio from "gi://Gio"
import GLib from "gi://GLib?version=2.0"

export type DockConfig = {
  pinned: string[]
  status: StatusConfig
  weather: WeatherConfig
}

export type StatusMode = "task" | "weather"

export type TaskStatusConfig = {
  enabled: boolean
  iconName: string
  title: string
  subtitle: string
  progress: number
}

export type StatusConfig = {
  enabled: boolean
  initial: StatusMode
  task: TaskStatusConfig
}

export type WeatherForecast = {
  day: string
  range: string
  iconName: string
  summary: string
}

export type WeatherConfig = {
  enabled: boolean
  location: string
  currentLabel: string
  temperature: string
  unit: string
  range: string
  condition: string
  iconName: string
  forecast: WeatherForecast[]
}

const defaultConfig: DockConfig = {
  pinned: [
    "firefox.desktop",
    "org.kde.dolphin.desktop",
    "code.desktop",
    "kitty.desktop",
  ],
  status: {
    enabled: true,
    initial: "task",
    task: {
      enabled: true,
      iconName: "utilities-terminal-symbolic",
      title: "3 / 5 条任务",
      subtitle: "codex",
      progress: 0.6,
    },
  },
  weather: {
    enabled: true,
    location: "Hong Kong",
    currentLabel: "今天",
    temperature: "30",
    unit: "摄氏度",
    range: "26-30°C",
    condition: "多云",
    iconName: "weather-few-clouds-symbolic",
    forecast: [
      { day: "星期二", range: "26-31°C", iconName: "weather-few-clouds-symbolic", summary: "多云" },
      { day: "星期三", range: "27-32°C", iconName: "weather-few-clouds-symbolic", summary: "多云" },
      { day: "星期四", range: "28-34°C", iconName: "weather-showers-scattered-symbolic", summary: "阵雨" },
      { day: "星期五", range: "28-35°C", iconName: "weather-showers-scattered-symbolic", summary: "阵雨" },
      { day: "星期六", range: "27-31°C", iconName: "weather-showers-scattered-symbolic", summary: "阵雨" },
      { day: "星期日", range: "26-29°C", iconName: "weather-few-clouds-symbolic", summary: "多云" },
      { day: "星期一", range: "26-29°C", iconName: "weather-few-clouds-symbolic", summary: "多云" },
    ],
  },
}

function clampProgress(value: unknown, fallback: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback
  return Math.max(0, Math.min(1, value))
}

function loadStatusMode(value: unknown): StatusMode {
  return value === "weather" ? "weather" : "task"
}

function loadStatusConfig(value: unknown): StatusConfig {
  if (!value || typeof value !== "object") return defaultConfig.status

  const status = value as Partial<StatusConfig>
  const task = status.task && typeof status.task === "object"
    ? status.task as Partial<TaskStatusConfig>
    : {}

  return {
    ...defaultConfig.status,
    ...status,
    enabled: typeof status.enabled === "boolean" ? status.enabled : defaultConfig.status.enabled,
    initial: loadStatusMode(status.initial),
    task: {
      ...defaultConfig.status.task,
      ...task,
      enabled: typeof task.enabled === "boolean" ? task.enabled : defaultConfig.status.task.enabled,
      progress: clampProgress(task.progress, defaultConfig.status.task.progress),
    },
  }
}

function loadWeatherConfig(value: unknown): WeatherConfig {
  if (!value || typeof value !== "object") return defaultConfig.weather

  const weather = value as Partial<WeatherConfig>
  const forecast = Array.isArray(weather.forecast)
    ? weather.forecast
      .filter((item): item is Partial<WeatherForecast> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        day: typeof item.day === "string" ? item.day : "",
        range: typeof item.range === "string" ? item.range : "",
        iconName: typeof item.iconName === "string" ? item.iconName : "weather-few-clouds-symbolic",
        summary: typeof item.summary === "string" ? item.summary : "",
      }))
      .filter((item) => item.day.length > 0 || item.range.length > 0)
    : defaultConfig.weather.forecast

  return {
    ...defaultConfig.weather,
    ...weather,
    enabled: typeof weather.enabled === "boolean" ? weather.enabled : defaultConfig.weather.enabled,
    forecast,
  }
}

export function loadConfig(): DockConfig {
  const path = `${GLib.get_home_dir()}/Dev/astal-niri-dock/config.json`
  const file = Gio.File.new_for_path(path)

  try {
    const [, contents] = file.load_contents(null)
    const parsed = JSON.parse(new TextDecoder().decode(contents)) as Partial<DockConfig>

    return {
      ...defaultConfig,
      ...parsed,
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : defaultConfig.pinned,
      status: loadStatusConfig(parsed.status),
      weather: loadWeatherConfig(parsed.weather),
    }
  } catch (error) {
    printerr(`astal-niri-dock: failed to read ${path}: ${error}`)
    return defaultConfig
  }
}
