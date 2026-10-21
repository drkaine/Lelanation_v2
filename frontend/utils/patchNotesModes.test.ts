import { describe, expect, it } from 'vitest'
import { resolvePatchContentTab } from './patchNotesModes'
import type { PatchEntity } from '~/stores/PatchNotesStore'

function modeEntity(category: PatchEntity['category'], subCategory: string): PatchEntity {
  return {
    name: 'x',
    category,
    subCategory,
    changes: [{ stat: 's', before: '1', after: '2', type: 'buff' }],
  } as PatchEntity
}

describe('resolvePatchContentTab', () => {
  it('augments_go_to_optimizations_tab_not_champions', () => {
    expect(resolvePatchContentTab(modeEntity('arena', 'Optimisations'), 'arena')).toBe(
      'optimizations'
    )
    expect(resolvePatchContentTab(modeEntity('aram-chaos', 'Augments'), 'aram-chaos')).toBe(
      'optimizations'
    )
  })

  it('champions_and_honored_guests_stay_in_champions_tab', () => {
    expect(resolvePatchContentTab(modeEntity('arena', 'Champions'), 'arena')).toBe('champions')
    expect(resolvePatchContentTab(modeEntity('arena', "Invités d'honneur"), 'arena')).toBe(
      'champions'
    )
  })
})
