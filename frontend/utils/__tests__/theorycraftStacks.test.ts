import { describe, expect, it } from 'vitest'
import {
  applyStackTooltipVariables,
  buildPassiveStackStatsProvider,
  computeStackStatBonuses,
  findStackDefinitionForSource,
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
})
