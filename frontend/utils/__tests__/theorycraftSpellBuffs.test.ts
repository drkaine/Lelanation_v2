import { describe, expect, it } from 'vitest'
import type { CalculatedStats } from '@lelanation/shared-types'
import {
  applyTheorycraftSpellBuffs,
  computeSpellBuffBonuses,
  spellHasActivatableBuff,
} from '../theorycraftSpellBuffs'

const baseStats: CalculatedStats = {
  health: 2000,
  mana: 800,
  attackDamage: 120,
  abilityPower: 0,
  armor: 100,
  magicResist: 60,
  attackSpeed: 1,
  critChance: 0,
  critDamage: 1.75,
  lifeSteal: 0,
  spellVamp: 0,
  cooldownReduction: 0,
  movementSpeed: 340,
  healthRegen: 5,
  manaRegen: 5,
  armorPenetration: 0,
  flatArmorPenetration: 0,
  magicPenetration: 0,
  flatMagicPenetration: 0,
  tenacity: 0,
  lethality: 0,
  percentLethality: 0,
  omnivamp: 0,
  shield: 0,
  healShieldPower: 0,
  attackRange: 125,
  goldPer10: 0,
}

const rammusW = {
  id: 'PowerBallDefense',
  slot: 'W',
  maxRank: 5,
  tooltipRaw: 'gagnant <scaleArmor>+{{ bonusarmortooltip }} armure</scaleArmor>',
  calculations: [
    {
      key: 'bonusarmortooltip',
      baseValues: [35, 44, 54, 64, 75],
      ratios: [],
    },
    {
      key: 'bonusmrtooltip',
      baseValues: [26, 34, 43, 53, 64],
      ratios: [],
    },
  ],
  dataValues: [
    { name: 'FlatBonusArmor', values: [27, 32, 37, 42, 47] },
    { name: 'BonusArmorPercent', values: [0.3, 0.375, 0.45, 0.525, 0.6] },
    { name: 'FlatBonusMR', values: [20, 25, 30, 35, 40] },
    { name: 'BonusMRPercent', values: [0.3, 0.375, 0.45, 0.525, 0.6] },
  ],
}

describe('theorycraftSpellBuffs', () => {
  it('detects Rammus W as activatable buff', () => {
    expect(spellHasActivatableBuff(rammusW)).toBe(true)
  })

  it('computes armor and MR from dataValues at rank 5', () => {
    const bonuses = computeSpellBuffBonuses(rammusW, 5, baseStats, 18)
    const armor = bonuses.find(b => b.stat === 'armor')
    const mr = bonuses.find(b => b.stat === 'magicResist')
    expect(armor?.amount).toBeCloseTo(47 + 0.6 * 100, 1)
    expect(mr?.amount).toBeCloseTo(40 + 0.6 * 60, 1)
  })

  it('applies buffs when spell is active', () => {
    const result = applyTheorycraftSpellBuffs({
      stats: baseStats,
      spells: [rammusW],
      activeSpellIds: new Set(['PowerBallDefense']),
      spellRanks: { PowerBallDefense: 5 },
      level: 18,
      labels: {},
    })
    expect(result.stats.armor).toBeGreaterThan(baseStats.armor)
    expect(result.stats.magicResist).toBeGreaterThan(baseStats.magicResist)
    expect(result.lines.length).toBe(1)
  })

  it('does not apply when spell inactive', () => {
    const result = applyTheorycraftSpellBuffs({
      stats: baseStats,
      spells: [rammusW],
      activeSpellIds: new Set(),
      spellRanks: { PowerBallDefense: 5 },
      level: 18,
      labels: {},
    })
    expect(result.stats.armor).toBe(baseStats.armor)
    expect(result.lines.length).toBe(0)
  })
})

const nasusR = {
  id: 'NasusR',
  slot: 'R',
  maxRank: 3,
  tooltipRaw:
    'augmentant ses <healing>PV max de {{ bonushealth }}</healing> et son <scaleArmor>armure</scaleArmor> et sa <scaleMR>résistance magique</scaleMR> de {{ initialresistgain }}.',
  calculations: [{ key: 'damagecalc', baseValues: [0.03, 0.04, 0.05], ratios: [] }],
  dataValues: [
    { name: 'BonusHealth', values: [300, 450, 600] },
    { name: 'InitialResistGain', values: [40, 55, 70] },
  ],
}

describe('Nasus R sandstorm buffs', () => {
  it('applies +600 HP and +70 armor/MR at rank 3', () => {
    const result = applyTheorycraftSpellBuffs({
      stats: baseStats,
      spells: [nasusR],
      activeSpellIds: new Set(['NasusR']),
      spellRanks: { NasusR: 3 },
      level: 18,
      labels: {},
    })
    expect(result.stats.health).toBe(baseStats.health + 600)
    expect(result.stats.armor).toBe(baseStats.armor + 70)
    expect(result.stats.magicResist).toBe(baseStats.magicResist + 70)
    expect(result.lines[0]?.detail).toContain('600')
    expect(result.lines[0]?.detail).toContain('70')
  })
})
