import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CalculatedStats } from '@lelanation/shared-types'
import { computeSpellBuffBonuses, spellHasActivatableBuff } from '../theorycraftSpellBuffs'

const baseStats: CalculatedStats = {
  health: 2000,
  mana: 800,
  attackDamage: 200,
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

const championsDir = join(process.cwd(), 'public/data/game/16.10.1/fr_FR/champions')

describe('theorycraftSpellBuffs champion audit', () => {
  it('every activatable spell produces at least one stat bonus', () => {
    const files = readdirSync(championsDir).filter(
      file => file.endsWith('.json') && file !== 'index.json'
    )
    const broken: string[] = []

    for (const file of files) {
      const champ = JSON.parse(readFileSync(join(championsDir, file), 'utf8')).champion
      for (const spell of champ.spells ?? []) {
        if (!spellHasActivatableBuff(spell)) continue
        const maxRank = Math.max(1, Number(spell.maxRank ?? 5))
        const bonuses = computeSpellBuffBonuses(spell, maxRank, baseStats, 18)
        if (bonuses.length === 0) {
          broken.push(
            `${champ.id} ${spell.slot} (${spell.id}) calc=[${(spell.calculations ?? [])
              .map((c: { key: string }) => c.key)
              .join(', ')}] dv=[${(spell.dataValues ?? [])
              .map((d: { name: string }) => d.name)
              .join(', ')}]`
          )
        }
      }
    }

    expect(broken, broken.join('\n')).toEqual([])
  })
})
