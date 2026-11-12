export type CompanionNavSubItem = {
  id: string
  path: string
  labelKey: string
}

export type CompanionNavMenu = {
  type: "menu"
  id: "builds" | "statistics" | "learn"
  labelKey: string
  items: CompanionNavSubItem[]
}

export type CompanionNavLink = {
  type: "link"
  id: "patch-notes"
  labelKey: string
  path: string
}

export type CompanionNavNativeLink = {
  type: "native"
  id: "progression"
  labelKey: string
}

export type CompanionNavEntry = CompanionNavMenu | CompanionNavLink | CompanionNavNativeLink

export function localePrefix(language: "fr" | "en"): string {
  return language === "en" ? "/en" : ""
}

export function buildCompanionNav(language: "fr" | "en"): CompanionNavEntry[] {
  const prefix = localePrefix(language)

  return [
    {
      type: "menu",
      id: "builds",
      labelKey: "nav.builds",
      items: [
        { id: "create", path: `${prefix}/builds/create`, labelKey: "buildsPage.createBuild" },
        { id: "discover", path: `${prefix}/builds/discover`, labelKey: "buildsPage.discover" },
        { id: "my-builds", path: `${prefix}/builds/my-builds`, labelKey: "buildsPage.myBuilds" },
        { id: "team", path: `${prefix}/builds/team`, labelKey: "buildsPage.teamBuilds" },
        { id: "favoris", path: `${prefix}/builds/favoris`, labelKey: "buildsPage.myFavorites" },
      ],
    },
    {
      type: "menu",
      id: "statistics",
      labelKey: "nav.statistics",
      items: [
        { id: "overview", path: `${prefix}/statistics`, labelKey: "nav.statisticsGeneral" },
        { id: "champions", path: `${prefix}/statistics/champion`, labelKey: "nav.statisticsChampions" },
        {
          id: "surveillance",
          path: `${prefix}/statistics/surveillance`,
          labelKey: "nav.statisticsSurveillance",
        },
      ],
    },
    {
      type: "menu",
      id: "learn",
      labelKey: "nav.learn",
      items: [
        { id: "items", path: `${prefix}/items`, labelKey: "nav.itemShop" },
        { id: "videos", path: `${prefix}/videos`, labelKey: "nav.videos" },
        { id: "guides", path: `${prefix}/guides/champion`, labelKey: "nav.championGuides" },
      ],
    },
    {
      type: "link",
      id: "patch-notes",
      labelKey: "nav.patchSummary",
      path: `${prefix}/patch-notes`,
    },
    {
      type: "native",
      id: "progression",
      labelKey: "progression.recap.title",
    },
  ]
}

export function normalizeCompanionPath(path: string): string {
  const trimmed = path.trim() || "/"
  const withoutQuery = trimmed.split("?")[0] ?? trimmed
  const normalized = withoutQuery.replace(/\/+$/, "") || "/"
  return normalized
}

export function isCompanionMenuActive(menuId: CompanionNavMenu["id"], iframePath: string): boolean {
  const path = normalizeCompanionPath(iframePath)
  switch (menuId) {
    case "builds":
      return path.includes("/builds")
    case "learn":
      return /^(?:\/en)?\/(items|videos|guides)(?:\/|$)/.test(path)
    case "statistics":
      return path.includes("/statistics")
    default:
      return false
  }
}

export function isCompanionSubItemActive(itemPath: string, iframePath: string): boolean {
  const current = normalizeCompanionPath(iframePath)
  const target = normalizeCompanionPath(itemPath)

  if (target.endsWith("/statistics")) {
    return (
      current === target ||
      (current.startsWith(`${target}/`) &&
        !current.includes("/tier-list") &&
        !current.includes("/surveillance") &&
        !current.includes("/champion"))
    )
  }

  return current === target
}

export function isCompanionLinkActive(linkId: CompanionNavLink["id"], iframePath: string): boolean {
  const path = normalizeCompanionPath(iframePath)
  switch (linkId) {
    case "patch-notes":
      return path.includes("/patch-notes")
    default:
      return false
  }
}
