/**
 * Spell damage calculation from Data Dragon spell data (effect + vars).
 * Used by the Theorycraft page to show damage per rank.
 */
import type { Spell, CalculatedStats } from '~/types/build'

interface SpellVar {
  link?: string
  coeff?: number[]
}

/**
 * Get base damage per rank from spell.effect (first effect array, typically physical/magical base).
 */
function getBaseDamagePerRank(spell: Spell): number[] {
  if (!spell.effect || spell.effect.length === 0) return []
  const first = spell.effect[0]
  if (!first || !Array.isArray(first)) return []
  return first.map((v: number) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0))
}

/**
 * Get scaling coefficients from spell.vars (link: attackdamage, bonusattackdamage, spelldamage).
 */
function getScaling(spell: Spell): { ad: number; bonusAd: number; ap: number } {
  const result = { ad: 0, bonusAd: 0, ap: 0 }
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
 * Formula: base(rank) + ratioAD * totalAD + ratioBonusAD * bonusAD + ratioAP * AP
 * (Data Dragon often uses total AD or bonus AD; we apply both if present.)
 */
export function getSpellDamage(
  spell: Spell,
  rank: number,
  stats: CalculatedStats,
  championBaseAd: number
): number {
  const bases = getBaseDamagePerRank(spell)
  const rankIndex = Math.max(0, Math.min(rank - 1, bases.length - 1))
  const base = bases[rankIndex] ?? 0
  const scaling = getScaling(spell)
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
 */
export function getSpellDamageByRank(
  spell: Spell,
  stats: CalculatedStats,
  championBaseAd: number
): { rank: number; damage: number }[] {
  const maxrank = spell.maxrank || 5
  const result: { rank: number; damage: number }[] = []
  for (let rank = 1; rank <= maxrank; rank++) {
    result.push({ rank, damage: getSpellDamage(spell, rank, stats, championBaseAd) })
  }
  return result
}
