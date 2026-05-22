import { describe, expect, it } from 'vitest'
import {
  filterSupplementalTooltipSections,
  resolveTheorycraftSpellDescription,
  resolveTheorycraftSpellDetailRaws,
  shouldShowSupplementalTooltipSummary,
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

  it('resolves Akali Q split AD/AP damage tokens', () => {
    const spell = {
      tooltipRaw:
        'Inflige <magicDamage>{{ BaseDamageNamed }} <scaleAD>(+{{ ADDamage }})</scaleAD> <scaleAP>(+{{ APDamage }})</scaleAP> pts de dégâts magiques</magicDamage>.',
      maxRank: 5,
      calculations: [
        {
          key: 'damage',
          baseValues: [45, 70, 95, 120, 145],
          ratios: [
            { stat: 'bonusAD', coefficient: 0.65, type: 'physical' },
            { stat: 'AP', coefficient: 0.6, type: 'magic' },
          ],
        },
      ],
      dataValues: [
        { name: 'BaseDamageNamed', values: [45, 70, 95, 120, 145] },
        { name: 'tADRatio', values: [0.65, 0.65, 0.65, 0.65, 0.65] },
        { name: 'APRatio', values: [0.6, 0.6, 0.6, 0.6, 0.6] },
      ],
      spellEffects: [],
    }

    const { html, isDynamic } = resolveTheorycraftSpellDescription(spell, baseStats, 1)
    expect(isDynamic).toBe(true)
    expect(html).toContain('45')
    expect(html).toContain('13')
    expect(html).toContain('0')
    expect(html).not.toContain('60% AP')
    expect(html).not.toContain('65% AD')
    expect(html).not.toMatch(/\(\+\s*\)/)
    expect(html).not.toMatch(/\{\{/)
  })

  it('omits ratio percent when live stat scaling is available', () => {
    const spell = {
      tooltipRaw:
        'Inflige <magicDamage>{{ damage }} pts de dégâts magiques supplémentaires</magicDamage>.',
      maxRank: 5,
      calculations: [
        {
          key: 'damage',
          baseValues: [35, 47, 71, 107, 167],
          ratios: [
            { stat: 'bonusAD', coefficient: 0.6, type: 'physical' },
            { stat: 'AP', coefficient: 0.55, type: 'magic' },
          ],
        },
      ],
      dataValues: [],
      spellEffects: [],
    }

    const stats: TheorycraftBuildStats = {
      ...baseStats,
      bonusAD: 10.8,
      AP: 0,
    }

    const { html, isDynamic } = resolveTheorycraftSpellDescription(spell, stats, 5)
    expect(isDynamic).toBe(true)
    expect(html).toContain('167')
    expect(html).toContain('6.48')
    expect(html).toContain('0')
    expect(html).not.toContain('55% AP')
    expect(html).not.toContain('60% AD')
    expect(html).not.toMatch(/60% AD.*6\.48|6\.48.*60% AD/)
  })

  it('appends percent suffix for displayAsPercent calculations like Aatrox passive', () => {
    const spell = {
      tooltipRaw:
        "Les attaques d'Aatrox infligent <magicDamage>{{ PDamage }} des PV max en dégâts magiques</magicDamage> supplémentaires.",
      maxRank: 18,
      calculations: [
        {
          key: 'PDamage',
          baseValues: [4, 5.41, 6.82, 8.24, 9.65],
          ratios: [],
          displayAsPercent: true,
        },
      ],
      dataValues: [],
      spellEffects: [],
    }

    const { html, isDynamic } = resolveTheorycraftSpellDescription(spell, baseStats, 5)
    expect(isDynamic).toBe(true)
    expect(html).toContain('9.65%')
    expect(html).toContain('des PV max')
    expect(html).not.toMatch(/9\.65(?![%]) des PV max/)
  })

  it('appends Aatrox Q recast damage from QRampBonus', () => {
    const spell = {
      tooltipRaw:
        'Aatrox abat son épée, infligeant <physicalDamage>{{ qdamage }} pts de dégâts physiques</physicalDamage>. Cette compétence peut être <recast>réactivée</recast> deux fois.',
      maxRank: 5,
      calculations: [
        {
          key: 'QDamage',
          baseValues: [10, 25, 40, 55, 70],
          ratios: [{ stat: 'totalAD', coefficient: 0.9, type: 'physical' }],
        },
        {
          key: 'QEdgeDamage',
          baseValues: [17, 42.5, 68, 93.5, 119],
          ratios: [],
        },
      ],
      dataValues: [{ name: 'QRampBonus', values: [0.25, 0.25, 0.25, 0.25, 0.25] }],
      spellEffects: [],
    }

    const { html, isDynamic } = resolveTheorycraftSpellDescription(spell, baseStats, 5)
    expect(isDynamic).toBe(true)
    expect(html).toContain('70')
    expect(html).toContain('2e coup')
    expect(html).toContain('3e coup')
    expect(html).toContain('166.25')
    expect(html).toContain('207.81')
  })

  it('filters duplicate supplemental tooltip sections', () => {
    const main =
      'Aatrox abat son épée, infligeant 70 pts de dégâts physiques. Cette compétence peut être réactivée deux fois.'
    const duplicate =
      'Aatrox abat son épée devant lui, infligeant 70 pts de dégâts physiques. Cette compétence peut être relancée 2 fois de plus.'
    const unique = '<span class="tooltip-rules">Inflige 55 pts de dégâts aux sbires.</span>'

    expect(filterSupplementalTooltipSections(main, [duplicate, unique])).toEqual([unique])
    expect(shouldShowSupplementalTooltipSummary('Résumé court', main)).toBe(true)
    expect(
      shouldShowSupplementalTooltipSummary(
        'Aatrox abat son épée, infligeant 70 pts de dégâts physiques.',
        main
      )
    ).toBe(false)
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
    expect(details[0]).not.toContain('0.01% AP')
    expect(details[0]).toContain('50')
    expect(details[0]).not.toMatch(/\{\{/)
  })
})
