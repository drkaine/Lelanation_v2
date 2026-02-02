/**
 * Theorycraft engine – manual verification helpers.
 * Run in browser console on theorycraft page or use with sample data.
 *
 * Verification (Shaco, level 18, Q rank 5):
 * - CommunityDragon Deceive: BaseDamage 15,25,35,45,55,65,75; BonusADRatio 0.6
 * - At level 18 base AD = 63 + 3*17 = 114, bonus AD = 0 (no items)
 * - Expected totalDamage = 55 + 0.6*0 = 55
 *
 * Shaco E rank 5: BaseDamage 45,70,95,120,145,170,195; BonusADRatio 0.8, APRatio 0.6
 * - Base-only: 145 + 0.8*0 + 0.6*0 = 145
 */

import type { Champion } from '~/types/build'
import {
  computeChampionStats,
  computeSpellDamage,
  computeChampionSpellSummary,
  loadCommunityDragonSpellDefinitions,
} from '~/utils/theorycraftEngine'

export interface VerificationResult {
  championId: string
  level: number
  statsOk: boolean
  spellCount: number
  sampleSpell?: { key: string; base: number; totalDamage: number; cooldown: number }
  error?: string
}

/**
 * Run a quick verification for a champion: load CD definitions, compute stats and one spell.
 * Call from browser: await runVerification(champion, 18) where champion is from store.
 */
export async function runVerification(
  champion: Champion | null,
  level: number = 18
): Promise<VerificationResult> {
  if (!champion) {
    return { championId: '', level, statsOk: false, spellCount: 0, error: 'No champion' }
  }

  const stats = computeChampionStats(champion.stats, level)
  const statsOk = stats.hp > 0 && stats.attackDamage > 0 && stats.level === level

  const definitions = await loadCommunityDragonSpellDefinitions(champion.id)
  const spellCount = definitions.length

  let sampleSpell: VerificationResult['sampleSpell']
  if (definitions.length > 0) {
    const first = definitions[0]!
    const result = computeSpellDamage(champion.id, first.key, 5, level, champion, definitions)
    if (result) {
      sampleSpell = {
        key: result.spellKey,
        base: result.base,
        totalDamage: result.totalDamage,
        cooldown: result.cooldown,
      }
    }
  }

  return {
    championId: champion.id,
    level,
    statsOk,
    spellCount,
    sampleSpell,
  }
}

/**
 * Build full JSON summary for a champion at level 18 (example output from spec).
 */
export async function getChampionSpellSummaryJson(
  champion: Champion,
  level: number = 18
): Promise<object> {
  const definitions = await loadCommunityDragonSpellDefinitions(champion.id)
  const summary = computeChampionSpellSummary(champion, level, definitions, {
    Q: 5,
    W: 5,
    E: 5,
    R: 3,
  })
  return {
    champion: summary.champion,
    level: summary.level,
    spells: {
      Q: summary.spells.Q
        ? {
            base: summary.spells.Q.base,
            apRatio: summary.spells.Q.apRatio,
            totalDamage: summary.spells.Q.totalDamage,
            cooldown: summary.spells.Q.cooldown,
          }
        : undefined,
      W: summary.spells.W
        ? {
            base: summary.spells.W.base,
            apRatio: summary.spells.W.apRatio,
            totalDamage: summary.spells.W.totalDamage,
            cooldown: summary.spells.W.cooldown,
          }
        : undefined,
      E: summary.spells.E
        ? {
            base: summary.spells.E.base,
            apRatio: summary.spells.E.apRatio,
            totalDamage: summary.spells.E.totalDamage,
            cooldown: summary.spells.E.cooldown,
          }
        : undefined,
      R: summary.spells.R
        ? {
            base: summary.spells.R.base,
            apRatio: summary.spells.R.apRatio,
            totalDamage: summary.spells.R.totalDamage,
            cooldown: summary.spells.R.cooldown,
          }
        : undefined,
    },
  }
}
