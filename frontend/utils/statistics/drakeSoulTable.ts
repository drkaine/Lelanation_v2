export type DrakeSoulRow = {
  key: string
  label: string
  drakePct: number | null
  soulPct: number | null
}
type Dist = { key: string; label: string; value: number }

const r2 = (v: number) => Math.round(v * 100) / 100

function shares(rows: readonly Dist[]): Map<string, { label: string; pct: number }> {
  const total = rows.reduce((s, r) => s + (Number(r.value) || 0), 0)
  const m = new Map<string, { label: string; pct: number }>()
  if (total <= 0) return m
  for (const r of rows)
    m.set(r.key, { label: r.label, pct: r2(((Number(r.value) || 0) / total) * 100) })
  return m
}

/** Tableau « Drakes et âmes » : part de chaque élément (drakes tués, âmes obtenues). Ancien en dernier. */
export function drakeSoulTable(drakes: readonly Dist[], souls: readonly Dist[]): DrakeSoulRow[] {
  const d = shares(drakes)
  const s = shares(souls)
  const keys = [...new Set([...d.keys(), ...s.keys()])]
  return keys
    .map(key => ({
      key,
      label: d.get(key)?.label ?? s.get(key)?.label ?? key,
      drakePct: d.get(key)?.pct ?? null,
      soulPct: s.get(key)?.pct ?? null,
    }))
    .sort((a, b) => {
      if ((a.key === 'elder') !== (b.key === 'elder')) return a.key === 'elder' ? 1 : -1
      return (b.drakePct ?? -1) - (a.drakePct ?? -1)
    })
}
