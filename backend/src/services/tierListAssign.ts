/**
 * Tier labels from matchup note (raw sum). B is centered on score 0 (UI = note × SCORE_SCALE).
 * S+ and D (F) are capped per cohort and require a clear gap vs S / C respectively.
 */
import {
  DEFAULT_TIER_DISTRIBUTION,
  getTierDistribution,
  type TierDistribution,
} from './TierDistributionService.js'

export type LolalyticsTier = 'S+' | 'S' | 'A' | 'B' | 'C' | 'D'

/** Raw API note × scale = score shown in tier-list UI (B ≈ 0). */
export const TIER_NOTE_SCORE_SCALE = 100

/** Defaults (editable in Gestion > Stats, see TierDistributionService). */
export const TIER_EXTREME_MAX = DEFAULT_TIER_DISTRIBUTION.extremeMax

export const TIER_EXTREME_GAP_SCALED = DEFAULT_TIER_DISTRIBUTION.extremeGap

export const TIER_BAND_B_HALF = DEFAULT_TIER_DISTRIBUTION.bHalf

export function scaledTierNote(rawNote: number): number {
  const n = rawNote * TIER_NOTE_SCORE_SCALE
  return Number.isFinite(n) ? n : 0
}

function baseTierFromScaled(
  scaled: number,
  d: TierDistribution = DEFAULT_TIER_DISTRIBUTION,
): LolalyticsTier {
  if (Math.abs(scaled) < d.bHalf) return 'B'
  if (scaled >= d.sMin) return 'S'
  if (scaled > 0) return 'A'
  return 'C'
}

function capExtremeTop(
  tiers: LolalyticsTier[],
  notesDesc: number[],
  d: TierDistribution = DEFAULT_TIER_DISTRIBUTION,
): void {
  const scaled = notesDesc.map(scaledTierNote)
  const sScores = scaled.filter((_, i) => tiers[i] === 'S')
  const minAmongS = sScores.length > 0 ? Math.min(...sScores) : d.sMin
  const sPlusMin = Math.max(d.sPlusMin, minAmongS + d.extremeGap)

  let sPlusCount = 0
  for (let i = 0; i < tiers.length; i++) {
    if (scaled[i]! >= sPlusMin && sPlusCount < d.extremeMax) {
      tiers[i] = 'S+'
      sPlusCount++
    }
  }
}

function capExtremeBottom(
  tiers: LolalyticsTier[],
  notesDesc: number[],
  d: TierDistribution = DEFAULT_TIER_DISTRIBUTION,
): void {
  const scaled = notesDesc.map(scaledTierNote)
  const cScores = scaled.filter((_, i) => tiers[i] === 'C')
  const maxAmongC = cScores.length > 0 ? Math.max(...cScores) : -d.sMin
  const dMax = Math.min(-d.sPlusMin, maxAmongC - d.extremeGap)

  let dCount = 0
  for (let i = tiers.length - 1; i >= 0; i--) {
    if (scaled[i]! <= dMax && dCount < d.extremeMax) {
      tiers[i] = 'D'
      dCount++
    }
  }
}

/** Assign tiers; `notesDesc` must be sorted by note descending. */
export function assignTiersFromNotes(
  notesDesc: number[],
  d: TierDistribution = getTierDistribution(),
): LolalyticsTier[] {
  if (notesDesc.length === 0) return []

  const tiers = notesDesc.map((note) => baseTierFromScaled(scaledTierNote(note), d))
  capExtremeTop(tiers, notesDesc, d)
  capExtremeBottom(tiers, notesDesc, d)
  return tiers
}

export const __tierListAssignTestables = {
  baseTierFromScaled,
  capExtremeTop,
  capExtremeBottom,
  scaledTierNote,
}
