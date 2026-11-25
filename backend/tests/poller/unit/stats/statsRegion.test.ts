import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../src/redis/client.js', () => ({ redis: { status: 'end' } }))
import {
  currentStatsRegions,
  regionCacheKey,
  regionInSql,
  regionParam,
  regionSqlConditions,
  RegionScopedMap,
  runWithStatsRegion,
} from '../../../../src/stats/statsRegion.js'
import { buildRankTierSqlConditions } from '../../../../src/utils/statsFilters.js'
import { cohortSqlWhere } from '../../../../src/stats/cohortSqlWhere.js'
import { statsRedisCacheFullKey } from '../../../../src/services/statsRedisCache.js'

describe('regionParam', () => {
  it('région(s) connue(s) (casse libre) → liste lol_region, ordre de l’enum, sans doublon', () => {
    expect(regionParam('euw1')).toEqual(['EUW1'])
    expect(regionParam(['KR'])).toEqual(['KR'])
    expect(regionParam('kr,EUW1, kr')).toEqual(['EUW1', 'KR'])
    expect(regionParam(['NA1', 'euw1,xx'])).toEqual(['EUW1', 'NA1'])
  })
  it('vide, all ou inconnue → null (toutes mélangées), pas d’injection', () => {
    expect(regionParam(undefined)).toBeNull()
    expect(regionParam('all')).toBeNull()
    expect(regionParam('')).toBeNull()
    expect(regionParam("EUW1' OR 1=1 --")).toBeNull()
  })
})

describe('regionInSql', () => {
  it('une région = égalité, plusieurs = IN, aucune = null', () => {
    expect(regionInSql('m.region', ['KR'])).toBe("m.region = 'KR'")
    expect(regionInSql('region', ['EUW1', 'KR'])).toBe("region IN ('EUW1','KR')")
    expect(regionInSql('region', null)).toBeNull()
    expect(regionInSql('region', [])).toBeNull()
  })
})

describe('région du contexte de requête', () => {
  it('hors contexte : aucune condition, clé de cache vide', () => {
    expect(currentStatsRegions()).toBeNull()
    expect(regionSqlConditions('m')).toEqual([])
    expect(regionCacheKey()).toBe('')
  })

  it('dans le contexte : condition alias.region, suit les await', async () => {
    const out = await runWithStatsRegion(['KR'], async () => {
      await Promise.resolve()
      return { sql: regionSqlConditions('cs'), key: regionCacheKey() }
    })
    expect(out).toEqual({ sql: ["cs.region = 'KR'"], key: 'r=KR:' })
  })

  it('plusieurs régions : IN et clé de cache triée', () => {
    runWithStatsRegion(['EUW1', 'KR'], () => {
      expect(regionSqlConditions('')).toEqual(["region IN ('EUW1','KR')"])
      expect(regionCacheKey()).toBe('r=EUW1,KR:')
    })
  })

  it('helpers SQL communs filtrent la région', () => {
    runWithStatsRegion(['TR1'], () => {
      expect(buildRankTierSqlConditions('m', 'GOLD')).toEqual(["m.rank_tier = 'GOLD'", "m.region = 'TR1'"])
      expect(buildRankTierSqlConditions('m', null)).toEqual(["m.region = 'TR1'"])
      expect(cohortSqlWhere('vs', {})).toBe("1=1 AND vs.region = 'TR1'")
    })
    expect(buildRankTierSqlConditions('m', null)).toEqual([])
  })

  it('clé Redis distincte par région', () => {
    const all = statsRedisCacheFullKey('tier', 'k')
    const kr = runWithStatsRegion(['KR'], () => statsRedisCacheFullKey('tier', 'k'))
    expect(kr).not.toBe(all)
    expect(kr).toContain('r=KR:')
  })
})

describe('RegionScopedMap', () => {
  it('une entrée par région ; itération et delete sur la clé complète', () => {
    const cache = new RegionScopedMap<number>()
    cache.set('k', 1)
    runWithStatsRegion(['KR'], () => {
      expect(cache.get('k')).toBeUndefined()
      cache.set('k', 2)
      expect(cache.get('k')).toBe(2)
      expect(cache.has('k')).toBe(true)
    })
    expect(cache.get('k')).toBe(1)
    for (const [key] of cache) cache.delete(key)
    expect(cache.size).toBe(0)
  })
})
