/** Maquette 27 « Pings par partie » : barres triées, longueur relative au ping le plus utilisé. */
export function pingBarRows<K extends string>(
  data: Partial<Record<K, unknown>> | null | undefined,
  keys: readonly K[]
): { key: K; value: number; pct: number }[] {
  const val = (k: K) => {
    const n = Number(data?.[k])
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  const rows = keys.map(key => ({ key, value: val(key) })).sort((a, b) => b.value - a.value)
  const max = rows[0]?.value ?? 0
  return rows.map(r => ({ ...r, pct: max > 0 ? Math.round((r.value / max) * 100) : 0 }))
}
