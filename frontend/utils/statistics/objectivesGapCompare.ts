/** Objectifs « lesquels font gagner ? » : paires de % comparées, triées par écart absolu. */
export type ObjectivesCompareMode = 'winLoss' | 'sides'
export type ObjectivesGapInput = { key: string; a: number | null; b: number | null }
export type ObjectivesGapRow = { key: string; a: number; b: number; gap: number }

const r2 = (v: number) => Math.round(v * 100) / 100
const clampPct = (v: number) => Math.min(100, Math.max(0, v))

export function objectivesGapRows(rows: readonly ObjectivesGapInput[]): ObjectivesGapRow[] {
  const out: ObjectivesGapRow[] = []
  for (const r of rows) {
    if (r.a == null || r.b == null || !Number.isFinite(r.a) || !Number.isFinite(r.b)) continue
    const a = r2(clampPct(r.a))
    const b = r2(clampPct(r.b))
    out.push({ key: r.key, a, b, gap: r2(a - b) })
  }
  return out.sort((x, y) => Math.abs(y.gap) - Math.abs(x.gap))
}
