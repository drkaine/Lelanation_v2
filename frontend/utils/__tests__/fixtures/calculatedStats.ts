import type { CalculatedStats } from '@lelanation/shared-types'

/** Complete CalculatedStats with neutral values; tests override only what they exercise. */
export function makeCalculatedStats(overrides: Partial<CalculatedStats> = {}): CalculatedStats {
  return {
    health: 0,
    mana: 0,
    attackDamage: 0,
    abilityPower: 0,
    armor: 0,
    magicResist: 0,
    attackSpeed: 0.625,
    critChance: 0,
    critDamage: 2,
    lifeSteal: 0,
    spellVamp: 0,
    cooldownReduction: 0,
    movementSpeed: 340,
    healthRegen: 0,
    manaRegen: 0,
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
    ...overrides,
  }
}
