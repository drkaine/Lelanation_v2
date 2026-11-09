import { describe, expect, it } from 'vitest'
import { planUploadsFetch, isBackfillComplete } from '../../../src/services/youtubeSyncPlan.js'

describe('planUploadsFetch', () => {
  it('liste toute la chaîne tant que le backfill n’est pas complet (vieux fichiers plafonnés à 500)', () => {
    const plan = planUploadsFetch({ videoCount: 616, backfillComplete: undefined }, {})
    expect(plan).toEqual({ mode: 'full', maxVideos: 5000 })
  })
  it('premier sync : liste complète', () => {
    expect(planUploadsFetch({ videoCount: 0 }, {}).mode).toBe('full')
  })
  it('backfill complet : incrémental, plafond YOUTUBE_INCREMENTAL_MAX_VIDEOS', () => {
    expect(planUploadsFetch({ videoCount: 900, backfillComplete: true }, { YOUTUBE_INCREMENTAL_MAX_VIDEOS: '50' }))
      .toEqual({ mode: 'incremental', maxVideos: 50 })
    expect(planUploadsFetch({ videoCount: 900, backfillComplete: true }, {}).maxVideos).toBe(200)
  })
  it('plafond de liste complète configurable', () => {
    expect(planUploadsFetch({ videoCount: 0 }, { YOUTUBE_FULL_LIST_MAX_VIDEOS: '8000' }).maxVideos).toBe(8000)
  })
})

describe('isBackfillComplete', () => {
  it('complet si la liste s’est arrêtée avant le plafond', () => {
    expect(isBackfillComplete({ mode: 'full', maxVideos: 5000 }, 980)).toBe(true)
  })
  it('incomplet si le plafond est atteint', () => {
    expect(isBackfillComplete({ mode: 'full', maxVideos: 5000 }, 5000)).toBe(false)
  })
  it('incrémental : reste complet', () => {
    expect(isBackfillComplete({ mode: 'incremental', maxVideos: 200 }, 3)).toBe(true)
  })
})
