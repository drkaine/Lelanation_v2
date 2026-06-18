export const CHAMPION_ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'SUPPORT'] as const

export type ChampionRoleKey = (typeof CHAMPION_ROLE_ORDER)[number]

export type ChampionByRoleRow = {
  role: string
  games: number
  winrate: number
  pickrate: number
}

export type ChampionByRoleMap = Record<
  string,
  { games?: number; wins?: number; winrate?: number; pickrate?: number }
>

/** Alias API / DB → clé UI. L'ordre dans chaque liste = priorité (évite le double comptage MID+MIDDLE). */
const ROLE_KEY_ALIASES: Record<ChampionRoleKey, readonly string[]> = {
  TOP: ['TOP', 'TOPLANE'],
  JUNGLE: ['JUNGLE', 'JGL'],
  MIDDLE: ['MIDDLE', 'MID', 'MIDLANE'],
  BOTTOM: ['BOTTOM', 'ADC', 'BOT'],
  SUPPORT: ['SUPPORT', 'UTILITY'],
}

export function canonicalChampionRoleKey(role: string): ChampionRoleKey | null {
  const u = String(role ?? '')
    .trim()
    .toUpperCase()
  switch (u) {
    case 'TOP':
    case 'TOPLANE':
      return 'TOP'
    case 'JUNGLE':
    case 'JGL':
      return 'JUNGLE'
    case 'MIDDLE':
    case 'MID':
    case 'MIDLANE':
      return 'MIDDLE'
    case 'BOTTOM':
    case 'ADC':
    case 'BOT':
      return 'BOTTOM'
    case 'SUPPORT':
    case 'UTILITY':
      return 'SUPPORT'
    default:
      return null
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, value))
}

function pickRoleEntry(
  byRole: ChampionByRoleMap,
  canonical: ChampionRoleKey
): { games: number; wins: number } | null {
  for (const alias of ROLE_KEY_ALIASES[canonical]) {
    const data = byRole[alias]
    const games = Number(data?.games ?? 0)
    if (games > 0) {
      return { games, wins: Number(data?.wins ?? 0) }
    }
  }
  for (const [key, data] of Object.entries(byRole)) {
    if (canonicalChampionRoleKey(key) !== canonical) continue
    const games = Number(data?.games ?? 0)
    if (games > 0) {
      return { games, wins: Number(data?.wins ?? 0) }
    }
  }
  return null
}

function normalizeChampionByRoleMap(byRole: ChampionByRoleMap): ChampionByRoleMap {
  const merged: ChampionByRoleMap = {}
  for (const canonical of CHAMPION_ROLE_ORDER) {
    const picked = pickRoleEntry(byRole, canonical)
    if (!picked || picked.games <= 0) continue
    merged[canonical] = {
      games: picked.games,
      wins: picked.wins,
      winrate: clampPercent((picked.wins / picked.games) * 100),
    }
  }
  return merged
}

export function buildChampionRoleDistribution(
  byRole: ChampionByRoleMap | null | undefined
): ChampionByRoleRow[] {
  const safe = normalizeChampionByRoleMap(byRole && typeof byRole === 'object' ? byRole : {})
  const totalAll = Object.values(safe).reduce((sum, row) => sum + (row?.games ?? 0), 0)
  return CHAMPION_ROLE_ORDER.map(role => {
    const data = safe[role]
    const games = data?.games ?? 0
    const wins = data?.wins ?? 0
    return {
      role,
      games,
      winrate: games > 0 ? clampPercent((wins / games) * 100) : 0,
      pickrate: totalAll > 0 ? clampPercent((100 * games) / totalAll) : 0,
    }
  })
}

export function championRoleDistributionSorted(
  byRole: ChampionByRoleMap | null | undefined,
  options?: { minGames?: number }
): ChampionByRoleRow[] {
  const minGames = options?.minGames ?? 0
  return buildChampionRoleDistribution(byRole)
    .filter(row => row.games >= minGames)
    .sort((a, b) => b.games - a.games)
}

export type ChampionRoleSummaryRow = {
  role: ChampionRoleKey
  games: number
  winrate: number
  pickrate: number
  banrate: number
}

function pickRoleEntryWithPickrate(
  byRole: ChampionByRoleMap,
  canonical: ChampionRoleKey
): { games: number; wins: number; winrate?: number; pickrate?: number } | null {
  for (const alias of ROLE_KEY_ALIASES[canonical]) {
    const data = byRole[alias]
    const games = Number(data?.games ?? 0)
    if (games > 0) {
      return {
        games,
        wins: Number(data?.wins ?? 0),
        winrate: data?.winrate != null ? Number(data.winrate) : undefined,
        pickrate: data?.pickrate != null ? Number(data.pickrate) : undefined,
      }
    }
  }
  for (const [key, data] of Object.entries(byRole)) {
    if (canonicalChampionRoleKey(key) !== canonical) continue
    const games = Number(data?.games ?? 0)
    if (games > 0) {
      return {
        games,
        wins: Number(data?.wins ?? 0),
        winrate: data?.winrate != null ? Number(data.winrate) : undefined,
        pickrate: data?.pickrate != null ? Number(data.pickrate) : undefined,
      }
    }
  }
  return null
}

/** Stats par rôle (TOP…SUPPORT) avec pickrate cohorte API, pour badges / filtres. */
export function buildChampionRoleSummaryRows(
  byRole: ChampionByRoleMap | null | undefined,
  globalBanrate = 0
): ChampionRoleSummaryRow[] {
  const safe = byRole && typeof byRole === 'object' ? byRole : {}
  return CHAMPION_ROLE_ORDER.map(role => {
    const picked = pickRoleEntryWithPickrate(safe, role)
    const games = picked?.games ?? 0
    const wins = picked?.wins ?? 0
    const winrate =
      picked?.winrate != null && Number.isFinite(picked.winrate)
        ? clampPercent(picked.winrate)
        : games > 0
          ? clampPercent((wins / games) * 100)
          : 0
    const pickrate =
      picked?.pickrate != null && Number.isFinite(picked.pickrate)
        ? clampPercent(picked.pickrate)
        : 0
    return {
      role,
      games,
      winrate,
      pickrate,
      banrate: clampPercent(globalBanrate),
    }
  })
}

export function formatChampionRolePercent(value: number): string {
  return Number.isFinite(value) ? clampPercent(value).toFixed(2) : '0'
}
