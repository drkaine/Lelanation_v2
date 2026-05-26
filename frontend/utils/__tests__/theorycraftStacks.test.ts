import { describe, expect, it } from 'vitest'
import {
  applyStackTooltipVariables,
  buildPassiveStackStatsProvider,
  computeBardChimeTooltipVars,
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

  it('infers Aurelion Sol passive stack definition with tooltip scaling', () => {
    const champion = {
      passive: {
        name: 'Créateur cosmique',
        dataValues: [
          { name: 'QMaxHealthTrueDamagePerStack', values: [0.00031, 0.00031, 0.00031] },
          { name: 'BaseExecutionThreshold', values: [5, 5, 5] },
          { name: 'ExecutionGrowthPerBreakpoint', values: [0.026, 0.026, 0.026] },
        ],
        calculations: [
          { key: 'qpassivescaling', baseValues: [0.00031, 0.00031, 0.00031], ratios: [] },
          { key: 'epassivescalingexecute', baseValues: [0.026, 0.026, 0.026], ratios: [] },
        ],
      },
      spells: [],
    }
    const definitions = parseStackDefinitions(champion)
    const passiveDef = definitions.find(def => def.id === 'passive')
    expect(passiveDef).toBeDefined()
    expect(passiveDef!.scope).toBe('passive')
    expect(passiveDef!.label).toBe('Créateur cosmique')
    expect(passiveDef!.tooltipVars).toEqual(
      expect.arrayContaining([
        { key: 'qpassivescaling', perStackKey: 'qpassivescaling' },
        { key: 'epassivescalingexecute', perStackKey: 'epassivescalingexecute' },
      ])
    )
  })

  it('applies Aurelion Sol passive stack tooltip values', () => {
    const definition: TheorycraftStackDefinition = {
      id: 'passive',
      scope: 'passive',
      label: 'Créateur cosmique',
      maxStacks: 9999,
      statBonuses: [],
      tooltipVars: [
        { key: 'qpassivescaling', perStackKey: 'qpassivescaling' },
        { key: 'epassivescalingexecute', perStackKey: 'epassivescalingexecute' },
      ],
    }
    const calculations = [
      { key: 'qpassivescaling', baseValues: [0.00031], ratios: [] },
      { key: 'epassivescalingexecute', baseValues: [0.026], ratios: [] },
    ]
    const vars = new Map<string, string>()
    const fmt = (v: number) => String(Math.round(v * 10000) / 10000)
    applyStackTooltipVariables(
      (k, v) => vars.set(k.toLowerCase(), v),
      definition,
      calculations,
      100,
      0,
      fmt
    )
    expect(vars.get('f1')).toBe('100')
    expect(vars.get('qpassivescaling')).toBe('0.031')
    expect(vars.get('epassivescalingexecute')).toBe('2.6')
  })

  it('computes Aurelion Sol E/R area-to-radius formula vars', () => {
    const champion = {
      passive: {
        name: 'Créateur cosmique',
        dataValues: [
          { name: 'QMaxHealthTrueDamagePerStack', values: [0.00031] },
          { name: 'ExecutionGrowthPerBreakpoint', values: [0.026] },
        ],
        calculations: [
          { key: 'qpassivescaling', baseValues: [0.00031], ratios: [] },
          { key: 'epassivescalingexecute', baseValues: [0.026], ratios: [] },
        ],
      },
      spells: [
        { slot: 'Q', dataValues: [] },
        { slot: 'W', dataValues: [] },
        {
          slot: 'E',
          dataValues: [
            { name: 'StartingRadius', values: [275] },
            { name: 'OuterRadiusAreaPerStack', values: [900] },
          ],
        },
        {
          slot: 'R',
          dataValues: [
            { name: 'StartingRadius', values: [275] },
            { name: 'AreaPerPassiveStack', values: [900] },
          ],
        },
      ],
    }
    const definitions = parseStackDefinitions(champion)
    const passiveDef = definitions.find(def => def.id === 'passive')!
    expect(passiveDef.formulaVars).toHaveLength(2)
    expect(passiveDef.formulaVars![0].key).toBe('f3')
    expect(passiveDef.formulaVars![1].key).toBe('f4')

    const vars = new Map<string, string>()
    applyStackTooltipVariables(
      (k, v) => vars.set(k.toLowerCase(), v),
      passiveDef,
      [
        { key: 'qpassivescaling', baseValues: [0.00031], ratios: [] },
        { key: 'epassivescalingexecute', baseValues: [0.026], ratios: [] },
      ],
      100,
      0,
      v => String(v)
    )
    expect(Number(vars.get('f3'))).toBeCloseTo(17.4, 0)
    expect(Number(vars.get('f4'))).toBeCloseTo(17.4, 0)
  })

  it('infers Bard passive stack definition from champion ID', () => {
    const champion = {
      id: 'Bard',
      passive: { name: 'Instinct du voyageur', dataValues: [], calculations: [] },
      spells: [],
    }
    const definitions = parseStackDefinitions(champion)
    const passiveDef = definitions.find(def => def.id === 'passive')
    expect(passiveDef).toBeDefined()
    expect(passiveDef!.customVarsChampionId).toBe('Bard')
  })

  it('infers Ezreal passive max stacks from MaxStacks data value', () => {
    const champion = {
      id: 'Ezreal',
      passive: {
        name: 'Force grandissante',
        dataValues: [
          { name: 'AttackSpeedPerStack', values: [0.1, 0.1, 0.1, 0.1, 0.1] },
          { name: 'MaxStacks', values: [5, 5, 5, 5, 5] },
        ],
        calculations: [],
      },
      spells: [],
    }
    const definitions = parseStackDefinitions(champion)
    const passiveDef = definitions.find(def => def.id === 'passive')
    expect(passiveDef).toBeDefined()
    expect(passiveDef!.maxStacks).toBe(5)
    expect(passiveDef!.statBonuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stat: 'attackSpeed', perStackKey: 'AttackSpeedPerStack' }),
      ])
    )
  })

  it('computes Bard meep tooltip vars at various chime counts', () => {
    const fmt = (v: number) => String(v)
    const at0 = computeBardChimeTooltipVars(0, fmt)
    expect(at0.f1).toBe('35')
    expect(at0.f2).toBe('0')
    expect(at0.f4).toBe('1')
    expect(at0.f5).toBe('8')
    expect(at0.f10).toBe('0')

    const at25 = computeBardChimeTooltipVars(25, fmt)
    expect(at25.f1).toBe('85')
    expect(at25.f2).toBe('35')
    expect(at25.f4).toBe('2')
    expect(at25.f5).toBe('7')

    const at100 = computeBardChimeTooltipVars(100, fmt)
    expect(at100.f1).toBe('235')
    expect(at100.f2).toBe('75')
    expect(at100.f4).toBe('9')
    expect(at100.f5).toBe('4')
    expect(at100.f7).toBe('5')
    expect(at100.f11).toBe('10')
  })

  it('applies Bard chime vars via applyStackTooltipVariables', () => {
    const definition: TheorycraftStackDefinition = {
      id: 'passive',
      scope: 'passive',
      label: 'Instinct du voyageur',
      maxStacks: 9999,
      statBonuses: [],
      tooltipVars: [],
      customVarsChampionId: 'Bard',
    }
    const vars = new Map<string, string>()
    applyStackTooltipVariables(
      (k, v) => vars.set(k.toLowerCase(), v),
      definition,
      [],
      50,
      0,
      v => String(v)
    )
    expect(vars.get('f1')).toBe('135')
    expect(vars.get('f2')).toBe('45')
    expect(vars.get('f4')).toBe('4')
    expect(vars.get('f5')).toBe('6')
    expect(vars.get('f10')).toBe('50')
  })

  it('infers Senna passive AD per stack', () => {
    const champion = {
      passive: {
        name: 'Absolution',
        dataValues: [
          { name: 'ADPerStack', values: [0.75, 0.75] },
          { name: 'SoulDuration', values: [8, 8] },
        ],
        calculations: [],
      },
      spells: [],
    }
    const definitions = parseStackDefinitions(champion)
    const passiveDef = definitions.find(def => def.id === 'passive')
    expect(passiveDef).toBeDefined()
    expect(passiveDef!.statBonuses).toEqual([
      { stat: 'attackDamage', perStackKey: 'ADPerStack', isPercent: false },
    ])
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
