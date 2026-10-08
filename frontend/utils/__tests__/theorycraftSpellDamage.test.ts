import { describe, expect, it } from 'vitest'
import {
  cooldownAfterReduction,
  evaluateDamageProfile,
  headerCooldownAtRank,
  passiveTriggers,
  resolveSustainedFire,
  headerCostAtRank,
  parseTooltipDamageParts,
  resolveDamageProfile,
  resolveExecuteThreshold,
  resolveSpellSustain,
} from '../theorycraftSpellDamage'

const urgotPassive = {
  tooltipRaw:
    'Attacks fire the leg cannon for <physicalDamage>{{ ADDamage }} plus {{ PercentHPRatio }} max Health physical damage</physicalDamage>. This effect has a {{ PerLegCD }} second Cooldown per leg.',
  calculations: [
    { key: 'perlegcd', baseValues: [30, 30, 10, 2.5, 2.5], ratios: [] },
    {
      key: 'addamage',
      baseValues: [],
      ratios: [{ stat: 'totalAD', coefficient: [0.4, 0.4, 0.64, 0.88, 1], type: 'physical' }],
    },
    { key: 'percenthpratio', baseValues: [2, 2, 4, 6, 6], ratios: [], displayAsPercent: true },
    { key: 'monstercap', baseValues: [100, 161, 222, 283, 344], ratios: [] },
  ],
  dataValues: [],
}

const chogathR = {
  tooltipRaw:
    'dealing <trueDamage>{{ rdamage }} true damage</trueDamage> to champions or <trueDamage>{{ rmonsterdamage }}</trueDamage> to minions.',
  calculations: [
    {
      key: 'rmonsterdamage',
      baseValues: [1200, 1200, 1200],
      ratios: [{ stat: 'AP', coefficient: [0.5], type: 'magic' }],
    },
    {
      key: 'rdamage',
      baseValues: [300, 475, 650],
      ratios: [
        { stat: 'AP', coefficient: [0.5], type: 'magic' },
        { stat: 'bonusHP', coefficient: [0.1], type: 'magic' },
      ],
    },
  ],
  dataValues: [],
}

const garenR = {
  tooltipRaw:
    'dealing <trueDamage>{{ basedamage }} plus {{ executedamage*100 }}% missing Health true damage</trueDamage>.',
  calculations: [],
  dataValues: [
    { name: 'BaseDamage', values: [125, 200, 275] },
    { name: 'ExecuteDamage', values: [0.25, 0.3, 0.35] },
  ],
}

const stats: Record<string, number> = { totalAD: 200, AP: 100, bonusHP: 1000 }
const statValue = (stat: string) => stats[stat] ?? 0

describe('parseTooltipDamageParts', () => {
  it('reads flat and % max health parts with their tag type', () => {
    expect(parseTooltipDamageParts(urgotPassive.tooltipRaw)).toEqual([
      { key: 'addamage', type: 'physical', scaling: 'flat', fraction: false },
      { key: 'percenthpratio', type: 'physical', scaling: 'maxHp', fraction: false },
    ])
  })

  it('ignores monster and minion damage', () => {
    expect(parseTooltipDamageParts(chogathR.tooltipRaw)).toEqual([
      { key: 'rdamage', type: 'true', scaling: 'flat', fraction: false },
    ])
  })

  it('reads missing health parts written as *100', () => {
    expect(parseTooltipDamageParts(garenR.tooltipRaw)).toEqual([
      { key: 'basedamage', type: 'true', scaling: 'flat', fraction: false },
      { key: 'executedamage', type: 'true', scaling: 'missingHp', fraction: true },
    ])
  })

  it('keeps the same key twice when the damage type differs', () => {
    const tooltip =
      '<magicDamage>{{ totaldamage }} magic damage</magicDamage> out and <trueDamage>{{ totaldamage }} true damage</trueDamage> back.'
    expect(parseTooltipDamageParts(tooltip).map(part => part.type)).toEqual(['magic', 'true'])
  })

  it('skips empowered alternatives ("increased to")', () => {
    const tooltip =
      'dealing <magicDamage>{{ totaldamage }} magic damage</magicDamage>, increased to <magicDamage>{{ critdamage }}</magicDamage> below 30% Health.'
    expect(parseTooltipDamageParts(tooltip).map(part => part.key)).toEqual(['totaldamage'])
  })

  it('reads French health wording', () => {
    const tooltip =
      '<physicalDamage>{{ a }} plus {{ b }} des PV max en dégâts physiques</physicalDamage>'
    expect(parseTooltipDamageParts(tooltip)[1]?.scaling).toBe('maxHp')
  })

  it('returns nothing without damage tags', () => {
    expect(parseTooltipDamageParts('Gain {{ bonusms }} Move Speed')).toEqual([])
  })
})

describe('resolveDamageProfile + evaluateDamageProfile', () => {
  it('Urgot passive: 200 AD at rank 5 = 200 + 6% max HP physical', () => {
    const parts = parseTooltipDamageParts(urgotPassive.tooltipRaw)
    const profile = resolveDamageProfile(urgotPassive, parts, 4, statValue)
    const split = evaluateDamageProfile(profile, { maxHp: 2000, currentHp: 2000 })
    expect(split.physical).toBeCloseTo(200 + 120)
    expect(split.magic).toBe(0)
  })

  it("Cho'Gath R is true damage, monster damage excluded", () => {
    const parts = parseTooltipDamageParts(chogathR.tooltipRaw)
    const profile = resolveDamageProfile(chogathR, parts, 2, statValue)
    const split = evaluateDamageProfile(profile, { maxHp: 2000, currentHp: 2000 })
    expect(split.true).toBeCloseTo(650 + 50 + 100)
    expect(split.magic).toBe(0)
  })

  it('Garen R scales with missing health from dataValues', () => {
    const parts = parseTooltipDamageParts(garenR.tooltipRaw)
    const profile = resolveDamageProfile(garenR, parts, 0, statValue)
    expect(evaluateDamageProfile(profile, { maxHp: 2000, currentHp: 2000 }).true).toBeCloseTo(125)
    expect(evaluateDamageProfile(profile, { maxHp: 2000, currentHp: 1000 }).true).toBeCloseTo(
      125 + 250
    )
  })

  it('current health parts use current health', () => {
    const source = {
      calculations: [{ key: 'pct', baseValues: [10], ratios: [] }],
      dataValues: [],
    }
    const profile = resolveDamageProfile(
      source,
      [{ key: 'pct', type: 'magic', scaling: 'currentHp', fraction: false }],
      0,
      statValue
    )
    expect(evaluateDamageProfile(profile, { maxHp: 2000, currentHp: 500 }).magic).toBeCloseTo(50)
  })
})

describe('resolveExecuteThreshold', () => {
  it('Urgot R executes under 25% max HP', () => {
    const source = { calculations: [], dataValues: [{ name: 'RHealthThreshold', values: [25] }] }
    expect(resolveExecuteThreshold('Urgot', 'R', source, 0, statValue, 2000)).toBe(500)
  })

  it('Pyke R threshold uses lethality for its AP-labelled ratio', () => {
    const source = {
      calculations: [
        {
          key: 'rdamage',
          baseValues: [250, 430, 530],
          ratios: [
            { stat: 'bonusAD', coefficient: [0.8], type: 'physical' },
            { stat: 'AP', coefficient: [1.5], type: 'magic' },
          ],
        },
      ],
      dataValues: [],
    }
    const lookup = (stat: string) => ({ bonusAD: 100, lethality: 20, AP: 999 })[stat] ?? 0
    expect(resolveExecuteThreshold('Pyke', 'R', source, 0, lookup, 2000)).toBeCloseTo(250 + 80 + 30)
  })

  it('AurelionSol E uses its % max HP threshold', () => {
    const source = {
      calculations: [{ key: 'currentexecutionthreshold', baseValues: [5], ratios: [] }],
      dataValues: [],
    }
    expect(resolveExecuteThreshold('AurelionSol', 'E', source, 0, statValue, 2000)).toBe(100)
  })

  it('returns null for spells without execute', () => {
    expect(resolveExecuteThreshold('Ahri', 'Q', chogathR, 0, statValue, 2000)).toBeNull()
  })
})

describe('headerCostAtRank', () => {
  it('picks the mana cost for the rank', () => {
    const header = [{ key: 'cost', valueText: '55 / 65 / 75 / 85 / 95 Mana' }]
    expect(headerCostAtRank(header, 3)).toBe(75)
    expect(headerCostAtRank(header, 9)).toBe(95)
  })

  it('reads a single value and ignores missing or free costs', () => {
    expect(headerCostAtRank([{ key: 'cost', valueText: '100 Mana' }], 2)).toBe(100)
    expect(headerCostAtRank([{ key: 'cost', valueText: 'No Cost' }], 1)).toBe(0)
    expect(headerCostAtRank(undefined, 1)).toBe(0)
  })

  it('ignores health costs (not a mana pool)', () => {
    expect(headerCostAtRank([{ key: 'cost', valueText: '10% current Health' }], 1)).toBe(0)
    expect(headerCostAtRank([{ key: 'cost', valueText: '50 PV' }], 1)).toBe(0)
  })
})

describe('resolveSpellSustain', () => {
  it('reads heal and shield tags, ignoring max Health gains', () => {
    const source = {
      tooltipRaw:
        'heals for <healing>{{ heal }} Health</healing>, gains <shield>{{ shieldvalue }} Shield</shield> and <healing>{{ hpperstack }} max Health</healing>.',
      calculations: [
        { key: 'heal', baseValues: [50, 80], ratios: [{ stat: 'AP', coefficient: [0.3] }] },
        { key: 'shieldvalue', baseValues: [100], ratios: [] },
        { key: 'hpperstack', baseValues: [80], ratios: [] },
      ],
      dataValues: [],
    }
    expect(resolveSpellSustain(source, 1, statValue)).toEqual({ heal: 80 + 30, shield: 100 })
  })

  it('returns zeros without sustain tags', () => {
    expect(resolveSpellSustain(chogathR, 0, statValue)).toEqual({ heal: 0, shield: 0 })
  })
})

describe('cooldowns', () => {
  const header = [{ key: 'cooldown', valueText: '12 / 9 / 6 / 3 / 0' }]

  it('reads the header cooldown at a rank, null without one', () => {
    expect(headerCooldownAtRank(header, 2)).toBe(9)
    expect(headerCooldownAtRank(header, 5)).toBe(0)
    expect(headerCooldownAtRank([{ key: 'cost', valueText: '40 Mana' }], 1)).toBeNull()
  })

  it('applies cooldown reduction (fraction), capped below 100%', () => {
    expect(cooldownAfterReduction(10, 0)).toBe(10)
    expect(cooldownAfterReduction(10, 0.5)).toBe(5)
    expect(cooldownAfterReduction(10, 2)).toBeCloseTo(0.1)
  })
})

describe('resolveSustainedFire', () => {
  const urgotW = {
    tooltipRaw: 'Attacks them {{ wattackspersecond }} times a second',
    tooltipDetailRaws: ['At max rank, this Ability can be <toggle>Toggled</toggle> on and off.'],
    calculations: [],
    dataValues: [
      { name: 'OnHitDamageReduction', values: [0.5, 0.5, 0.5, 0.5, 0.5] },
      { name: 'WAttacksPerSecond', values: [3, 3, 3, 3, 3] },
      { name: 'Duration', values: [4, 4, 4, 4, 25000] },
    ],
  }

  it('fires for its duration below max rank', () => {
    expect(resolveSustainedFire(urgotW, 0)).toEqual({
      shotsPerSecond: 3,
      duration: 4,
      toggle: false,
      onHitRatio: 0.5,
    })
  })

  it('becomes a toggle at max rank', () => {
    expect(resolveSustainedFire(urgotW, 4)?.toggle).toBe(true)
  })

  it('returns null for regular spells', () => {
    expect(resolveSustainedFire(chogathR, 0)).toBeNull()
  })
})

describe('passiveTriggers', () => {
  it('Urgot passive fires on attacks and W shots', () => {
    expect(passiveTriggers('Urgot')).toEqual({ attacks: true, spellSlots: ['W'] })
    expect(passiveTriggers('Ahri')).toBeNull()
  })
})
