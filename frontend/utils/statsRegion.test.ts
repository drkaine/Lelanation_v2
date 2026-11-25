import { afterEach, describe, expect, it } from 'vitest'
import {
  STATS_REGION_OPTIONS,
  getStatsRegions,
  parseStatsRegions,
  regionsFromCookieHeader,
  serializeStatsRegions,
  setStatsRegions,
  toggleStatsRegion,
  visibleStatsRegionOptions,
  withStatsRegions,
} from './statsRegion'

describe('parseStatsRegions', () => {
  it('liste de régions connues (casse libre), ordre de l’enum, sans doublon', () => {
    expect(parseStatsRegions('euw1')).toEqual(['EUW1'])
    expect(parseStatsRegions(' KR ,euw1,kr')).toEqual(['EUW1', 'KR'])
    expect(parseStatsRegions('kr,xx')).toEqual(['KR'])
  })

  it('vide, all ou inconnue = [] (toutes régions)', () => {
    expect(parseStatsRegions('all')).toEqual([])
    expect(parseStatsRegions('')).toEqual([])
    expect(parseStatsRegions('xx')).toEqual([])
    expect(parseStatsRegions(undefined)).toEqual([])
    expect(parseStatsRegions(null)).toEqual([])
  })

  it('serialize : liste séparée par des virgules, vide = toutes', () => {
    expect(serializeStatsRegions(['EUW1', 'KR'])).toBe('EUW1,KR')
    expect(serializeStatsRegions([])).toBe('')
  })

  it('options = valeurs de l’enum backend lol_region', () => {
    expect(STATS_REGION_OPTIONS.map(o => o.value)).toEqual([
      'EUW1',
      'EUN1',
      'NA1',
      'KR',
      'BR1',
      'LA1',
      'LA2',
      'OC1',
      'TR1',
      'JP1',
      'ME1',
    ])
    expect(STATS_REGION_OPTIONS[0]?.label).toBe('EUW')
  })
})

describe('toggleStatsRegion', () => {
  it('ajoute ou retire, garde l’ordre de l’enum', () => {
    expect(toggleStatsRegion([], 'KR')).toEqual(['KR'])
    expect(toggleStatsRegion(['KR'], 'EUW1')).toEqual(['EUW1', 'KR'])
    expect(toggleStatsRegion(['EUW1', 'KR'], 'EUW1')).toEqual(['KR'])
  })
})

describe('withStatsRegions', () => {
  it('ajoute region aux URL /api/stats seulement', () => {
    expect(withStatsRegions('/api/stats/overview', ['KR'])).toBe('/api/stats/overview?region=KR')
    expect(withStatsRegions('/api/stats/x?a=1', ['EUW1', 'KR'])).toBe(
      '/api/stats/x?a=1&region=EUW1,KR'
    )
    expect(withStatsRegions('http://h:3500/api/stats/x', ['KR'])).toBe(
      'http://h:3500/api/stats/x?region=KR'
    )
    expect(withStatsRegions('/api/builds/x', ['KR'])).toBe('/api/builds/x')
    expect(withStatsRegions('/api/statsfoo', ['KR'])).toBe('/api/statsfoo')
  })

  it('remplace un region existant, conserve le hash, [] = inchangé', () => {
    expect(withStatsRegions('/api/stats/x?region=NA1&b=2', ['KR'])).toBe(
      '/api/stats/x?region=KR&b=2'
    )
    expect(withStatsRegions('/api/stats/x#h', ['KR'])).toBe('/api/stats/x?region=KR#h')
    expect(withStatsRegions('/api/stats/x?region=NA1', [])).toBe('/api/stats/x?region=NA1')
    expect(withStatsRegions('/api/stats/x', [])).toBe('/api/stats/x')
  })
})

describe('régions courantes', () => {
  afterEach(() => setStatsRegions([]))

  it('défaut toutes régions, puis la valeur posée', () => {
    expect(getStatsRegions()).toEqual([])
    setStatsRegions(['KR', 'EUW1'])
    expect(getStatsRegions()).toEqual(['KR', 'EUW1'])
  })
})

describe('regionsFromCookieHeader', () => {
  it('lit le cookie stats_region (encodé ou non)', () => {
    expect(regionsFromCookieHeader('a=1; stats_region=kr; b=2')).toEqual(['KR'])
    expect(regionsFromCookieHeader('stats_region=EUW1%2CKR')).toEqual(['EUW1', 'KR'])
    expect(regionsFromCookieHeader('stats_region=all')).toEqual([])
    expect(regionsFromCookieHeader('a=1')).toEqual([])
    expect(regionsFromCookieHeader(undefined)).toEqual([])
  })
})

describe('visibleStatsRegionOptions', () => {
  it('seules les régions en base, ordre de l’enum', () => {
    expect(
      visibleStatsRegionOptions({ regions: ['KR', 'EUW1', 'XX'] }, []).map(o => o.value)
    ).toEqual(['EUW1', 'KR'])
  })

  it('région sélectionnée absente de la base : gardée pour pouvoir la décocher', () => {
    expect(visibleStatsRegionOptions({ regions: ['EUW1'] }, ['NA1']).map(o => o.value)).toEqual([
      'EUW1',
      'NA1',
    ])
  })

  it('réponse absente, invalide ou vide : toutes les régions', () => {
    const all = STATS_REGION_OPTIONS.map(o => o.value)
    expect(visibleStatsRegionOptions(null, []).map(o => o.value)).toEqual(all)
    expect(visibleStatsRegionOptions({ regions: 'EUW1' }, []).map(o => o.value)).toEqual(all)
    expect(visibleStatsRegionOptions({ regions: [] }, []).map(o => o.value)).toEqual(all)
  })
})
