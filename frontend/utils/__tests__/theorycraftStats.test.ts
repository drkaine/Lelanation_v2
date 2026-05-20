import { describe, expect, it } from 'vitest'
import type { Champion } from '@lelanation/shared-types'
import {
  championWithStatsForBuild,
  resolveChampionStatsForBuild,
  resolveHeaderStatAtRank,
  theorycraftExportToChampionStats,
} from '../theorycraftStats'

describe('theorycraftStats', () => {
  it('applies build CDR to cooldown header stat at selected rank', () => {
    const stat = {
      key: 'cooldown',
      label: 'CD',
      valueText: '6 / 5.5 / 5 / 4.5 / 4',
    }
    const rank1 = resolveHeaderStatAtRank(stat, 1, { cooldownReduction: 0.4 })
    expect(rank1.valueText).toBe('3.6')

    const rank3 = resolveHeaderStatAtRank(stat, 3, { cooldownReduction: 0.4 })
    expect(rank3.valueText).toBe('3')
  })

  it('leaves non-cooldown header stats unchanged aside from rank slicing', () => {
    const stat = {
      key: 'cost',
      label: 'Cost',
      valueText: '30 / 35 / 40 / 45 / 50 Mana',
    }
    const resolved = resolveHeaderStatAtRank(stat, 2, { cooldownReduction: 0.5 })
    expect(resolved.valueText).toBe('35')
  })

  it('converts theorycraft baseStats/growthStats to DDragon stats', () => {
    const stats = theorycraftExportToChampionStats(
      {
        hp: 580,
        mp: 490,
        armor: 18,
        magicResist: 32,
        attackDamage: 52,
        attackSpeed: 0.625,
        attackRange: 550,
        movespeed: 340,
        hpRegen: 6.5,
        mpRegen: 8,
      },
      {
        hp: 108,
        mp: 26,
        armor: 4.7,
        magicResist: 1.3,
        attackDamage: 2.7,
        attackSpeed: 2.24,
        hpRegen: 0.6,
        mpRegen: 0.8,
      }
    )

    expect(stats?.hp).toBe(580)
    expect(stats?.attackdamage).toBe(52)
    expect(stats?.hpperlevel).toBe(108)
  })

  it('resolves stats from theorycraft champion export', () => {
    const champion = {
      id: 'Veigar',
      key: '45',
      name: 'Veigar',
      title: 'Tiny Master of Evil',
      image: { full: 'Veigar.png' },
      stats: undefined as unknown as Champion['stats'],
      baseStats: {
        hp: 580,
        attackDamage: 52,
      },
      growthStats: {
        hp: 108,
        attackDamage: 2.7,
      },
    } as Champion

    const resolved = resolveChampionStatsForBuild(champion)
    expect(resolved?.hp).toBe(580)
    expect(resolved?.attackdamage).toBe(52)

    const withStats = championWithStatsForBuild(champion)
    expect(withStats.stats.hp).toBe(580)
  })
})
