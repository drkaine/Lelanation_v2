import { describe, expect, it } from "vitest"
import {
  buildCompanionNav,
  isCompanionLinkActive,
  isCompanionMenuActive,
  type CompanionNavMenu,
} from "./companionNav"

function menu(id: CompanionNavMenu["id"], language: "fr" | "en" = "fr"): CompanionNavMenu {
  const entry = buildCompanionNav(language).find((e) => e.type === "menu" && e.id === id)
  if (!entry || entry.type !== "menu") throw new Error(`menu ${id} absent`)
  return entry
}

describe("buildCompanionNav (alignée sur la nav du site)", () => {
  it("suit l'ordre du site : Builds, Statistiques, Apprendre, Résumé patch, puis natif", () => {
    expect(buildCompanionNav("fr").map((e) => e.id)).toEqual([
      "builds",
      "statistics",
      "learn",
      "patch-notes",
      "progression",
    ])
  })

  it("n'a plus de menu Guides de matchup", () => {
    const paths = JSON.stringify(buildCompanionNav("fr"))
    expect(paths).not.toContain("/matchups/sheets")
  })

  it("Builds contient les builds team", () => {
    expect(menu("builds").items.map((i) => i.path)).toEqual([
      "/builds/create",
      "/builds/discover",
      "/builds/my-builds",
      "/builds/team",
      "/builds/favoris",
    ])
  })

  it("Statistiques : général, champions, surveillance", () => {
    expect(menu("statistics").items.map((i) => i.path)).toEqual([
      "/statistics",
      "/statistics/champion",
      "/statistics/surveillance",
    ])
  })

  it("Apprendre : items, vidéos, guides champions (préfixe /en en anglais)", () => {
    const learn = menu("learn", "en")
    expect(learn.labelKey).toBe("nav.learn")
    expect(learn.items.map((i) => i.path)).toEqual([
      "/en/items",
      "/en/videos",
      "/en/guides/champion",
    ])
  })

  it("Apprendre est actif sur items, vidéos et guides", () => {
    expect(isCompanionMenuActive("learn", "/items")).toBe(true)
    expect(isCompanionMenuActive("learn", "/en/videos")).toBe(true)
    expect(isCompanionMenuActive("learn", "/guides/champion/ahri")).toBe(true)
    expect(isCompanionMenuActive("learn", "/builds/discover")).toBe(false)
  })

  it("le lien patch notes reste actif sur une version précise", () => {
    expect(isCompanionLinkActive("patch-notes", "/patch-notes/16.22")).toBe(true)
  })
})
