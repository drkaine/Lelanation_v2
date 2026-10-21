import { describe, expect, it } from 'vitest'
import { createSharedStatsChunk, statsPageChunk } from './statsChunks'

const P = '/x/frontend/pages/statistics'
const C = '/x/frontend/components/statistics'

describe('statsPageChunk', () => {
  it('maps stats pages to their route chunk', () => {
    expect(statsPageChunk(`${P}/tier-list.vue`)).toBe('page-stats-tier-list')
    expect(statsPageChunk(`${P}/meta-chart.vue`)).toBe('page-stats-misc')
    expect(statsPageChunk(`${P}/champion/[slug].vue`)).toBe('page-stats-champion-shell')
    expect(statsPageChunk(`${C}/pages/ChampionStatsPage.vue`)).toBe('page-stats-champion')
    expect(statsPageChunk(`${C}/StatisticsFiltersPanel.vue`)).toBeUndefined()
    expect(statsPageChunk('/x/frontend/stores/StatisticsUiStore.ts')).toBe('statistics-store')
  })
})

describe('createSharedStatsChunk', () => {
  const importers: Record<string, string[]> = {
    [`${C}/Panel.vue`]: [`${P}/tier-list.vue`, `${C}/Wrapper.vue`],
    [`${C}/Wrapper.vue`]: [`${P}/lelariva.vue`],
    [`${C}/OnlyTier.vue`]: [`${P}/tier-list.vue`],
    [`${C}/Loop.vue`]: [`${C}/Loop.vue`, `${P}/tier-list.vue`],
    '/x/frontend/utils/statsVersion.ts': [
      '/x/frontend/stores/StatisticsStore.ts',
      `${C}/Panel.vue`,
    ],
    '/x/node_modules/lib/index.js': [`${P}/tier-list.vue`, `${P}/lelariva.vue`],
  }
  const shared = createSharedStatsChunk(id => importers[id] ?? [])

  it('groups source modules reachable from two stats page chunks', () => {
    expect(shared(`${C}/Panel.vue`)).toBe('page-stats-shared')
    expect(shared(`${C}/Wrapper.vue`)).toBeUndefined()
  })

  it('keeps modules used by the stats store in its chunk, so shared never imports it back', () => {
    expect(shared('/x/frontend/utils/statsVersion.ts')).toBe('statistics-store')
  })

  it('leaves single-page modules, import cycles and node_modules alone', () => {
    expect(shared(`${C}/OnlyTier.vue`)).toBeUndefined()
    expect(shared(`${C}/Loop.vue`)).toBeUndefined()
    expect(shared('/x/node_modules/lib/index.js')).toBeUndefined()
  })
})
