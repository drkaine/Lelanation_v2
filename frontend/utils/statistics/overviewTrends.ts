/** Tendances depuis la version de référence (maquette Vue d'ensemble › Tendances). */
export type TrendMetric = 'winrate' | 'pickrate' | 'banrate'
export const TREND_METRICS: readonly TrendMetric[] = ['winrate', 'pickrate', 'banrate']

export interface TrendRow {
  championId: number
  from: number
  to: number
  delta: number
  barPct: number
}

const FIELDS: Record<TrendMetric, [string, string, string]> = {
  winrate: ['wrOldest', 'wrSince', 'deltaWr'],
  pickrate: ['pickrateOldest', 'pickrateSince', 'deltaPick'],
  banrate: ['banrateOldest', 'banrateSince', 'deltaBan'],
}

type Raw = { championId: number } & Record<string, unknown>

function pick(metric: TrendMetric, list: readonly Raw[], limit: number) {
  const [a, b, d] = FIELDS[metric]
  return list
    .map(r => ({
      championId: r.championId,
      from: Number(r[a]),
      to: Number(r[b]),
      delta: Number(r[d]),
    }))
    .filter(r => Number.isFinite(r.from) && Number.isFinite(r.to) && Number.isFinite(r.delta))
    .slice(0, limit)
}

export function trendRows(
  metric: TrendMetric,
  ups: readonly Raw[],
  downs: readonly Raw[],
  limit = 5
): { ups: TrendRow[]; downs: TrendRow[] } {
  const u = pick(metric, ups, limit)
  const dn = pick(metric, downs, limit)
  const max = Math.max(0, ...u.map(r => Math.abs(r.delta)), ...dn.map(r => Math.abs(r.delta)))
  const bar = (r: Omit<TrendRow, 'barPct'>): TrendRow => ({
    ...r,
    barPct: max > 0 ? Math.round((Math.abs(r.delta) / max) * 100) : 0,
  })
  return { ups: u.map(bar), downs: dn.map(bar) }
}
