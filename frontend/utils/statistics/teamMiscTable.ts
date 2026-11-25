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
export const DUO_OBJECTIVES = ['dragons', 'barons', 'towers', 'grubs', 'heralds'] as const
export type DuoObjective = (typeof DUO_OBJECTIVES)[number]
/** Objectifs de l'équipe du duo (own) et de l'adverse (enemy). */
export interface DuoObjectiveCount {
  own: number
  enemy: number
}
export type DuoObjectives = Record<DuoObjective, DuoObjectiveCount>
export interface TeamMiscDuoRow {
  roleA: string
  roleB: string
  tier: string
  side: TeamMiscSide
  games: number
  wins: number
  surrenderFor: number
  surrenderAgainst: number
  afk: number
  objectives: DuoObjectives
}
export interface TeamMiscDuoPickRow {
  roleA: string
  roleB: string
  tier: string
  role: string
  championId: number
  games: number
  wins: number
}
export interface TeamMiscDuoBanRow {
  roleA: string
  roleB: string
  tier: string
  championId: number
  bans: number
}
export interface TeamMiscData {
  afk: TeamMiscAfkRow[]
  duos: TeamMiscDuoRow[]
  duoPicks?: TeamMiscDuoPickRow[]
  duoBans?: TeamMiscDuoBanRow[]
}
export interface DuoPickLine {
  championId: number
  games: number
  winrate: number
}
export interface DuoBanLine {
  championId: number
  bans: number
  rate: number
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
  surrenderForRate: number
  surrenderAgainstRate: number
  afkRate: number
  /** Moyenne par partie. */
  objectives: DuoObjectives
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

function emptyObjectives(): DuoObjectives {
  return {
    dragons: { own: 0, enemy: 0 },
    barons: { own: 0, enemy: 0 },
    towers: { own: 0, enemy: 0 },
    grubs: { own: 0, enemy: 0 },
    heralds: { own: 0, enemy: 0 },
  }
}

export function duoPairKey(roleA: string, roleB: string): string {
  return `${roleA}|${roleB}`
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

interface DuoPairAcc {
  roleA: string
  roleB: string
  sides: Record<TeamMiscSide, { games: number; wins: number }>
  surrenderFor: number
  surrenderAgainst: number
  afk: number
  objectives: DuoObjectives
}

/** Duos par paire de rôles, total et par côté, plus joués d'abord. */
export function duosByRolePair(
  rows: readonly TeamMiscDuoRow[],
  tiers: readonly string[]
): DuoPairLine[] {
  const byPair = new Map<string, DuoPairAcc>()
  for (const r of rows) {
    if (!inTiers(tiers, r.tier)) continue
    const key = duoPairKey(r.roleA, r.roleB)
    const acc = byPair.get(key) ?? {
      roleA: r.roleA,
      roleB: r.roleB,
      sides: { BLUE: { games: 0, wins: 0 }, RED: { games: 0, wins: 0 } },
      surrenderFor: 0,
      surrenderAgainst: 0,
      afk: 0,
      objectives: emptyObjectives(),
    }
    acc.sides[r.side].games += r.games
    acc.sides[r.side].wins += r.wins
    acc.surrenderFor += r.surrenderFor
    acc.surrenderAgainst += r.surrenderAgainst
    acc.afk += r.afk
    for (const o of DUO_OBJECTIVES) {
      acc.objectives[o].own += r.objectives[o].own
      acc.objectives[o].enemy += r.objectives[o].enemy
    }
    byPair.set(key, acc)
  }
  const kept = [...byPair.values()]
    .map(acc => ({ acc, games: acc.sides.BLUE.games + acc.sides.RED.games }))
    .filter(x => x.games > 0)
  const total = kept.reduce((s, x) => s + x.games, 0)
  return kept
    .map(({ acc, games }) => {
      const objectives = emptyObjectives()
      for (const o of DUO_OBJECTIVES) {
        objectives[o].own = acc.objectives[o].own / games
        objectives[o].enemy = acc.objectives[o].enemy / games
      }
      return {
        roleA: acc.roleA,
        roleB: acc.roleB,
        ...duoCounts(games, acc.sides.BLUE.wins + acc.sides.RED.wins),
        share: pct(games, total),
        blue: duoCounts(acc.sides.BLUE.games, acc.sides.BLUE.wins),
        red: duoCounts(acc.sides.RED.games, acc.sides.RED.wins),
        surrenderForRate: pct(acc.surrenderFor, games),
        surrenderAgainstRate: pct(acc.surrenderAgainst, games),
        afkRate: pct(acc.afk, games),
        objectives,
      }
    })
    .sort((a, b) => b.games - a.games)
}

/** Champions les plus joués par rôle, pour chaque paire (clé `roleA|roleB`). */
export function duoPicksByPair(
  rows: readonly TeamMiscDuoPickRow[],
  tiers: readonly string[],
  limit: number
): Map<string, Record<string, DuoPickLine[]>> {
  const acc = new Map<string, Map<string, Map<number, { games: number; wins: number }>>>()
  for (const r of rows) {
    if (!inTiers(tiers, r.tier)) continue
    const key = duoPairKey(r.roleA, r.roleB)
    const byRole = acc.get(key) ?? new Map<string, Map<number, { games: number; wins: number }>>()
    const byChamp = byRole.get(r.role) ?? new Map<number, { games: number; wins: number }>()
    const c = byChamp.get(r.championId) ?? { games: 0, wins: 0 }
    c.games += r.games
    c.wins += r.wins
    byChamp.set(r.championId, c)
    byRole.set(r.role, byChamp)
    acc.set(key, byRole)
  }
  const out = new Map<string, Record<string, DuoPickLine[]>>()
  for (const [key, byRole] of acc) {
    const record: Record<string, DuoPickLine[]> = {}
    for (const [role, byChamp] of byRole) {
      record[role] = [...byChamp]
        .map(([championId, c]) => ({ championId, games: c.games, winrate: pct(c.wins, c.games) }))
        .sort((a, b) => b.games - a.games)
        .slice(0, limit)
    }
    out.set(key, record)
  }
  return out
}

/** Bans de l'équipe du duo par paire, taux = bans / parties de la paire. */
export function duoBansByPair(
  rows: readonly TeamMiscDuoBanRow[],
  tiers: readonly string[],
  gamesByPair: ReadonlyMap<string, number>,
  limit: number
): Map<string, DuoBanLine[]> {
  const acc = new Map<string, Map<number, number>>()
  for (const r of rows) {
    if (!inTiers(tiers, r.tier)) continue
    const key = duoPairKey(r.roleA, r.roleB)
    const byChamp = acc.get(key) ?? new Map<number, number>()
    byChamp.set(r.championId, (byChamp.get(r.championId) ?? 0) + r.bans)
    acc.set(key, byChamp)
  }
  const out = new Map<string, DuoBanLine[]>()
  for (const [key, byChamp] of acc) {
    const games = gamesByPair.get(key) ?? 0
    out.set(
      key,
      [...byChamp]
        .map(([championId, bans]) => ({ championId, bans, rate: pct(bans, games) }))
        .sort((a, b) => b.bans - a.bans)
        .slice(0, limit)
    )
  }
  return out
}
