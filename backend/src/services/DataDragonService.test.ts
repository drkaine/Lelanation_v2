import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DataDragonService } from './DataDragonService.js'

describe('DataDragonService item stats enrichment', () => {
  it('fills missing stats from FR description', () => {
    const service = new DataDragonService()
    const items = {
      '1004': {
        name: 'Charme feerique',
        description:
          '<mainText><stats><attention>+50%</attention> de regeneration de base du mana</stats><br><br></mainText>',
        stats: {},
        maps: { '11': true },
      },
      '1011': {
        name: 'Ceinture du geant',
        description: '<mainText><stats><attention>+350</attention> PV</stats><br><br></mainText>',
        stats: {},
        maps: { '11': true },
      },
      '9999': {
        name: 'Item multi',
        description:
          '<mainText><stats><attention>+40</attention> degats d attaque</stats><br><stats><attention>+12%</attention> vitesse d attaque</stats><br><stats><attention>+20</attention> acceleration de competence</stats><br><stats><attention>+30%</attention> de tenacite</stats><br><stats><attention>15</attention> lethalite</stats><br><stats><attention>+30%</attention> de degats de coup critique</stats><br><stats><attention>+10%</attention> d omnivampirisme</stats><br><stats><attention>+8%</attention> de vol de sort</stats></mainText>',
        stats: {},
        maps: { '11': true },
      },
    } as any

    const cleaned = (service as any).cleanItemsData(items) as Record<string, any>

    assert.equal(cleaned['1004'].stats.PercentMPRegenMod, 50)

    const frHeal = {
      heal: {
        name: 'Diademe',
        description:
          '<mainText><stats><attention>+10%</attention> d\'efficacité des soins et boucliers<br><attention>+125%</attention> de régénération de base du mana</stats></mainText>',
        stats: {},
        maps: { '11': true },
      },
    } as any
    const frHealCleaned = (service as any).cleanItemsData(frHeal) as Record<string, any>
    assert.equal(frHealCleaned.heal.stats.PercentHealShieldPower, 10)
    assert.equal(frHealCleaned.heal.stats.PercentMPRegenMod, 125)

    const enMana = {
      idol: {
        name: 'Forbidden Idol',
        description:
          '<mainText><stats><attention>50%</attention> Base Mana Regen<br><attention>8%</attention> Heal and Shield Power</stats><br><br></mainText>',
        stats: {},
        maps: { '11': true },
      },
    } as any
    const enManaCleaned = (service as any).cleanItemsData(enMana) as Record<string, any>
    assert.equal(enManaCleaned.idol.stats.PercentMPRegenMod, 50)
    assert.equal(enManaCleaned.idol.stats.PercentHealShieldPower, 8)
    assert.equal(cleaned['1011'].stats.FlatHPPoolMod, 350)
    assert.equal(cleaned['9999'].stats.FlatPhysicalDamageMod, 40)
    assert.equal(cleaned['9999'].stats.PercentAttackSpeedMod, 12)
    assert.equal(cleaned['9999'].stats.rFlatCooldownModPerLevel, 20)
    assert.equal(cleaned['9999'].stats.PercentTenacity, 30)
    assert.equal(cleaned['9999'].stats.FlatLethality, 15)
    assert.equal(cleaned['9999'].stats.FlatCritDamageMod, 30)
    assert.equal(cleaned['9999'].stats.PercentOmnivamp, 10)
    assert.equal(cleaned['9999'].stats.PercentSpellVampMod, 8)
    assert.equal(cleaned['1004'].maps, undefined)
  })

  it('parses passive gold / 10 s and copies from effect for GoldPer items', () => {
    const service = new DataDragonService()
    const items = {
      '3869': {
        name: 'Support',
        description:
          '<mainText><stats><attention>+9</attention> PO toutes les 10 sec</stats></mainText>',
        stats: {},
        maps: { '11': true },
      },
      '3860': {
        name: 'Relic',
        description: '',
        stats: { FlatHPPoolMod: 30 },
        tags: ['GoldPer'],
        effect: { Effect1Amount: '3' },
        maps: { '11': true },
      },
    } as any

    const cleaned = (service as any).cleanItemsData(items) as Record<string, any>
    assert.equal(cleaned['3869'].stats.GoldPer10, 9)
    assert.equal(cleaned['3860'].stats.GoldPer10, 3)
    assert.equal(cleaned['3860'].stats.FlatHPPoolMod, 30)
  })

  it('does not overwrite existing stat keys', () => {
    const service = new DataDragonService()
    const items = {
      '2000': {
        name: 'Test',
        description: '<mainText><stats><attention>+300</attention> PV</stats></mainText>',
        stats: { FlatHPPoolMod: 250 },
      },
    } as any

    const cleaned = (service as any).cleanItemsData(items) as Record<string, any>
    assert.equal(cleaned['2000'].stats.FlatHPPoolMod, 250)
  })
})
