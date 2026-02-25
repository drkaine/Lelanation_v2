import { computed, type Ref } from 'vue'
import type { Build, Item, Champion } from '@lelanation/shared-types'
import { isBootsItem, isStarterItem } from '../utils/itemClassification'

export { isBootsItem, isStarterItem }

/**
 * Pure, framework-agnostic composable for deriving computed build data.
 * No store, no i18n, no routing — takes refs as input.
 */
export function useBuildsCore(build: Ref<Build | null>) {
  const buildItems = computed(() => build.value?.items ?? [])
  const selectedChampion = computed(() => build.value?.champion ?? null)

  const startingItems = computed(() =>
    buildItems.value.filter(i => isStarterItem(i)).slice(0, 2)
  )

  const bootsItems = computed(() =>
    buildItems.value.filter(i => isBootsItem(i)).slice(0, 2)
  )

  const coreItems = computed(() => {
    const starterIds = new Set(startingItems.value.map(i => i.id))
    const bootsIds = new Set(bootsItems.value.map(i => i.id))
    return buildItems.value.filter(i => !starterIds.has(i.id) && !bootsIds.has(i.id))
  })

  const coreItemsPath1 = computed(() => coreItems.value.slice(0, 3))
  const coreItemsPath2 = computed(() => coreItems.value.slice(3, 6))

  const firstThreeUpsAbilities = computed(() => {
    const champ = selectedChampion.value
    const so = build.value?.skillOrder
    if (!champ || !so?.firstThreeUps) return []
    return so.firstThreeUps
      .filter((a): a is 'Q' | 'W' | 'E' | 'R' => a !== null)
      .map(key => {
        const idx = key === 'Q' ? 0 : key === 'W' ? 1 : key === 'E' ? 2 : 3
        const spell = champ.spells[idx]
        return spell ? { ...spell, key } : null
      })
      .filter(Boolean) as Array<{ key: string; image: { full: string }; name: string }>
  })

  const skillOrderAbilities = computed(() => {
    const champ = selectedChampion.value
    const so = build.value?.skillOrder
    if (!champ || !so?.skillUpOrder) return []
    return so.skillUpOrder
      .filter((a): a is 'Q' | 'W' | 'E' | 'R' => a !== null)
      .map(key => {
        const idx = key === 'Q' ? 0 : key === 'W' ? 1 : key === 'E' ? 2 : 3
        const spell = champ.spells[idx]
        return spell ? { ...spell, key } : null
      })
      .filter(Boolean) as Array<{ key: string; image: { full: string }; name: string }>
  })

  const keystoneRuneId = computed(() => build.value?.runes?.primary?.keystone ?? null)

  const primaryRunesRow = computed(() => {
    const p = build.value?.runes?.primary
    if (!p) return []
    return [p.slot1, p.slot2, p.slot3].filter(id => id && id !== 0)
  })

  const secondaryRuneIds = computed(() => {
    const s = build.value?.runes?.secondary
    if (!s) return []
    return [s.slot1, s.slot2].filter(id => id && id !== 0)
  })

  const shardIds = computed(() => {
    const s = build.value?.shards
    if (!s) return []
    return [s.slot1, s.slot2, s.slot3].filter(id => id && id !== 0)
  })

  const selectedRoles = computed(() => build.value?.roles ?? [])

  const summonerSpells = computed(() => {
    const ss = build.value?.summonerSpells ?? []
    return ss.filter(s => s !== null && s !== undefined)
  })

  return {
    buildItems,
    selectedChampion,
    startingItems,
    bootsItems,
    coreItems,
    coreItemsPath1,
    coreItemsPath2,
    firstThreeUpsAbilities,
    skillOrderAbilities,
    keystoneRuneId,
    primaryRunesRow,
    secondaryRuneIds,
    shardIds,
    selectedRoles,
    summonerSpells,
  }
}
