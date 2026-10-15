import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import {
  patchNotesRowMatchesQuery,
  useStatisticsPatchNotesTab,
  type PatchNotesStatsRow,
  type PatchNotesTargetType,
} from './useStatisticsPatchNotesTab'

function row(targetType: PatchNotesTargetType, targetId: string): PatchNotesStatsRow {
  return {
    targetType,
    targetId,
    countNerf: 0,
    countUp: 1,
    countAjust: 0,
    totalChanges: 1,
    patchesTouched: 1,
    totalPatches: 1,
    regularity: 1,
    lastModPatch: '16.20',
    lastModType: 'up',
  }
}

const labels: Record<string, string> = { '3031': "Lame d'infini", MonkeyKing: 'Wukong' }
const labelOf = (r: PatchNotesStatsRow) => labels[r.targetId] ?? r.targetId

describe('patchNotesRowMatchesQuery', () => {
  it('matches every row on an empty query', () => {
    expect(patchNotesRowMatchesQuery(row('items', '3031'), '  ', labelOf)).toBe(true)
  })

  it('matches the displayed name, accent and case insensitive', () => {
    expect(patchNotesRowMatchesQuery(row('items', '3031'), 'LAME D', labelOf)).toBe(true)
    expect(patchNotesRowMatchesQuery(row('champion', 'MonkeyKing'), 'wuko', labelOf)).toBe(true)
    expect(patchNotesRowMatchesQuery(row('champion', 'Leona'), 'leóna', labelOf)).toBe(true)
  })

  it('still matches the raw id and rejects the rest', () => {
    expect(patchNotesRowMatchesQuery(row('champion', 'MonkeyKing'), 'monkey', labelOf)).toBe(true)
    expect(patchNotesRowMatchesQuery(row('items', '3031'), 'wukong', labelOf)).toBe(false)
  })
})

describe('useStatisticsPatchNotesTab search', () => {
  it('filters the rows by displayed name', async () => {
    const query = ref('')
    const tab = useStatisticsPatchNotesTab({
      patchNotesFromVersion: ref(''),
      patchNotesToVersion: ref(''),
      patchNotesTargetFilters: ref(new Set<PatchNotesTargetType>()),
      championSearchQuery: query,
      targetLabel: labelOf,
      statsFetch: <T>() =>
        Promise.resolve({
          fromVersion: null,
          toVersion: null,
          totalPatches: 1,
          rows: [row('items', '3031'), row('champion', 'MonkeyKing')],
        } as T),
      apiUrl: (path: string) => path,
    })
    await tab.loadPatchNotesStats()
    expect(tab.sortedPatchNotesRows.value).toHaveLength(2)
    tab.patchNotesPage.value = 2
    query.value = 'infini'
    expect(tab.sortedPatchNotesRows.value.map(r => r.targetId)).toEqual(['3031'])
    await nextTick()
    expect(tab.patchNotesPage.value).toBe(1)
  })
})
