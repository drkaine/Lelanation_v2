/** Côté de la carte (team_id 100 = bleu, 200 = rouge). */
export type TeamMiscSide = 'BLUE' | 'RED'

/** Réponse de GET /api/stats/overview-team-misc. */
export interface TeamMiscAfkRow {
  role: string
  tier: string
  side: TeamMiscSide
  games: number
  afk: number
}
export interface TeamMiscDuoRow {
  roleA: string
  roleB: string
  tier: string
  side: TeamMiscSide
  games: number
  wins: number
}
export interface TeamMiscData {
  afk: TeamMiscAfkRow[]
  duos: TeamMiscDuoRow[]
}

export interface AfkCounts {
  games: number
  afk: number
  rate: number
}
export interface AfkRoleLine extends AfkCounts {
  role: string
  blue: AfkCounts
  red: AfkCounts
}
export interface DuoCounts {
  games: number
  wins: number
  winrate: number
}
export interface DuoPairLine extends DuoCounts {
  roleA: string
  roleB: string
  share: number
  blue: DuoCounts
  red: DuoCounts
}

const ROLE_ORDER = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']

function pct(part: number, total: number): number {
  return total > 0 ? (part / total) * 100 : 0
}

/** Rangs du panneau filtres ; vide = tous. */
function inTiers(tiers: readonly string[], tier: string): boolean {
  return tiers.length === 0 || tiers.includes(tier)
}

function afkCounts(games: number, afk: number): AfkCounts {
  return { games, afk, rate: pct(afk, games) }
}

function duoCounts(games: number, wins: number): DuoCounts {
  return { games, wins, winrate: pct(wins, games) }
}

/** Taux d'AFK par rôle, total et par côté. */
export function afkByRole(
  rows: readonly TeamMiscAfkRow[],
  tiers: readonly string[]
): AfkRoleLine[] {
  const byRole = new Map<string, Record<TeamMiscSide, { games: number; afk: number }>>()
  for (const r of rows) {
    if (!inTiers(tiers, r.tier)) continue
    const acc = byRole.get(r.role) ?? { BLUE: { games: 0, afk: 0 }, RED: { games: 0, afk: 0 } }
    acc[r.side].games += r.games
    acc[r.side].afk += r.afk
    byRole.set(r.role, acc)
  }
  return ROLE_ORDER.flatMap(role => {
    const acc = byRole.get(role)
    if (!acc) return []
    const games = acc.BLUE.games + acc.RED.games
    if (games === 0) return []
    return [
      {
        role,
        ...afkCounts(games, acc.BLUE.afk + acc.RED.afk),
        blue: afkCounts(acc.BLUE.games, acc.BLUE.afk),
        red: afkCounts(acc.RED.games, acc.RED.afk),
      },
    ]
  })
}

/** Duos par paire de rôles, total et par côté, plus joués d'abord. */
export function duosByRolePair(
  rows: readonly TeamMiscDuoRow[],
  tiers: readonly string[]
): DuoPairLine[] {
  const byPair = new Map<
    string,
    { roleA: string; roleB: string; sides: Record<TeamMiscSide, { games: number; wins: number }> }
  >()
  for (const r of rows) {
    if (!inTiers(tiers, r.tier)) continue
    const key = `${r.roleA}|${r.roleB}`
    const acc = byPair.get(key) ?? {
      roleA: r.roleA,
      roleB: r.roleB,
      sides: { BLUE: { games: 0, wins: 0 }, RED: { games: 0, wins: 0 } },
    }
    acc.sides[r.side].games += r.games
    acc.sides[r.side].wins += r.wins
    byPair.set(key, acc)
  }
  const lines = [...byPair.values()].map(({ roleA, roleB, sides }) => ({
    roleA,
    roleB,
    ...duoCounts(sides.BLUE.games + sides.RED.games, sides.BLUE.wins + sides.RED.wins),
    blue: duoCounts(sides.BLUE.games, sides.BLUE.wins),
    red: duoCounts(sides.RED.games, sides.RED.wins),
  }))
  const kept = lines.filter(l => l.games > 0)
  const total = kept.reduce((s, l) => s + l.games, 0)
  return kept
    .map(({ roleA, roleB, games, wins, winrate, blue, red }) => ({
      roleA,
      roleB,
      games,
      wins,
      winrate,
      share: pct(games, total),
      blue,
      red,
    }))
    .sort((a, b) => b.games - a.games)
}
