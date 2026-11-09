/** Maquette 27 « Soins & dégâts » : barres de soins et répartition des dégâts infligés. */
export interface MiscMetric {
  key: string
  avgPerGame: number
}

const pos = (v: unknown) => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function healingBars(metrics: readonly MiscMetric[]): (MiscMetric & { pct: number })[] {
  const rows = metrics
    .filter(m => pos(m.avgPerGame) > 0)
    .sort((a, b) => b.avgPerGame - a.avgPerGame)
  const max = rows[0]?.avgPerGame ?? 0
  return rows.map(m => ({ ...m, pct: max > 0 ? (m.avgPerGame / max) * 100 : 0 }))
}

const DAMAGE_ORDER = ['magicDone', 'physicalDone', 'trueDone'] as const

export function damageSplit(metrics: readonly MiscMetric[]): {
  total: number
  parts: { key: (typeof DAMAGE_ORDER)[number]; value: number; pct: number }[]
} {
  const values = DAMAGE_ORDER.map(key => ({
    key,
    value: pos(metrics.find(m => m.key === key)?.avgPerGame),
  }))
  const total = values.reduce((s, v) => s + v.value, 0)
  return { total, parts: values.map(v => ({ ...v, pct: total > 0 ? (v.value / total) * 100 : 0 })) }
}
