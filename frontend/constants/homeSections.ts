import type { HomeSectionId } from '~/stores/HomeUiStore'

/** Default display order for home page content sections (below hero). */
export const HOME_SECTION_ORDER: readonly HomeSectionId[] = [
  'customize',
  'recentBuilds',
  'tierList',
  'latestVideos',
  'app',
  'contact',
  'globalStats',
] as const

export const HOME_SECTION_LABEL_KEYS: Record<HomeSectionId, string> = {
  customize: 'home.sections.customize',
  recentBuilds: 'home.sections.recentBuilds',
  tierList: 'home.sections.tierList',
  latestVideos: 'home.sections.latestVideos',
  app: 'home.sections.app',
  contact: 'home.sections.contact',
  globalStats: 'home.sections.globalStats',
}
