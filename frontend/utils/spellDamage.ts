/**
 * Spell damage calculation from Data Dragon spell data (effect + vars).
 * When Data Dragon effect is all zeros, Community Dragon override can be used.
 */
import type { Spell, CalculatedStats } from '~/types/build'
import type { CommunityDragonSpellDamageData } from '~/utils/communityDragonSpellDamage'

interface SpellVar {
  link?: string
  coeff?: number[]
}

/**
 * Get base damage per rank from spell.effect (first effect array) or Community Dragon override.
 */
function getBaseDamagePerRank(
  spell: Spell,
  cdOverride?: CommunityDragonSpellDamageData | null
): number[] {
  if (cdOverride?.baseByRank?.length) return cdOverride.baseByRank
  if (!spell.effect || spell.effect.length === 0) return []
  const first = spell.effect[0]
  if (!first || !Array.isArray(first)) return []
  return first.map((v: number) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0))
}

/**
 * Get scaling coefficients from spell.vars or Community Dragon override.
 */
function getScaling(
  spell: Spell,
  cdOverride?: CommunityDragonSpellDamageData | null
): { ad: number; bonusAd: number; ap: number } {
  const result = { ad: 0, bonusAd: 0, ap: 0 }
  if (cdOverride) {
    if (cdOverride.adRatio != null) result.ad = cdOverride.adRatio
    if (cdOverride.bonusAdRatio != null) result.bonusAd = cdOverride.bonusAdRatio
    if (cdOverride.apRatio != null) result.ap = cdOverride.apRatio
    if (result.ad || result.bonusAd || result.ap) return result
  }
  if (!spell.vars || !Array.isArray(spell.vars)) return result
  for (const v of spell.vars as SpellVar[]) {
    const coeff = Array.isArray(v.coeff) && v.coeff[0] != null ? Number(v.coeff[0]) : 0
    if (Number.isNaN(coeff)) continue
    const link = (v.link || '').toLowerCase()
    if (link === 'attackdamage') result.ad += coeff
    else if (link === 'bonusattackdamage') result.bonusAd += coeff
    else if (link === 'spelldamage' || link === 'abilitypower') result.ap += coeff
  }
  return result
}

/**
 * Compute raw spell damage at given rank using champion stats at current level.
 * Uses Community Dragon override when provided (Data Dragon effect is often all zeros).
 */
export function getSpellDamage(
  spell: Spell,
  rank: number,
  stats: CalculatedStats,
  championBaseAd: number,
  cdOverride?: CommunityDragonSpellDamageData | null
): number {
  const bases = getBaseDamagePerRank(spell, cdOverride)
  const rankIndex = Math.max(0, Math.min(rank - 1, bases.length - 1))
  const base = bases[rankIndex] ?? 0
  const scaling = getScaling(spell, cdOverride)
  const bonusAd = Math.max(0, stats.attackDamage - championBaseAd)
  const total =
    base +
    scaling.ad * stats.attackDamage +
    scaling.bonusAd * bonusAd +
    scaling.ap * stats.abilityPower
  return Math.round(Math.max(0, total))
}

/**
 * Get damage per rank (1 to maxrank) for a spell.
 * cdOverrides: optional map spellId -> Community Dragon data (when Data Dragon effect is 0).
 */
export function getSpellDamageByRank(
  spell: Spell,
  stats: CalculatedStats,
  championBaseAd: number,
  cdOverrides?: Record<string, CommunityDragonSpellDamageData> | null
): { rank: number; damage: number }[] {
  const cdOverride = cdOverrides?.[spell.id] ?? null
  const maxrank = spell.maxrank || 5
  const result: { rank: number; damage: number }[] = []
  for (let rank = 1; rank <= maxrank; rank++) {
    result.push({
      rank,
      damage: getSpellDamage(spell, rank, stats, championBaseAd, cdOverride),
    })
  }
  return result
}
