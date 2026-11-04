import { describe, expect, it } from 'vitest'
import { progressionReferenceVersion } from '../progressionReference'

const versions = [
  { version: '16.22', matchCount: 93 },
  { version: '16.21', matchCount: 51929 },
  { version: '16.20', matchCount: 45565 },
  { version: '16.19', matchCount: 89823 },
]

describe('progressionReferenceVersion', () => {
  it('sans filtre, ignore le patch trop récent et maigre', () => {
    expect(progressionReferenceVersion(versions, '')).toBe('16.20')
  })
  it('avec filtre, prend le patch précédent qui a des données', () => {
    expect(progressionReferenceVersion(versions, '16.21')).toBe('16.20')
  })
  it('ne prend jamais un patch plus récent que le filtre', () => {
    expect(progressionReferenceVersion(versions, '16.20')).toBe('16.19')
  })
  it('saute un patch précédent quasi vide', () => {
    const list = [
      { version: '16.21', matchCount: 50000 },
      { version: '16.20', matchCount: 12 },
      { version: '16.19', matchCount: 40000 },
    ]
    expect(progressionReferenceVersion(list, '16.21')).toBe('16.19')
  })
  it('liste non triée', () => {
    expect(progressionReferenceVersion([...versions].reverse(), '16.21')).toBe('16.20')
  })
  it('un seul patch : lui-même ; vide : null', () => {
    expect(progressionReferenceVersion([{ version: '16.21', matchCount: 10 }], '')).toBe('16.21')
    expect(progressionReferenceVersion([], '')).toBeNull()
  })
  it('filtre sur le plus ancien patch : null', () => {
    expect(progressionReferenceVersion(versions, '16.19')).toBeNull()
  })
})
