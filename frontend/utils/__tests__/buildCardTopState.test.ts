import { describe, expect, it } from 'vitest'
import type { Build } from '@lelanation/shared-types'
import { buildCardTopState } from '../buildCardTopState'

const build = (author: string, visibility: 'public' | 'private', teamShared = false) =>
  ({ author, visibility, teamShared }) as unknown as Build

describe('buildCardTopState', () => {
  it('carte active : lit le build courant et reste modifiable', () => {
    expect(buildCardTopState(null, build('Lela', 'private', true))).toEqual({
      author: 'Lela',
      visibility: 'private',
      teamShared: true,
      editable: true,
    })
  })

  it('carte inactive : lit son propre build, pas le build courant, et se verrouille', () => {
    expect(buildCardTopState(build('Rival', 'public'), build('Lela', 'private', true))).toEqual({
      author: 'Rival',
      visibility: 'public',
      teamShared: false,
      editable: false,
    })
  })

  it('sans build : valeurs par défaut', () => {
    expect(buildCardTopState(null, null)).toEqual({
      author: '',
      visibility: 'public',
      teamShared: false,
      editable: true,
    })
  })
})
