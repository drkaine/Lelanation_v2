import { describe, it, expect } from 'vitest'
import {
  buildEntityPatchStats,
  buildPatchNotesStats,
} from '../../src/services/patchNotesStatsBuilder.js'
import type { PatchJson } from '../../src/scraper/types.js'

describe('PatchNotesStatsService', () => {
  it('counts nerf, buff and adjust lines per champion entity', () => {
    const row = buildEntityPatchStats(
      {
        name: 'Diana',
        category: 'champion',
        id: 'Diana',
        changes: [
          { stat: 'dmg', before: '1', after: '2', type: 'buff' },
          { stat: 'hp', before: '9%', after: '11%', type: 'buff' },
        ],
      },
      '16.11'
    )

    expect(row).toEqual({
      typeCible: 'champion',
      idCible: 'Diana',
      gameVersion: '16.11',
      countNerf: 0,
      countUp: 2,
      countAjust: 0,
    })
  })

  it('maps item and rune categories to plural type_cible', () => {
    const item = buildEntityPatchStats(
      {
        name: 'Trinity Force',
        category: 'item',
        id: '3078',
        changes: [{ stat: 'dmg', before: '4%', after: '3%', type: 'nerf' }],
      },
      '16.10'
    )
    const rune = buildEntityPatchStats(
      {
        name: 'Conqueror',
        category: 'rune',
        id: '8010',
        changes: [{ stat: 'stacks', before: '12', after: '10', type: 'adjustment' }],
      },
      '16.10'
    )

    expect(item?.typeCible).toBe('items')
    expect(rune?.typeCible).toBe('runes')
  })

  it('treats new changes as adjust and skips system entities', () => {
    const patch: PatchJson = {
      patchVersion: '16.11',
      locale: 'en-GB',
      scrapedAt: '2026-01-01T00:00:00.000Z',
      url: 'https://example.com',
      entities: [
        {
          name: 'Brand',
          category: 'champion',
          id: 'Brand',
          changes: [{ stat: 'armor', before: '27', after: '24', type: 'nerf' }],
        },
        {
          name: 'Arena',
          category: 'system',
          id: 'arena',
          changes: [{ stat: 'rule', before: 'a', after: 'b', type: 'adjustment' }],
        },
        {
          name: 'Heimerdinger',
          category: 'champion',
          id: 'Heimerdinger',
          changes: [{ stat: 'range', before: '(new)', after: 'bonus', type: 'new' }],
        },
      ],
    }

    const rows = buildPatchNotesStats(patch)
    expect(rows).toHaveLength(2)
    expect(rows.find(r => r.idCible === 'Brand')?.countNerf).toBe(1)
    expect(rows.find(r => r.idCible === 'Heimerdinger')?.countAjust).toBe(1)
  })
})
