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
  id: 'DefensiveBallCurl',
  slot: 'W',
  maxRank: 5,
  tooltipRaw: 'gagnant <scaleArmor>+{{ bonusarmortooltip }} armure</scaleArmor>',
  calculations: [
    {
      key: 'bonusarmortooltip',
      baseValues: [35.4, 44.375, 54.1, 64.575, 75.8],
      ratios: [],
    },
    {
      key: 'bonusmrtooltip',
      baseValues: [26.3, 34.75, 43.95, 53.9, 64.6],
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

  it('prefers tooltip calculations over raw dataValues (Rammus W)', () => {
    const bonuses = computeSpellBuffBonuses(rammusW, 1, baseStats, 18)
    const armor = bonuses.find(b => b.stat === 'armor')
    const mr = bonuses.find(b => b.stat === 'magicResist')
    expect(armor?.amount).toBeCloseTo(35.4, 1)
    expect(mr?.amount).toBeCloseTo(26.3, 1)
  })

  it('applies buffs when spell is active', () => {
    const result = applyTheorycraftSpellBuffs({
      stats: baseStats,
      spells: [rammusW],
      activeSpellIds: new Set(['DefensiveBallCurl']),
      spellRanks: { DefensiveBallCurl: 1 },
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
      spellRanks: { DefensiveBallCurl: 5 },
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

const aatroxR = {
  id: 'AatroxR',
  slot: 'R',
  maxRank: 3,
  tooltipRaw:
    "gagnant <speed>+{{ rmovementspeedbonus*100 }}% de vitesse de déplacement</speed> et <scaleAD>+{{ rtotaladamp*100 }}% de dégâts d'attaque</scaleAD>.",
  calculations: [],
  dataValues: [
    { name: 'RTotalADAmp', values: [0.2, 0.3, 0.4] },
    { name: 'RMovementSpeedBonus', values: [0.6, 0.8, 1] },
  ],
}

describe('Aatrox R World Ender buffs', () => {
  it('is activatable and applies percent AD and move speed at rank 3', () => {
    expect(spellHasActivatableBuff(aatroxR)).toBe(true)
    const bonuses = computeSpellBuffBonuses(aatroxR, 3, baseStats, 18)
    expect(bonuses.find(b => b.stat === 'attackDamage')?.amount).toBeCloseTo(48, 1)
    expect(bonuses.find(b => b.stat === 'movementSpeed')?.amount).toBeCloseTo(340, 1)
  })

  it('applies buffs when active', () => {
    const result = applyTheorycraftSpellBuffs({
      stats: baseStats,
      spells: [aatroxR],
      activeSpellIds: new Set(['AatroxR']),
      spellRanks: { AatroxR: 3 },
      level: 18,
      labels: {},
    })
    expect(result.stats.attackDamage).toBeGreaterThan(baseStats.attackDamage)
    expect(result.stats.movementSpeed).toBeGreaterThan(baseStats.movementSpeed)
    expect(result.lines.length).toBe(1)
  })
})

describe('activatable buff detection', () => {
  it('does not treat damage spells with scale ratios as activatable buffs', () => {
    const ahriQ = {
      id: 'AhriQ',
      slot: 'Q',
      maxRank: 5,
      tooltipRaw:
        'Inflige {{ Effect1Amount }} <scaleAP>(+{{ CharAbilityPower }})</scaleAP> pts de dégâts magiques.',
      calculations: [{ key: 'totaldamage', baseValues: [40, 65, 90, 115, 140], ratios: [] }],
      dataValues: [{ name: 'BaseDamage', values: [40, 65, 90, 115, 140] }],
    }
    expect(spellHasActivatableBuff(ahriQ)).toBe(false)
  })
})

const alistarR = {
  id: 'FerociousHowl',
  slot: 'R',
  maxRank: 3,
  tooltipRaw: 'réduit les dégâts de {{ RDamageReduction }}%',
  calculations: [],
  dataValues: [
    { name: 'RDuration', values: [7, 7, 7] },
    { name: 'RDamageReduction', values: [55, 65, 75] },
  ],
}

describe('Alistar R damage reduction', () => {
  it('detects as activatable', () => {
    expect(spellHasActivatableBuff(alistarR)).toBe(true)
  })

  it('computes 75% DR at rank 3', () => {
    const bonuses = computeSpellBuffBonuses(alistarR, 3, baseStats, 18)
    expect(bonuses).toHaveLength(1)
    expect(bonuses[0]!.stat).toBe('damageReduction')
    expect(bonuses[0]!.amount).toBeCloseTo(0.75)
  })

  it('applies DR multiplicatively', () => {
    const result = applyTheorycraftSpellBuffs({
      stats: baseStats,
      spells: [alistarR],
      activeSpellIds: new Set(['FerociousHowl']),
      spellRanks: { FerociousHowl: 3 },
      level: 18,
      labels: {},
    })
    expect(result.stats.damageReduction).toBeCloseTo(0.75)
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0]!.detail).toContain('75%')
  })
})
