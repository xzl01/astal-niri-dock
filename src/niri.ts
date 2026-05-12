import GLib from "gi://GLib?version=2.0"
import Niri from "gi://AstalNiri?version=0.1"

export type NiriWindow = Niri.Window
type DynamicWindow = NiriWindow & Record<string, unknown>
type NiriWindowJson = {
  id?: number
  app_id?: string
  pid?: number
}

let windowJsonCache: NiriWindowJson[] = []
let windowJsonCacheTime = 0

function basename(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? ""
}

function processNameForPid(pid: unknown): string {
  const numericPid = Number(pid)
  if (!Number.isFinite(numericPid) || numericPid <= 0) return ""

  try {
    const exe = GLib.file_read_link(`/proc/${numericPid}/exe`)
    const name = basename(exe)
    if (name) return name
  } catch (_) {
    // Fall through to cmdline below.
  }

  try {
    const [, contents] = GLib.file_get_contents(`/proc/${numericPid}/cmdline`)
    const command = new TextDecoder().decode(contents).split("\0")[0] ?? ""
    return basename(command)
  } catch (_) {
    return ""
  }
}

function niriWindowJsonForId(id: unknown): NiriWindowJson | null {
  const numericId = Number(id)
  if (!Number.isFinite(numericId)) return null

  const now = Date.now()
  if (now - windowJsonCacheTime > 500) {
    try {
      const [, stdout] = GLib.spawn_command_line_sync("niri msg -j windows")
      const text = new TextDecoder().decode(stdout)
      const parsed = JSON.parse(text)
      windowJsonCache = Array.isArray(parsed) ? parsed : []
      windowJsonCacheTime = now
    } catch (error) {
      printerr(`astal-niri-dock: failed to query niri windows: ${error}`)
      windowJsonCache = []
      windowJsonCacheTime = now
    }
  }

  return windowJsonCache.find((window) => Number(window.id) === numericId) ?? null
}

export function getNiri(): Niri.Niri | null {
  try {
    return Niri.get_default()
  } catch (error) {
    printerr(`astal-niri-dock: AstalNiri unavailable: ${error}`)
    return null
  }
}

export function windowAppId(window: NiriWindow): string {
  const dynamic = window as DynamicWindow
  const appId = dynamic.appId ?? dynamic.app_id ?? ""
  if (typeof appId === "string" && appId.length > 0) return appId

  const wmClass = dynamic.wmClass ?? dynamic.wm_class ?? ""
  if (typeof wmClass === "string" && wmClass.length > 0) return wmClass

  const processName = processNameForPid(dynamic.pid)
  if (processName.length > 0) return processName

  const niriWindow = niriWindowJsonForId(window.id)
  if (niriWindow?.app_id) return niriWindow.app_id

  return typeof appId === "string" ? appId : String(appId)
}

export function windowTitle(window: NiriWindow): string {
  return window.title ?? ""
}

export function windowIsFocused(window: NiriWindow): boolean {
  const dynamic = window as DynamicWindow
  return Boolean(dynamic.isFocused ?? dynamic.is_focused ?? false)
}

export function windowIsUrgent(window: NiriWindow): boolean {
  const dynamic = window as DynamicWindow
  return Boolean(dynamic.isUrgent ?? dynamic.is_urgent ?? false)
}

export function focusWindow(window: NiriWindow): void {
  const id = Number(window.id)
  if (!Number.isFinite(id)) return

  const dynamic = window as DynamicWindow
  const focus = dynamic.focus
  if (typeof focus === "function") {
    const ok = focus.call(window, id)
    if (ok !== false) return
  }

  const module = Niri as unknown as { msg?: { focus_window?: (id: number) => boolean } }
  if (typeof module.msg?.focus_window === "function") {
    const ok = module.msg.focus_window(id)
    if (ok !== false) return
  }

  GLib.spawn_command_line_async(`niri msg action focus-window --id ${id}`)
}
