import { afterEach, describe, expect, it, vi } from 'vitest'
import { filterStandaloneLibraryBuilds, isStandaloneLibraryBuild } from '../buildLibrary'

describe('filterStandaloneLibraryBuilds', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('team_builds_are_not_in_my_builds', () => {
    const builds = [
      { id: 'a', matchupGuideEmbed: false },
      { id: 'b', teamShared: true },
      { id: 'c', matchupGuideEmbed: true },
    ]
    expect(filterStandaloneLibraryBuilds(builds).map(b => b.id)).toEqual(['a'])
  })

  it('un build lié à un guide (sans copie embarquée) reste dans la bibliothèque', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => JSON.stringify([{ buildId: 'a' }]),
    })
    expect(filterStandaloneLibraryBuilds([{ id: 'a' }]).map(b => b.id)).toEqual(['a'])
    expect(isStandaloneLibraryBuild({ id: 'a' })).toBe(true)
  })
})
