import { describe, expect, it } from 'vitest'
import type { Build } from '@lelanation/shared-types'
import { buildPickerList } from '../buildPickerTabs'

const b = (id: string, name: string, author: string, champion: string, updatedAt = '') =>
  ({ id, name, author, champion: { id: champion, name: champion }, updatedAt }) as unknown as Build

const saved = [
  b('s1', 'Mon Ahri', 'Moi', 'Ahri', '2026-02'),
  b('s2', 'Tank', 'Moi', 'Ornn', '2026-03'),
]
const discovery = [b('d1', 'One shot', 'Lelariva', 'Zed'), b('s1', 'Mon Ahri', 'Moi', 'Ahri')]
const sources = { saved, discovery, favoriteIds: ['d1', 's2'] }

describe('buildPickerList', () => {
  it('mes builds : les builds sauvegardés, plus récents d’abord', () => {
    expect(buildPickerList('mine', sources, '').map(x => x.id)).toEqual(['s2', 's1'])
  })

  it('découvrir : les builds publics', () => {
    expect(buildPickerList('discover', sources, '').map(x => x.id)).toEqual(['d1', 's1'])
  })

  it('favoris : dans l’ordre des favoris, sauvegardés ou publics', () => {
    expect(buildPickerList('favorites', sources, '').map(x => x.id)).toEqual(['d1', 's2'])
  })

  it('recherche sur le titre, l’auteur et le champion, sans accents ni casse', () => {
    expect(buildPickerList('discover', sources, 'zed').map(x => x.id)).toEqual(['d1'])
    expect(buildPickerList('discover', sources, 'LELARIVA').map(x => x.id)).toEqual(['d1'])
    expect(buildPickerList('mine', sources, 'tank').map(x => x.id)).toEqual(['s2'])
  })
})
