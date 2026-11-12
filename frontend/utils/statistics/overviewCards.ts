import { barPct } from './barPct'

export type BarRow = { championId: number; value: number; pct: number }

/** Lignes d'une carte à barres : largeur rapportée au max (ou à l'écart à `baseline`). */
export function barList(
  rows: ReadonlyArray<{ championId: number; value: number }>,
  opts: { limit: number; baseline?: number }
): BarRow[] {
  const top = rows.slice(0, opts.limit)
  const base = opts.baseline ?? 0
  const max = Math.max(0, ...top.map(r => r.value - base))
  return top.map(r => ({
    championId: r.championId,
    value: r.value,
    pct: barPct(r.value - base, max),
  }))
}

export type OutcomeKey = 'played' | 'surrender' | 'early'
export type OutcomeSegment = { key: OutcomeKey; count: number; pct: number }

/** Segments de la barre empilée « Issue des parties ». */
export function outcomeSegments(c: Record<OutcomeKey, number>): OutcomeSegment[] {
  const total = c.played + c.surrender + c.early
  return (['played', 'surrender', 'early'] as const).map(key => ({
    key,
    count: c[key],
    pct: total > 0 ? Math.round((c[key] / total) * 1000) / 10 : 0,
  }))
}

export type PairedBanRow = {
  championId: number
  win: number
  loss: number
  winPct: number
  lossPct: number
}

function rate(v: string | undefined): number {
  const n = parseFloat(String(v ?? '').replace('%', ''))
  return Number.isFinite(n) ? n : 0
}

/** Bans équipe gagnante vs perdante : ordre de la gagnante, échelle commune. */
export function pairedBans(
  byWin: ReadonlyArray<{ championId: number; banRatePercent?: string }>,
  byLoss: ReadonlyArray<{ championId: number; banRatePercent?: string }>,
  limit: number
): PairedBanRow[] {
  const loss = new Map(byLoss.map(r => [Number(r.championId), rate(r.banRatePercent)]))
  const rows = byWin.slice(0, limit).map(r => ({
    championId: Number(r.championId),
    win: rate(r.banRatePercent),
    loss: loss.get(Number(r.championId)) ?? 0,
  }))
  const max = Math.max(0, ...rows.flatMap(r => [r.win, r.loss]))
  return rows.map(r => ({ ...r, winPct: barPct(r.win, max), lossPct: barPct(r.loss, max) }))
}
