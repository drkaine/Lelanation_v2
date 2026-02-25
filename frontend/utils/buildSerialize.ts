/**
 * Nuxt adapter for build serialization / hydration.
 * Delegates pure logic to @lelanation/builds-ui, adds Pinia store integration for hydration.
 */

import type { Build, StoredBuild } from '@lelanation/shared-types'
import {
  serializeBuild as coreSerialize,
  hydrateBuild as coreHydrate,
  isStoredBuild as coreIsStoredBuild,
} from '@lelanation/builds-ui'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'

export const serializeBuild = coreSerialize
export const isStoredBuild = coreIsStoredBuild

/** Reconstruct a full build using Nuxt Pinia stores as catalogs */
export function hydrateBuild(stored: StoredBuild): Build {
  const championsStore = useChampionsStore()
  const itemsStore = useItemsStore()
  const spellsStore = useSummonerSpellsStore()

  return coreHydrate(stored, {
    champions: championsStore.champions,
    items: itemsStore.items,
    getSpellById: (id: string) => spellsStore.getSpellById(id),
  })
}
