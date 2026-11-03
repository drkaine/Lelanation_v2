import { legacyVideosChannelRedirect } from '../../utils/videosChannelRedirect'

export default defineEventHandler(event => {
  const url = event.node.req.url || '/'
  const path = url.split('?')[0] || '/'
  // Redirect legacy channel pages (/videos/:channelId, /en/videos/:channelId) to the catalog.
  const target = legacyVideosChannelRedirect(path)
  if (target) return sendRedirect(event, target, 301)
})
