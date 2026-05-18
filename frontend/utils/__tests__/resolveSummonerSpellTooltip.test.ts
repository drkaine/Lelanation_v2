import { describe, expect, it } from 'vitest'
import {
  pickSummonerSpellTemplate,
  resolveSummonerSpellTooltipText,
  substituteSummonerSpellVariables,
} from '../resolveSummonerSpellTooltip'

const barrier = {
  key: '21',
  description: 'Vous gagnez brièvement un bouclier.',
  tooltip:
    'Vous gagnez un bouclier de <shield>{{ shieldstrength }} PV</shield> pendant {{ shieldduration }} sec.',
}

describe('resolveSummonerSpellTooltip', () => {
  it('prefers tooltip when description has no numbers', () => {
    expect(pickSummonerSpellTemplate(barrier)).toBe(barrier.tooltip)
  })

  it('resolves barrier shield values', () => {
    const resolved = resolveSummonerSpellTooltipText(barrier)
    expect(resolved).toContain('100-460')
    expect(resolved).toContain('2.5')
    expect(resolved).not.toMatch(/\{\{/)
  })

  it('evaluates percent expressions', () => {
    const resolved = substituteSummonerSpellVariables(
      '{{ tenacityvalue*100 }}% for {{ tenacityduration }} sec',
      { key: '1' }
    )
    expect(resolved).toBe('75% for 3 sec')
  })

  it('uses plain description for flash', () => {
    const flash = {
      key: '4',
      description: 'Vous téléporte sur une courte distance.',
      tooltip: 'Vous téléporte sur une courte distance vers l emplacement de votre curseur.',
    }
    expect(pickSummonerSpellTemplate(flash)).toBe(flash.description)
  })
})
