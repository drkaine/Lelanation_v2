type Count = number | string | null | undefined

/** Taux d'abandon d'un côté (en % des parties jouées de ce côté). */
export function sideSurrenderRates(s: {
  total: Count
  surrenderCount: Count
  earlySurrenderCount: Count
}): {
  surrenderPct: number | null
  earlyPct: number | null
} {
  const total = Number(s.total) || 0
  if (total <= 0) return { surrenderPct: null, earlyPct: null }
  const pct = (n: Count) => Math.round(((Number(n) || 0) / total) * 10000) / 100
  return { surrenderPct: pct(s.surrenderCount), earlyPct: pct(s.earlySurrenderCount) }
}
