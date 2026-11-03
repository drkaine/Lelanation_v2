import { describe, expect, it } from 'vitest'
import { matchupGuideDetailPath } from '../matchupGuideSlug'

describe('matchupGuideDetailPath', () => {
  it('guide lié à un build : onglet guide de la page du build', () => {
    expect(matchupGuideDetailPath({ id: 'g1', author: 'jhkl l', buildId: 'b 1' })).toBe(
      '/builds/b%201?tab=guide'
    )
  })

  it('build embarqué sans buildId : même page build', () => {
    expect(matchupGuideDetailPath({ id: 'g1', build: { id: 'b2' } })).toBe('/builds/b2?tab=guide')
  })

  it('applique localePath au chemin, pas à la query', () => {
    expect(matchupGuideDetailPath({ id: 'g1', buildId: 'b3' }, path => `/en${path}`)).toBe(
      '/en/builds/b3?tab=guide'
    )
  })

  it('sans build réel (buildId = id du guide) : page guide', () => {
    expect(matchupGuideDetailPath({ id: 'g1', author: 'Jhkl L', buildId: 'g1' })).toBe(
      '/matchups/sheets/jhkl-l/g1'
    )
    expect(matchupGuideDetailPath({ id: 'g2' })).toBe('/matchups/sheets/anonymous/g2')
  })
})
