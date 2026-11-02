import { describe, expect, it } from 'vitest'
import { filterStandaloneLibraryBuilds } from '../buildLibrary'

describe('filterStandaloneLibraryBuilds', () => {
  it('team_builds_are_not_in_my_builds', () => {
    const builds = [
      { id: 'a', matchupGuideEmbed: false },
      { id: 'b', teamShared: true },
      { id: 'c', matchupGuideEmbed: true },
    ]
    expect(filterStandaloneLibraryBuilds(builds).map(b => b.id)).toEqual(['a'])
  })
})
