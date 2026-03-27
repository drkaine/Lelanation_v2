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
export { useBuildsIndexController } from './composables/useBuildsIndexController'
export type {
  VisibilityFilterValue,
  BuildStoreLike,
  BuildDiscoveryStoreLike,
  FavoritesStoreLike,
  VoteStoreLike,
  UseBuildsIndexControllerOptions,
} from './composables/useBuildsIndexController'

// Components
export { default as BuildSheet } from './components/BuildSheet.vue'
export type { ImageResolvers, RuneLookup } from './components/BuildSheet.vue'
export { default as BuildCardFlip } from './components/BuildCardFlip.vue'
export { default as BuildsIndexPageView } from './components/BuildsIndexPageView.vue'
export { default as BuildsFilterBar } from './components/BuildsFilterBar.vue'
export { default as BuildCreateChampionPageView } from './components/BuildCreateChampionPageView.vue'
export { default as BuildCreateRunePageView } from './components/BuildCreateRunePageView.vue'
export { default as BuildCreateItemPageView } from './components/BuildCreateItemPageView.vue'
export { default as BuildCreateInfoPageView } from './components/BuildCreateInfoPageView.vue'
export { default as CompanionBuildsPanelView } from './components/CompanionBuildsPanelView.vue'
export type { FilterRoleValue, FilterSortValue } from './components/BuildsFilterBar.vue'
