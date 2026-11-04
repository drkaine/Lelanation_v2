/** Sous-menu « Vidéos » de la barre d'onglets mobile (chemins sans préfixe de locale). */
export type VideosSubmenuId = 'videos' | 'champions'

export const VIDEOS_SUBMENU_ITEMS: ReadonlyArray<{
  id: VideosSubmenuId
  path: string
  labelKey: string
}> = [
  { id: 'videos', path: '/videos', labelKey: 'nav.videos' },
  { id: 'champions', path: '/guides/champion', labelKey: 'nav.championGuides' },
]

export function videosSubmenuActiveId(path: string): VideosSubmenuId | null {
  if (/(^|\/)guides\/champion(\/|$)/.test(path)) return 'champions'
  if (/(^|\/)videos(\/|$)/.test(path)) return 'videos'
  return null
}
