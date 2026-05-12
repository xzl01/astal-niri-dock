import Apps from "gi://AstalApps?version=0.1"

export type AppInfo = {
  id: string
  name: string
  iconName: string
  wmClass: string
  executable: string
  candidates: string[]
  launch: () => void
}

const applications = new Apps.Apps({
  nameMultiplier: 2,
  entryMultiplier: 2,
  executableMultiplier: 2,
})

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.desktop$/, "")
    .replace(/[^a-z0-9._-]/g, "")
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function appIdForms(value: string): string[] {
  const normalized = normalize(value)

  return unique([
    normalized,
    normalize(`${normalized}.desktop`),
  ])
}

function appId(app: Apps.Application): string {
  return app.entry || app.wmClass || `${normalize(app.name)}.desktop`
}

function appCandidates(app: Apps.Application): string[] {
  return unique([
    app.entry,
    app.entry?.replace(/\.desktop$/, ""),
    app.wmClass,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap(appIdForms))
}

export function findApp(id: string): AppInfo {
  const wantedForms = appIdForms(id)
  const exact = applications.list.find((app) => {
    const candidates = appCandidates(app)

    return wantedForms.some((wanted) => candidates.includes(wanted))
  })

  const app = exact

  if (!app) {
    return {
      id,
      name: id.replace(/\.desktop$/, ""),
      iconName: "application-x-executable",
      wmClass: "",
      executable: "",
      candidates: [normalize(id)],
      launch: () => printerr(`astal-niri-dock: no desktop entry found for ${id}`),
    }
  }

  const candidates = appCandidates(app)

  return {
    id: appId(app),
    name: app.name || id,
    iconName: app.iconName || "application-x-executable",
    wmClass: app.wmClass || "",
    executable: app.executable || "",
    candidates,
    launch: () => app.launch(),
  }
}

export function matchAppId(app: AppInfo, appIdOrClass: string): boolean {
  const candidateForms = appIdForms(appIdOrClass)
  const candidates = app.candidates.length > 0 ? app.candidates : [normalize(app.id), normalize(app.name)]

  return candidates.some((value) => {
    if (!value) return false

    const valueForms = appIdForms(value)
    return valueForms.some((valueForm) => candidateForms.includes(valueForm))
  })
}
