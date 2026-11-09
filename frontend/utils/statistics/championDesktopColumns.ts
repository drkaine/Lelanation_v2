import type { ChampionColumnFlags, ChampionColumnGroup } from './championColumnGroups'
import type { ChampionGlobalSortColumn } from './statisticsTableFormat'

export type ChampionDesktopSort = Exclude<
  ChampionGlobalSortColumn,
  | `${string}Delta`
  | 'champion'
  | 'kills'
  | 'deaths'
  | 'assists'
  | 'totalGames'
  | `blue${string}`
  | `red${string}`
>

export type ChampionDesktopField =
  | 'avgTotalHeal'
  | 'avgHealsOnTeammates'
  | 'avgEffectiveHealShield'
  | 'avgDamageShieldedOnTeammates'
  | 'avgDamageSelfMitigated'
  | 'avgTimeCcDealt'
  | 'avgDamageToChamps'
  | 'avgDamageToChampsPhys'
  | 'avgDamageToChampsMagic'
  | 'avgDamageToChampsTrue'
  | 'avgDamageTakenTotal'
  | 'avgDamageTakenPhys'
  | 'avgDamageTakenMagic'
  | 'avgDamageTakenTrue'

export interface ChampionDesktopColumn {
  sort: ChampionDesktopSort
  sortDelta: `${ChampionDesktopSort}Delta`
  field: ChampionDesktopField
  labelKey: string
  group: ChampionColumnGroup
  /** Colonne de détail (visible si le groupe est déplié). */
  detail: boolean
  bar?: boolean
  invert?: boolean
}

const L = 'statisticsPage.championTableCol'

export const CHAMPION_DESKTOP_COLUMNS: ReadonlyArray<ChampionDesktopColumn> = [
  {
    sort: 'healTotal',
    sortDelta: 'healTotalDelta',
    field: 'avgTotalHeal',
    labelKey: `${L}TotalHeal`,
    group: 'heal',
    detail: false,
  },
  {
    sort: 'healTeam',
    sortDelta: 'healTeamDelta',
    field: 'avgHealsOnTeammates',
    labelKey: `${L}HealAllies`,
    group: 'heal',
    detail: true,
  },
  {
    sort: 'healEffective',
    sortDelta: 'healEffectiveDelta',
    field: 'avgEffectiveHealShield',
    labelKey: `${L}EffectiveHealShield`,
    group: 'heal',
    detail: true,
  },
  {
    sort: 'shieldTeam',
    sortDelta: 'shieldTeamDelta',
    field: 'avgDamageShieldedOnTeammates',
    labelKey: `${L}ShieldAllies`,
    group: 'heal',
    detail: true,
  },
  {
    sort: 'mitigated',
    sortDelta: 'mitigatedDelta',
    field: 'avgDamageSelfMitigated',
    labelKey: `${L}Mitigation`,
    group: 'heal',
    detail: false,
  },
  {
    sort: 'ccTime',
    sortDelta: 'ccTimeDelta',
    field: 'avgTimeCcDealt',
    labelKey: `${L}CcTime`,
    group: 'heal',
    detail: false,
  },
  {
    sort: 'dmgTotal',
    sortDelta: 'dmgTotalDelta',
    field: 'avgDamageToChamps',
    labelKey: `${L}TotalInflicted`,
    group: 'dealt',
    detail: false,
    bar: true,
  },
  {
    sort: 'dmgPhys',
    sortDelta: 'dmgPhysDelta',
    field: 'avgDamageToChampsPhys',
    labelKey: `${L}Phys`,
    group: 'dealt',
    detail: true,
  },
  {
    sort: 'dmgMagic',
    sortDelta: 'dmgMagicDelta',
    field: 'avgDamageToChampsMagic',
    labelKey: `${L}Magic`,
    group: 'dealt',
    detail: true,
  },
  {
    sort: 'dmgTrue',
    sortDelta: 'dmgTrueDelta',
    field: 'avgDamageToChampsTrue',
    labelKey: `${L}Brut`,
    group: 'dealt',
    detail: true,
  },
  {
    sort: 'takenTotal',
    sortDelta: 'takenTotalDelta',
    field: 'avgDamageTakenTotal',
    labelKey: `${L}TotalTaken`,
    group: 'taken',
    detail: false,
    invert: true,
  },
  {
    sort: 'takenPhys',
    sortDelta: 'takenPhysDelta',
    field: 'avgDamageTakenPhys',
    labelKey: `${L}Phys`,
    group: 'taken',
    detail: true,
    invert: true,
  },
  {
    sort: 'takenMagic',
    sortDelta: 'takenMagicDelta',
    field: 'avgDamageTakenMagic',
    labelKey: `${L}Magic`,
    group: 'taken',
    detail: true,
    invert: true,
  },
  {
    sort: 'takenTrue',
    sortDelta: 'takenTrueDelta',
    field: 'avgDamageTakenTrue',
    labelKey: `${L}Brut`,
    group: 'taken',
    detail: true,
    invert: true,
  },
]

/** Colonnes visibles du tableau desktop (maquette) selon groupes actifs et détails dépliés. */
export function championDesktopColumns(
  flags: ChampionColumnFlags,
  breakdown: ChampionColumnFlags
): ChampionDesktopColumn[] {
  return CHAMPION_DESKTOP_COLUMNS.filter(c => flags[c.group] && (!c.detail || breakdown[c.group]))
}

/** En-têtes de groupe (colspan) pour la première ligne d'en-tête. */
export function championDesktopGroups(
  cols: ReadonlyArray<ChampionDesktopColumn>
): Array<{ group: ChampionColumnGroup; span: number }> {
  const out: Array<{ group: ChampionColumnGroup; span: number }> = []
  for (const c of cols) {
    const last = out[out.length - 1]
    if (last && last.group === c.group) last.span++
    else out.push({ group: c.group, span: 1 })
  }
  return out
}

/** Sens d'un écart : ▲ teal / ▼ rouge ; inversé pour les dégâts reçus. */
export function championDeltaTone(delta: number, invert = false): 'up' | 'down' | 'flat' {
  if (Math.abs(delta) < 0.05) return 'flat'
  const up = delta > 0
  return up !== invert ? 'up' : 'down'
}

export type ChampionDamageType = 'phys' | 'magic' | 'true'

/**
 * Barre « Total infligé » empilée : largeur totale = total / max,
 * découpée au prorata phys / mag / brut. Pourcentages de la piste (0–100, 1 décimale).
 */
export function championDamageSegments(
  parts: Record<ChampionDamageType, number>,
  total: number,
  max: number
): Array<{ type: ChampionDamageType; pct: number }> {
  const sum = parts.phys + parts.magic + parts.true
  if (!(max > 0) || !(total > 0) || !(sum > 0)) return []
  const width = Math.min(100, (total / max) * 100)
  return (['phys', 'magic', 'true'] as const)
    .map(type => ({ type, pct: Math.round((parts[type] / sum) * width * 10) / 10 }))
    .filter(s => s.pct > 0)
}
