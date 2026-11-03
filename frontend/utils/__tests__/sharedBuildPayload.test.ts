import { describe, expect, it } from 'vitest'
import { sharedBuildPayload } from '../buildApi'

const build = {
  id: 'b1',
  name: 'Kayn jungle',
  champion: { id: 'Kayn', key: '141', name: 'Kayn', image: { full: 'Kayn.png' } },
  items: [],
  runes: null,
  shards: null,
  summonerSpells: [null, null],
  skillOrder: null,
  editSecret: 'secret',
  matchupGuideEmbed: true,
} as never

describe('sharedBuildPayload', () => {
  it('build d’équipe sans secret ni marqueur de guide embarqué', () => {
    const payload = sharedBuildPayload(build)
    expect(payload).toMatchObject({ id: 'b1', teamShared: true })
    expect(payload).not.toHaveProperty('editSecret')
    expect(payload.matchupGuideEmbed).toBeFalsy()
    expect(payload).not.toHaveProperty('matchupGuide')
  })

  it('joint le guide lié quand il y en a un', () => {
    const guide = { id: 'g1', buildId: 'b1', matchups: [] } as never
    expect(sharedBuildPayload(build, guide).matchupGuide).toEqual(guide)
  })
})
