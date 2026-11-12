import { describe, expect, it } from 'vitest'
import { championBuildsList } from '../championBuildsList'

type B = Parameters<typeof championBuildsList>[0][number]

function b(
  id: string,
  champ: string | null,
  updatedAt: string,
  visibility?: 'public' | 'private'
): B {
  return {
    id,
    champion: champ ? ({ id: champ } as B['champion']) : null,
    updatedAt,
    visibility,
  } as B
}

describe('championBuildsList', () => {
  it('keeps public builds of the champion, newest first', () => {
    const list = championBuildsList(
      [
        b('1', 'Graves', '2026-01-01'),
        b('2', 'Ahri', '2026-03-01'),
        b('3', 'graves', '2026-02-01'),
        b('4', 'Graves', '2026-04-01', 'private'),
        b('5', null, '2026-05-01'),
      ],
      'Graves'
    )
    expect(list.map(x => x.id)).toEqual(['3', '1'])
  })

  it('returns nothing without champion id', () => {
    expect(championBuildsList([b('1', 'Graves', '2026-01-01')], '')).toEqual([])
  })
})
