import { describe, expect, it } from 'vitest'
import { resolveTheorycraftSpellDescription } from '../useTheorycraftTooltip'
import type { TheorycraftBuildStats } from '~/types/theorycraft'

const baseStats: TheorycraftBuildStats = {
  level: 18,
  totalAD: 70,
  bonusAD: 20,
  AP: 0,
  totalHP: 2000,
  bonusHP: 500,
  armor: 100,
  magicResist: 50,
  maxMana: 800,
  critChance: 0,
  critDamage: 1.75,
}

describe('useTheorycraftTooltip', () => {
  it('resolves AD-scaled damage with live stats', () => {
    const spell = {
      tooltipRaw: 'Deals <physicalDamage>{{ totaldamage }} physical damage</physicalDamage>.',
      maxRank: 5,
      calculations: [
        {
          key: 'totaldamage',
          baseValues: [5, 10, 15, 20, 25],
          ratios: [{ stat: 'totalAD', coefficient: 1, type: 'physical' }],
        },
      ],
      dataValues: [],
      spellEffects: [],
    }

    const { html, isDynamic } = resolveTheorycraftSpellDescription(spell, baseStats, 1)
    expect(isDynamic).toBe(true)
    expect(html).toContain('5')
    expect(html).toContain('70')
    expect(html).not.toMatch(/\{\{/)
  })

  it('falls back to static html when runtime data is missing', () => {
    const { html, isDynamic } = resolveTheorycraftSpellDescription(
      {},
      baseStats,
      1,
      '<p>Static tooltip</p>'
    )
    expect(isDynamic).toBe(false)
    expect(html).toContain('Static tooltip')
  })

  it('uses rank-specific data values instead of full series', () => {
    const spell = {
      tooltipRaw: 'Damage: {{ BaseDamage }}',
      maxRank: 5,
      calculations: [],
      dataValues: [{ name: 'BaseDamage', values: [80, 120, 160, 200, 240] }],
      spellEffects: [],
    }

    const { html, isDynamic } = resolveTheorycraftSpellDescription(spell, null, 3)
    expect(isDynamic).toBe(true)
    expect(html).toContain('160')
    expect(html).not.toContain('80 / 120')
  })

  it('resolves Effect1Amount and CharAbilityPower scaling tokens', () => {
    const stats: TheorycraftBuildStats = {
      ...baseStats,
      AP: 300,
    }
    const spell = {
      tooltipRaw:
        'Inflige {{ Effect1Amount }} <scaleAP>(+{{ CharAbilityPower }})</scaleAP> pts de dégâts magiques.',
      maxRank: 5,
      calculations: [
        {
          key: 'totaldamage',
          baseValues: [35, 60, 85, 110, 135],
          ratios: [{ stat: 'AP', coefficient: 0.5, type: 'magic' }],
        },
      ],
      dataValues: [{ name: 'BaseDamage', values: [35, 60, 85, 110, 135] }],
      spellEffects: [],
    }

    const { html, isDynamic } = resolveTheorycraftSpellDescription(spell, stats, 1)
    expect(isDynamic).toBe(true)
    expect(html).toContain('35')
    expect(html).toContain('150')
    expect(html).toContain('scale-ap')
  })
})
