// Re-export shared types for convenience
export type * from '@lelanation/shared-types'

// Utils — image URLs
export {
  setImageBase,
  getChampionImageUrl,
  getItemImageUrl,
  getSpellImageUrl,
  getChampionSpellImageUrl,
  getChampionPassiveImageUrl,
  getRunePathImageUrl,
  getRuneImageUrl,
} from './utils/imageUrl'
export type { ImageBaseProvider } from './utils/imageUrl'

// Utils — serialization
export {
  serializeBuild,
  hydrateBuild,
  isStoredBuild,
} from './utils/serialize'
export type { HydrationCatalogs } from './utils/serialize'

// Utils — item classification
export { isBootsItem, isStarterItem } from './utils/itemClassification'

// Composables
export { useBuildsCore } from './composables/useBuildsCore'
export { useBuildsFilter } from './composables/useBuildsFilter'
export type { SortOption, FilterRole, VoteProvider } from './composables/useBuildsFilter'

// Components
export { default as BuildSheet } from './components/BuildSheet.vue'
export type { ImageResolvers, RuneLookup } from './components/BuildSheet.vue'
