import { describe, expect, it } from 'vitest'
import { championSsrStatsQuery, displayedPatch, withVersionQuery } from '../championVersionQuery'

describe('championSsrStatsQuery', () => {
  it('ajoute la version du filtre aux stats SSR', () => {
    expect(championSsrStatsQuery('16.21')).toBe('?otp=oui&version=16.21')
  })
  it('sans version : toutes versions', () => {
    expect(championSsrStatsQuery('')).toBe('?otp=oui')
  })
})

describe('withVersionQuery', () => {
  it('écrit la version et garde le reste', () => {
    expect(withVersionQuery({ tab: 'pings' }, '16.21')).toEqual({ tab: 'pings', version: '16.21' })
  })
  it('retire la version vide', () => {
    expect(withVersionQuery({ tab: 'pings', version: '16.22' }, '')).toEqual({ tab: 'pings' })
  })
})

describe('displayedPatch', () => {
  it('prend la version filtrée', () => {
    expect(displayedPatch(' 16.21 ', '16.22.1')).toBe('16.21')
  })
  it('retombe sur le patch courant sans filtre', () => {
    expect(displayedPatch('', '16.22.1')).toBe('16.22.1')
  })
})
