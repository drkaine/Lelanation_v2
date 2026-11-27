import { describe, expect, it } from 'vitest'
import { resolveSpellTooltipBodyHtml } from './gameTooltipFormatter'
import { resolveSummonerSpellTooltipText } from './resolveSummonerSpellTooltip'

describe('tooltips : JSON sans descriptionParsed / parsedText', () => {
  it('sort spell : descriptionHtml seul suffit', () => {
    const html = resolveSpellTooltipBodyHtml({
      key: 'AhriQ',
      descriptionHtml: '<span class="dmg-magic">40 dégâts</span>',
    })
    expect(html).toContain('40 dégâts')
  })

  it('sort spell : descriptionText en repli', () => {
    expect(
      resolveSpellTooltipBodyHtml({ key: 'AhriQ', descriptionText: 'Lance un orbe' })
    ).toContain('Lance un orbe')
  })

  it('sort d’invocateur : descriptionHtml lu tel quel', () => {
    expect(
      resolveSummonerSpellTooltipText({ id: 'SummonerFlash', descriptionHtml: 'Téléporte' })
    ).toBe('Téléporte')
  })
})
