import { describe, expect, it } from 'vitest'
import {
  formatItemTooltipHtml,
  formatRuneTooltipHtml,
  formatShardTooltipHtml,
  formatTooltipMarkupHtml,
} from '../formatTooltipMarkupHtml'
import { formatSummonerSpellTooltipHtml } from '../gameTooltipFormatter'

describe('formatItemTooltipHtml', () => {
  it('colorizes item stat values by label (FR)', () => {
    const html = formatItemTooltipHtml(
      "<mainText><stats><attention>+40</attention> dégâts d'attaque<br><attention>+350</attention> PV</stats></mainText>"
    )
    expect(html).toContain('attention scale-ad')
    expect(html).toContain('attention scale-hp')
    expect(html).not.toContain('<stats>')
  })

  it('maps gold per 10 and quest gold lines', () => {
    const html = formatItemTooltipHtml(
      '<mainText><stats><attention>+3</attention> PO toutes les 10 sec</stats><br>Gagnez <keywordMajor>400</keywordMajor> PO grâce à cet objet pour le transformer en <rarityGeneric>Boussole runique</rarityGeneric>.</mainText>'
    )
    expect(html).toContain('attention gold')
    expect(html).toContain('keyword-major')
    expect(html).toContain('rarity-generic')
  })
})

describe('formatShardTooltipHtml', () => {
  it('colorizes adaptive shard description (FR)', () => {
    const html = formatShardTooltipHtml("+5.4 Dégâts d'attaque ou +9 Puissance magique")
    expect(html).toContain('scale-ad')
    expect(html).toContain('scale-ap')
  })

  it('colorizes attack speed and ability haste (EN)', () => {
    expect(formatShardTooltipHtml('+10% Attack Speed')).toContain('class="speed"')
    expect(formatShardTooltipHtml('+8 Ability Haste')).toContain('class="stat-haste"')
  })
})

describe('formatTooltipMarkupHtml adaptive tags', () => {
  it('wraps adaptive font color and lol-uikit keywords', () => {
    const raw =
      "Inflige des <lol-uikit-tooltipped-keyword key='LinkTooltip_Description_AdaptiveDmg'><font color='#48C4B7'>dégâts adaptatifs</font></lol-uikit-tooltipped-keyword>."
    const html = formatTooltipMarkupHtml(raw)
    expect(html).toContain('stat-adaptive')
    expect(html).not.toContain('<font')
  })
})

describe('formatRuneTooltipHtml', () => {
  it('colors speed tags in rune descriptions', () => {
    const html = formatRuneTooltipHtml({
      longDesc: 'Vous gagnez <speed>+10 vitesse de déplacement</speed>.',
    })
    expect(html).toContain('class="speed"')
  })
})

describe('formatSummonerSpellTooltipHtml meta colors', () => {
  it('adds cooldown class to meta values', () => {
    const html = formatSummonerSpellTooltipHtml({
      name: 'Ignite',
      cooldownBurn: '180',
      tooltip:
        'Inflige <trueDamage>{{ tooltiptruedamagecalculation }} pts de dégâts bruts</trueDamage>.',
      effect: [[0, 0, 0]],
      datavalues: {},
    })
    expect(html).toContain('tooltip-meta-cooldown')
    expect(html).toContain('dmg-true')
  })
})
