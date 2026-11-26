/**
 * Répartition des tiers de la tier list (Gestion > Stats), sur la note × 100.
 * |s| < bHalf → B ; s ≥ sMin → S ; S+ si s ≥ max(sPlusMin, S min + extremeGap), au plus extremeMax.
 * C, D en miroir. Mêmes règles que backend/src/services/TierDistributionService.ts.
 */
export interface TierDistribution {
  bHalf: number
  sMin: number
  sPlusMin: number
  extremeGap: number
  extremeMax: number
}

export const TIER_DISTRIBUTION_FIELDS = [
  'bHalf',
  'sMin',
  'sPlusMin',
  'extremeGap',
  'extremeMax',
] as const

export const DEFAULT_TIER_DISTRIBUTION: TierDistribution = {
  bHalf: 35,
  sMin: 70,
  sPlusMin: 105,
  extremeGap: 30,
  extremeMax: 5,
}

export function tierDistributionValid(d: TierDistribution): boolean {
  if (!TIER_DISTRIBUTION_FIELDS.every(k => Number.isFinite(d[k]))) return false
  return (
    d.bHalf > 0 &&
    d.sMin > d.bHalf &&
    d.sPlusMin >= d.sMin &&
    d.extremeGap >= 0 &&
    Number.isInteger(d.extremeMax) &&
    d.extremeMax >= 0
  )
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const num = (v: unknown): number => (typeof v === 'number' ? v : Number.NaN)

/** Réponse `GET /api/admin/tier-distribution` ; invalide → défauts. */
export function parseTierDistribution(body: unknown): TierDistribution {
  const s = isRecord(body) && isRecord(body.settings) ? body.settings : null
  if (!s) return { ...DEFAULT_TIER_DISTRIBUTION }
  const parsed: TierDistribution = {
    bHalf: num(s.bHalf),
    sMin: num(s.sMin),
    sPlusMin: num(s.sPlusMin),
    extremeGap: num(s.extremeGap),
    extremeMax: num(s.extremeMax),
  }
  return tierDistributionValid(parsed) ? parsed : { ...DEFAULT_TIER_DISTRIBUTION }
}
