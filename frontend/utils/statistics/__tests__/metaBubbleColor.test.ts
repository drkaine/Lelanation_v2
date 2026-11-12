import { describe, expect, it } from 'vitest'
import { metaBubbleColor } from '~/utils/statistics/metaBubbleColor'

describe('metaBubbleColor', () => {
  it('palette or de la maquette : S+ clair, S or, puis assombri', () => {
    expect(metaBubbleColor('S+')).toBe('#c8aa6e')
    expect(metaBubbleColor('S')).toBe('#b59a5f')
    expect(metaBubbleColor('A')).not.toBe(metaBubbleColor('B'))
  })

  it('tier inconnu : gris neutre', () => {
    expect(metaBubbleColor('?')).toBe('#5b5a56')
  })
})
