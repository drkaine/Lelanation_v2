import { describe, expect, it } from 'vitest'
import { teamBuildGuides } from '../sharedBuildSync'

describe('teamBuildGuides', () => {
  it('extrait le guide de chaque build d’équipe, lié à son build', () => {
    const guides = teamBuildGuides([
      { id: 'b1', matchupGuide: { id: 'g1', buildId: 'old', matchups: [] } },
      { id: 'b2' },
      { id: 'b3', matchupGuide: { buildId: 'b3' } },
      null,
    ])
    expect(guides).toHaveLength(1)
    expect(guides[0]?.id).toBe('g1')
    expect(guides[0]?.buildId).toBe('b1')
  })

  it('vide si la réponse n’est pas une liste', () => {
    expect(teamBuildGuides(undefined)).toEqual([])
  })
})
