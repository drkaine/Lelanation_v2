/**
 * Tier labels from matchup note (raw sum). B is centered on score 0 (UI = note × SCORE_SCALE).
 * S+ and D (F) are capped per cohort and require a clear gap vs S / C respectively.
 */
export type LolalyticsTier = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'

/** Raw API note × scale = score shown in tier-list UI (B ≈ 0). */
export const TIER_NOTE_SCORE_SCALE = 100

/** Max S+ or D (F) champions per role cohort. */
export const TIER_EXTREME_MAX = 5

/** Min scaled-score gap: lowest S+ vs highest S, highest D vs lowest C. */
export const TIER_EXTREME_GAP_SCALED = 30

/** Half-width of B band on scaled score: |score| < B_HALF → B. */
export const TIER_BAND_B_HALF = 35

export function scaledTierNote(rawNote: number): number {
  const n = rawNote * TIER_NOTE_SCORE_SCALE
  return Number.isFinite(n) ? n : 0
}

function baseTierFromScaled(scaled: number): LolalyticsTier {
  const abs = Math.abs(scaled)
  const h = TIER_BAND_B_HALF
  if (abs < h) return 'B'
  if (scaled >= h && scaled < h * 2) return 'A'
  if (scaled >= h * 2) return 'S'
  if (scaled <= -h && scaled > -h * 2) return 'C'
  return 'C'
}

function capExtremeTop(tiers: LolalyticsTier[], notesDesc: number[]): void {
  const scaled = notesDesc.map(scaledTierNote)
  const sScores = scaled.filter((_, i) => tiers[i] === 'S')
  const minAmongS = sScores.length > 0 ? Math.min(...sScores) : TIER_BAND_B_HALF * 2
  const sPlusMin = Math.max(TIER_BAND_B_HALF * 3, minAmongS + TIER_EXTREME_GAP_SCALED)

  let sPlusCount = 0
  for (let i = 0; i < tiers.length; i++) {
    if (scaled[i]! >= sPlusMin && sPlusCount < TIER_EXTREME_MAX) {
      tiers[i] = 'S+'
      sPlusCount++
    }
  }
}

function capExtremeBottom(tiers: LolalyticsTier[], notesDesc: number[]): void {
  const scaled = notesDesc.map(scaledTierNote)
  const cScores = scaled.filter((_, i) => tiers[i] === 'C')
  const maxAmongC = cScores.length > 0 ? Math.max(...cScores) : -TIER_BAND_B_HALF * 2
  const dMax = Math.min(-TIER_BAND_B_HALF * 3, maxAmongC - TIER_EXTREME_GAP_SCALED)

  let dCount = 0
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (scaled[i]! <= dMax && dCount < TIER_EXTREME_MAX) {
      tiers[i] = 'D'
      dCount++
    }
  }
}

/** Assign tiers; `notesDesc` must be sorted by note descending. */
export function assignTiersFromNotes(notesDesc: number[]): LolalyticsTier[] {
  const n = notesDesc.length
  if (n === 0) return []

  const tiers = notesDesc.map((note) => baseTierFromScaled(scaledTierNote(note)))
  capExtremeTop(tiers, notesDesc)
  capExtremeBottom(tiers, notesDesc)
  return tiers
}

export const __tierListAssignTestables = {
  baseTierFromScaled,
  capExtremeTop,
  capExtremeBottom,
  scaledTierNote,
}
