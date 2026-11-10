import { describe, expect, it } from 'vitest'
import { companionCoreDamageSelect } from '../../../../src/services/CompanionBenchmarkService.js'

describe('companionCoreDamageSelect', () => {
  it('lit les colonnes *_done_to_champions de agg_champion_core_stats', () => {
    const sql = companionCoreDamageSelect('cs')
    expect(sql).toContain('cs.sum_physical_damage_done_to_champions')
    expect(sql).toContain('cs.sum_magic_damage_done_to_champions')
    expect(sql).toContain('cs.sum_true_damage_done_to_champions')
    expect(sql).not.toMatch(/sum_(physical|magic|true)_damage_to_champions\)/)
  })
})
