/**
 * Guides matchups du Google Sheet : parsing partagé avec le backend (vérification des liens),
 * dans @lelanation/shared-types.
 */
import type { SheetMatchupGuide, SheetMatchupGuidesByChampion } from '@lelanation/shared-types'
import { CHAMPION_GUIDE_ROLES, type ChampionGuideRole } from './championGuideVideos'

export {
  allMatchupGuideUrls,
  MATCHUP_GUIDES_SHEET_TABS,
  matchupGuidesSheetUrl,
  mergeMatchupGuideTabs,
  parseMatchupGuidesSheet,
  withoutDeadMatchupGuides,
} from '@lelanation/shared-types'

export type MatchupGuide = SheetMatchupGuide
export type MatchupGuidesByChampion = SheetMatchupGuidesByChampion

function championKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
}

/** Guides matchups d'un champion (nom ou id Riot), sans casse, accents ni ponctuation. */
export function matchupGuidesForChampion(
  data: MatchupGuidesByChampion,
  champion: string
): MatchupGuide[] {
  const key = championKey(champion)
  const name = Object.keys(data).find(n => championKey(n) === key)
  return name ? (data[name] ?? []) : []
}

/** Nombre de guides matchups par nom de champion du jeu (absents = 0, non listés). */
export function matchupGuideCounts(
  data: MatchupGuidesByChampion,
  championNames: string[]
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const name of championNames) {
    const count = matchupGuidesForChampion(data, name).length
    if (count > 0) out[name] = count
  }
  return out
}

/** Rôles (onglet du sheet) des guides matchups de chaque champion du jeu, dans l'ordre des rôles. */
export function matchupGuideRoles(
  data: MatchupGuidesByChampion,
  championNames: string[]
): Record<string, ChampionGuideRole[]> {
  const out: Record<string, ChampionGuideRole[]> = {}
  for (const name of championNames) {
    const roles = new Set(matchupGuidesForChampion(data, name).map(g => g.role))
    const ordered = CHAMPION_GUIDE_ROLES.filter(r => roles.has(r))
    if (ordered.length > 0) out[name] = ordered
  }
  return out
}

/** Rôles vidéos + rôles des guides matchups : le filtre par rôle couvre les deux sources. */
export function championRolesWithMatchupGuides(
  videoRoles: Record<string, readonly ChampionGuideRole[]>,
  matchupRoles: Record<string, readonly ChampionGuideRole[]>
): Record<string, ChampionGuideRole[]> {
  const out: Record<string, ChampionGuideRole[]> = {}
  for (const name of new Set([...Object.keys(videoRoles), ...Object.keys(matchupRoles)])) {
    const roles = new Set([...(videoRoles[name] ?? []), ...(matchupRoles[name] ?? [])])
    out[name] = CHAMPION_GUIDE_ROLES.filter(r => roles.has(r))
  }
  return out
}

export type ChampionGuidesTab = 'videos' | 'matchups'

/** Onglet ouvert par défaut dans la modale : les vidéos, sauf s'il n'y a que des guides matchups. */
export function defaultChampionGuidesTab(
  videoCount: number,
  matchupCount: number
): ChampionGuidesTab {
  return videoCount === 0 && matchupCount > 0 ? 'matchups' : 'videos'
}
