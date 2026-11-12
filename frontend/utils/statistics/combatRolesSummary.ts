/** Maquette 27 « Combat & rôles » : cartes KPI et table par rôle. */
export interface CombatKpi {
  key: 'kda3' | 'kda' | 'damage' | 'mitigated' | 'gold' | 'csPerMin'
  labelKey: string
  value: string
}

export interface CombatRoleInput {
  role: string
  games: number
  winrate: number
  kills: number
  deaths: number
  assists: number
  kda: number
  gold: number
  csPerMin: number
  damage: number
}

export interface CombatRoleRow extends CombatRoleInput {
  lowSample: boolean
}

const DASH = '—'

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function fmt(v: unknown, digits: number): string {
  const n = num(v)
  if (n === null) return DASH
  return n
    .toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    .replace(/[\u202F\u00A0]/g, ' ')
}

export function combatKpis(m: Partial<Record<string, number>>): CombatKpi[] {
  const k = num(m.kills)
  const d = num(m.deaths)
  const a = num(m.assists)
  const kda3 =
    k === null || d === null || a === null ? DASH : `${fmt(k, 1)} / ${fmt(d, 1)} / ${fmt(a, 1)}`
  return [
    { key: 'kda3', labelKey: 'statisticsPage.combatKpiKda3', value: kda3 },
    { key: 'kda', labelKey: 'statisticsPage.combatKpiKda', value: fmt(m.kda, 2) },
    { key: 'damage', labelKey: 'statisticsPage.combatKpiDamage', value: fmt(m.damage, 0) },
    { key: 'mitigated', labelKey: 'statisticsPage.combatKpiMitigated', value: fmt(m.mitigated, 0) },
    { key: 'gold', labelKey: 'statisticsPage.combatKpiGold', value: fmt(m.gold, 0) },
    { key: 'csPerMin', labelKey: 'statisticsPage.combatKpiCsPerMin', value: fmt(m.csPerMin, 1) },
  ]
}

export function combatRoleRows(
  roles: readonly CombatRoleInput[],
  minGames: number
): CombatRoleRow[] {
  return [...roles]
    .sort((a, b) => (num(b.games) ?? 0) - (num(a.games) ?? 0))
    .map(r => ({ ...r, lowSample: (num(r.games) ?? 0) < minGames }))
}

export function formatCombatNumber(v: unknown, digits: number): string {
  return fmt(v, digits)
}
