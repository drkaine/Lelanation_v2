import { describe, expect, it } from 'vitest'
import type { Champion } from '@lelanation/shared-types'
import { normalizeChampionDetail } from './ChampionsStore'

describe('normalizeChampionDetail (JSON champion sans doublons)', () => {
  const current: Champion = JSON.parse(JSON.stringify({ id: 'Ahri', name: 'Ahri', spells: [] }))
  const detail = {
    spells: [{ id: 'AhriQ', slot: 'Q', descriptionHtml: '<b>Q</b>', descriptionText: 'Q' }],
    passive: { name: 'P', descriptionHtml: '<i>P</i>', descriptionText: 'P' },
  }

  it('lit descriptionHtml / descriptionText, ne recrée pas descriptionParsed / parsedText', () => {
    const out = normalizeChampionDetail(detail, current, 'Ahri')
    const spell = JSON.parse(JSON.stringify(out.spells[0]))
    const passive = JSON.parse(JSON.stringify(out.passive))
    expect(spell.description).toBe('<b>Q</b>')
    expect(spell.descriptionText).toBe('Q')
    expect(passive.description).toBe('<i>P</i>')
    for (const o of [spell, passive]) {
      expect(o).not.toHaveProperty('descriptionParsed')
      expect(o).not.toHaveProperty('parsedText')
    }
  })
})
