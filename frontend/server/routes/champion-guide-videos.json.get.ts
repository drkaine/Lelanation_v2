import { slimGuideVideos, type GuideVideoRef } from '~/utils/championGuideVideos'
import { listAllYouTubeVideosFromDisk } from '~/utils/youtubeCatalog'

/** Titres des vidéos (id + titre) pour les badges de /guides/champion, rendus dès le SSR. */
export default defineCachedEventHandler(
  (): GuideVideoRef[] => slimGuideVideos(listAllYouTubeVideosFromDisk()),
  { name: 'champion-guide-videos', maxAge: 10 * 60, swr: true }
)
