import { describe, expect, it } from 'vitest'
import {
  resolveTheorycraftSpellDescription,
  resolveTheorycraftSpellDetailRaws,
} from '../useTheorycraftTooltip'
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

  it('shows AP ratio percentages even without live build stats', () => {
    const spell = {
      tooltipRaw: 'Inflige <magicDamage>{{ totaldamage }} pts de dégâts magiques</magicDamage>.',
      maxRank: 5,
      calculations: [
        {
          key: 'totaldamage',
          baseValues: [80, 120, 160, 200, 240],
          ratios: [{ stat: 'AP', coefficient: [0.5, 0.55, 0.6, 0.65, 0.7], type: 'magic' }],
        },
      ],
      dataValues: [],
      spellEffects: [],
    }

    const { html, isDynamic } = resolveTheorycraftSpellDescription(spell, null, 1)
    expect(isDynamic).toBe(true)
    expect(html).toContain('80')
    expect(html).toContain('50% AP')
    expect(html).not.toMatch(/\{\{/)
  })

  it('resolves Nasus Q crit detail from tooltipDetailRaws with live AD and stacks', () => {
    const spell = {
      tooltipRaw:
        'La prochaine attaque inflige <physicalDamage>{{ totaldamage }} pts de dégâts physiques</physicalDamage>.',
      tooltipDetailRaws: [
        'Cette compétence peut être critique et ainsi infliger <physicalDamage>{{ critdamage }} pts de dégâts physiques</physicalDamage>.',
      ],
      maxRank: 5,
      calculations: [
        {
          key: 'totaldamage',
          baseValues: [40, 60, 80, 100, 120],
          ratios: [{ stat: 'totalAD', coefficient: 1, type: 'physical' }],
        },
        {
          key: 'critdamage',
          baseValues: [71.75, 106.75, 141.75, 176.75, 211.75],
          ratios: [
            { stat: 'critDamage', coefficient: 1, type: 'magic' },
            { stat: 'totalAD', coefficient: 1, type: 'physical' },
          ],
        },
      ],
      dataValues: [{ name: 'BasicStacks', values: [3, 3, 3, 3, 3] }],
      spellEffects: [],
    }

    const stats: TheorycraftBuildStats = {
      ...baseStats,
      totalAD: 200,
      critDamage: 1.75,
    }

    const details = resolveTheorycraftSpellDetailRaws(spell, stats, 1, {
      definition: {
        id: 'NasusQ',
        scope: 'spell',
        spellSlot: 'Q',
        label: 'Q',
        statBonuses: [],
        tooltipVars: [],
        damageBonuses: [{ targetKey: 'totaldamage', perStackKey: 'basicstacks' }],
      },
      stackCount: 100,
      calculationsBySource: {
        NasusQ: [
          { key: 'basicstacks', baseValues: [3, 3, 3, 3, 3], ratios: [] },
          {
            key: 'totaldamage',
            baseValues: [40, 60, 80, 100, 120],
            ratios: [{ stat: 'totalAD', coefficient: 1, type: 'physical' }],
          },
        ],
      },
    })

    expect(details).toHaveLength(1)
    // (40 + 200 + 300 stacks) * 1.75 = 945
    expect(details[0]).toContain('945')
    expect(details[0]).not.toMatch(/\{\{/)
  })

  it('resolves Nasus R storm detail with AP scaling and Q CDR', () => {
    const spell = {
      tooltipRaw: 'Ult bonus {{ bonushealth }}',
      tooltipDetailRaws: [
        'Dégâts de <magicDamage>{{ damagecalc }} des PV max</magicDamage> et CDR {{ qcdr*100 }}%.',
      ],
      maxRank: 3,
      calculations: [
        {
          key: 'damagecalc',
          baseValues: [0.03, 0.04, 0.05],
          ratios: [{ stat: 'AP', coefficient: 0.0001, type: 'magic' }],
        },
      ],
      dataValues: [
        { name: 'BonusHealth', values: [300, 450, 600] },
        { name: 'QCDR', values: [0.5, 0.5, 0.5] },
      ],
      spellEffects: [],
    }

    const stats: TheorycraftBuildStats = {
      ...baseStats,
      AP: 300,
    }

    const details = resolveTheorycraftSpellDetailRaws(spell, stats, 1)
    expect(details).toHaveLength(1)
    expect(details[0]).toContain('0.06')
    expect(details[0]).toContain('0.01% AP')
    expect(details[0]).toContain('50')
    expect(details[0]).not.toMatch(/\{\{/)
  })
})
