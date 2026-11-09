/** Maquette 22 « Aperçu » : priorité des compétences, rôles, profil moyen. */
import { formatCombatNumber } from './combatRolesSummary'

export type SkillKey = 'Q' | 'W' | 'E'
const SKILLS: readonly SkillKey[] = ['Q', 'W', 'E']

/** Niveaux 1-3 et ordre de montée au max (R exclu). */
export function skillPriority(order: readonly number[]): { first: SkillKey[]; max: SkillKey[] } {
  if (!order.length) return { first: [], max: [] }
  const first = order
    .slice(0, 3)
    .filter(s => s >= 1 && s <= 3)
    .map(s => SKILLS[s - 1]!)
  const points = [0, 0, 0]
  const maxedAt = [Infinity, Infinity, Infinity]
  order.forEach((s, lvl) => {
    if (s < 1 || s > 3) return
    points[s - 1]! += 1
    if (points[s - 1] === 5) maxedAt[s - 1] = lvl
  })
  const max = [0, 1, 2]
    .filter(i => points[i]! > 0)
    .sort((a, b) => maxedAt[a]! - maxedAt[b]! || points[b]! - points[a]! || a - b)
    .map(i => SKILLS[i]!)
  return { first, max }
}

export interface OverviewRoleRow {
  role: string
  games: number
  winrate: number
  pct: number
  lowSample: boolean
}

/** Table « Par rôle » : part des parties relative au total, peu fiable sous `minGames`. */
export function overviewRoleRows(
  roles: ReadonlyArray<{ role: string; games: number; winrate: number }>,
  minGames: number
): OverviewRoleRow[] {
  const total = roles.reduce((s, r) => s + r.games, 0)
  return [...roles]
    .sort((a, b) => b.games - a.games)
    .map(r => ({
      role: r.role,
      games: r.games,
      winrate: r.winrate,
      pct: total > 0 ? (100 * r.games) / total : 0,
      lowSample: r.games < minGames,
    }))
}

export interface ProfileColumn {
  id: 'combat' | 'survival' | 'visionEco'
  rows: Array<{ labelKey: string; value: string }>
}

const DASH = '—'
function n(v: unknown, digits: number): string {
  return typeof v === 'number' && Number.isFinite(v) ? formatCombatNumber(v, digits) : DASH
}

/** « Profil moyen par partie » : 3 colonnes de 3 lignes. */
export function profileColumns(m: Record<string, number | undefined>): ProfileColumn[] {
  const kda = [m.kills, m.deaths, m.assists].every(v => typeof v === 'number')
    ? `${n(m.kills, 1)} / ${n(m.deaths, 1)} / ${n(m.assists, 1)}`
    : DASH
  const k = (s: string) => `statisticsPage.ovProfile_${s}`
  return [
    {
      id: 'combat',
      rows: [
        { labelKey: k('kda3'), value: kda },
        { labelKey: k('kda'), value: n(m.kda, 2) },
        { labelKey: k('damage'), value: n(m.damage, 0) },
      ],
    },
    {
      id: 'survival',
      rows: [
        { labelKey: k('heal'), value: n(m.heal, 0) },
        { labelKey: k('tanked'), value: n(m.tanked, 0) },
        { labelKey: k('mitigated'), value: n(m.mitigated, 0) },
      ],
    },
    {
      id: 'visionEco',
      rows: [
        { labelKey: k('visionScore'), value: n(m.visionScore, 1) },
        { labelKey: k('wardsPlaced'), value: n(m.wardsPlaced, 1) },
        { labelKey: k('gold'), value: n(m.gold, 0) },
      ],
    },
  ]
}

/** Carte « Matchups & synergies » : `limit` meilleurs et pires adversaires, échantillon ≥ `minGames`. */
export function matchupExtremes<T extends { games: number; winrate: number }>(
  rows: readonly T[],
  minGames: number,
  limit: number
): { best: T[]; worst: T[] } {
  const ok = rows.filter(r => r.games >= minGames)
  return {
    best: [...ok].sort((a, b) => b.winrate - a.winrate).slice(0, limit),
    worst: [...ok].sort((a, b) => a.winrate - b.winrate).slice(0, limit),
  }
}
