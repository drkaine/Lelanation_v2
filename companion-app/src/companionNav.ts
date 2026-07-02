export type CompanionNavSubItem = {
  id: string
  path: string
  labelKey: string
}

export type CompanionNavMenu = {
  type: "menu"
  id: "builds" | "guides" | "statistics"
  labelKey: string
  items: CompanionNavSubItem[]
}

export type CompanionNavLink = {
  type: "link"
  id: "videos" | "patch-notes"
  labelKey: string
  path: string
}

export type CompanionNavEntry = CompanionNavMenu | CompanionNavLink

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
        { id: "favoris", path: `${prefix}/builds/favoris`, labelKey: "buildsPage.myFavorites" },
      ],
    },
    {
      type: "menu",
      id: "guides",
      labelKey: "nav.guides",
      items: [
        {
          id: "create",
          path: `${prefix}/matchups/sheets/create`,
          labelKey: "matchupGuidePage.createGuide",
        },
        {
          id: "discover",
          path: `${prefix}/matchups/sheets/discover`,
          labelKey: "buildsPage.discover",
        },
        {
          id: "my-guides",
          path: `${prefix}/matchups/sheets/my-guides`,
          labelKey: "matchupGuidePage.myGuides",
        },
        {
          id: "favoris",
          path: `${prefix}/matchups/sheets/favoris`,
          labelKey: "buildsPage.myFavorites",
        },
      ],
    },
    {
      type: "menu",
      id: "statistics",
      labelKey: "nav.statistics",
      items: [
        {
          id: "tier-list",
          path: `${prefix}/statistics/tier-list`,
          labelKey: "nav.tierList",
        },
        {
          id: "overview",
          path: `${prefix}/statistics`,
          labelKey: "nav.statisticsGeneral",
        },
        {
          id: "champions",
          path: `${prefix}/statistics/champion`,
          labelKey: "nav.statisticsChampions",
        },
        {
          id: "surveillance",
          path: `${prefix}/statistics/surveillance`,
          labelKey: "nav.statisticsSurveillance",
        },
      ],
    },
    {
      type: "link",
      id: "videos",
      labelKey: "nav.videos",
      path: `${prefix}/videos`,
    },
    {
      type: "link",
      id: "patch-notes",
      labelKey: "nav.patchNotes",
      path: `${prefix}/patch-notes`,
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
    case "guides":
      return path.includes("/matchups/sheets")
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
    case "videos":
      return path.includes("/videos")
    case "patch-notes":
      return path.includes("/patch-notes")
    default:
      return false
  }
}
