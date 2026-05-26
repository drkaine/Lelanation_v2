import { describe, expect, it } from 'vitest'
import {
  applyStackTooltipVariables,
  buildPassiveStackStatsProvider,
  computeStackStatBonuses,
  findStackDefinitionForSource,
  parseStackDefinitions,
  stackDamageBonusForCalculation,
} from '../theorycraftStacks'
import type { TheorycraftStackDefinition } from '~/types/theorycraft'

const veigarPassiveStack: TheorycraftStackDefinition = {
  id: 'passive',
  scope: 'passive',
  label: 'Phenomenal Evil Power',
  maxStacks: 9999,
  statBonuses: [{ stat: 'abilityPower', perStackKey: 'apperstack' }],
  tooltipVars: [],
}

const belvethPassiveStack: TheorycraftStackDefinition = {
  id: 'passive',
  scope: 'passive',
  label: 'Death in Lavender',
  maxStacks: 9999,
  statBonuses: [{ stat: 'attackSpeed', perStackKey: 'attackspeedperstack', isPercent: true }],
  tooltipVars: [{ key: 'totalattackspeedfromstacks', perStackKey: 'attackspeedperstack' }],
}

describe('theorycraftStacks', () => {
  it('adds AP from Veigar passive stacks', () => {
    const calculations = [{ key: 'apperstack', baseValues: [1, 1, 1, 1, 1], ratios: [] }]
    const bonuses = computeStackStatBonuses(veigarPassiveStack, calculations, 500, 0)
    expect(bonuses.abilityPower).toBe(500)
  })

  it('builds passive stack stats provider for calculateStats', () => {
    const calculationsBySource = {
      passive: [{ key: 'apperstack', baseValues: [1], ratios: [] }],
    }
    const provider = buildPassiveStackStatsProvider([veigarPassiveStack], calculationsBySource, 0)
    expect(provider('Veigar', 'passive', 120)).toEqual({ abilityPower: 120 })
  })

  it('resolves Belveth total attack speed tooltip variable from stacks', () => {
    const calculations = [
      { key: 'attackspeedperstack', baseValues: [0.28, 0.5, 0.72, 0.94, 1.1], ratios: [] },
    ]
    const setVars = new Map<string, string>()
    applyStackTooltipVariables(
      (key, value) => setVars.set(key.toLowerCase(), value),
      belvethPassiveStack,
      calculations,
      10,
      0,
      (value: number) => String(Math.round(value * 100) / 100)
    )
    expect(setVars.get('totalattackspeedfromstacks')).toBe('2.8')
  })

  it('resolves Cho Gath feast minion stack count and total HP tooltip vars', () => {
    const feastStack: TheorycraftStackDefinition = {
      id: 'Feast',
      scope: 'spell',
      spellSlot: 'R',
      label: 'Feast',
      maxStacks: 9999,
      statBonuses: [{ stat: 'health', perStackKey: 'RHealthPerStack' }],
      tooltipVars: [{ key: 'f1', perStackKey: 'RHealthPerStack' }],
    }
    const calculations = [{ key: 'RHealthPerStack', baseValues: [40, 80, 120], ratios: [] }]
    const dataValues = [{ name: 'RMinionMaxStacks', values: [6, 6, 6] }]
    const setVars = new Map<string, string>()
    applyStackTooltipVariables(
      (key, value) => setVars.set(key.toLowerCase(), value),
      feastStack,
      calculations,
      8,
      2,
      (value: number) => String(value),
      dataValues
    )
    expect(setVars.get('f1')).toBe('960')
    expect(setVars.get('f3')).toBe('6')
  })

  it('infers Cho Gath R feast stacks from RHealthPerStack dataValues', () => {
    const champion = {
      spells: [
        {
          id: 'Feast',
          slot: 'R',
          name: 'Feast',
          dataValues: [{ name: 'RHealthPerStack', values: [40, 80, 120] }],
          calculations: [
            { key: 'RDamage', baseValues: [300, 475, 650], ratios: [] },
            { key: 'RMonsterDamage', baseValues: [300, 475, 650], ratios: [] },
          ],
        },
      ],
    }
    const definitions = parseStackDefinitions(champion)
    const feastDef = definitions.find(def => def.id === 'Feast')
    expect(feastDef?.statBonuses).toEqual([{ stat: 'health', perStackKey: 'RHealthPerStack' }])
    expect(feastDef?.tooltipVars).toEqual([{ key: 'f1', perStackKey: 'RHealthPerStack' }])

    const provider = buildPassiveStackStatsProvider(
      definitions,
      {
        Feast: [{ key: 'RHealthPerStack', baseValues: [40, 80, 120], ratios: [] }],
        R: [{ key: 'RHealthPerStack', baseValues: [40, 80, 120], ratios: [] }],
      },
      0,
      { Feast: 2 }
    )
    expect(provider('Chogath', 'Feast', 6)).toEqual({ health: 480 })
  })

  it('finds stack definition by passive or spell source', () => {
    const spellStack: TheorycraftStackDefinition = {
      id: 'NasusQ',
      scope: 'spell',
      spellSlot: 'Q',
      label: 'Siphoning Strike',
      statBonuses: [],
      tooltipVars: [],
    }
    const definitions = [veigarPassiveStack, spellStack]
    expect(findStackDefinitionForSource(definitions, { scope: 'passive' })?.id).toBe('passive')
    expect(findStackDefinitionForSource(definitions, { scope: 'spell', slot: 'Q' })?.id).toBe(
      'NasusQ'
    )
  })

  it('infers Nasus Q stack definition from spell dataValues', () => {
    const champion = {
      stackDefinitions: [null],
      spells: [
        {
          id: 'NasusQ',
          slot: 'Q',
          name: 'Siphoning Strike',
          dataValues: [{ name: 'BasicStacks', values: [3, 3, 3, 3, 3] }],
          calculations: [{ key: 'totaldamage', baseValues: [40, 60, 80, 100, 120], ratios: [] }],
        },
      ],
    }
    const definitions = parseStackDefinitions(champion)
    expect(definitions.some(def => def.id === 'NasusQ')).toBe(true)
    const bonus = stackDamageBonusForCalculation(
      'totaldamage',
      {
        definition: definitions.find(def => def.id === 'NasusQ')!,
        stackCount: 100,
        calculationsBySource: {
          NasusQ: [
            { key: 'basicstacks', baseValues: [3, 3, 3, 3, 3], ratios: [] },
            { key: 'totaldamage', baseValues: [40, 60, 80, 100, 120], ratios: [] },
          ],
        },
      },
      0
    )
    expect(bonus).toBe(300)
  })
})
