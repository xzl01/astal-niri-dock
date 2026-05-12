import Gio from "gi://Gio"

export type DockConfig = {
  pinned: string[]
}

const defaultConfig: DockConfig = {
  pinned: [
    "firefox.desktop",
    "org.kde.dolphin.desktop",
    "code.desktop",
    "kitty.desktop",
  ],
}

export function loadConfig(): DockConfig {
  const path = "/home/xzl/Dev/astal-niri-dock/config.json"
  const file = Gio.File.new_for_path(path)

  try {
    const [, contents] = file.load_contents(null)
    const parsed = JSON.parse(new TextDecoder().decode(contents)) as Partial<DockConfig>

    return {
      ...defaultConfig,
      ...parsed,
      pinned: Array.isArray(parsed.pinned) ? parsed.pinned : defaultConfig.pinned,
    }
  } catch (error) {
    printerr(`astal-niri-dock: failed to read ${path}: ${error}`)
    return defaultConfig
  }
}
