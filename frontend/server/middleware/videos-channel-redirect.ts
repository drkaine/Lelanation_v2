export default defineEventHandler(event => {
  const url = event.node.req.url || '/'
  const path = url.split('?')[0] || '/'

  // Redirect legacy channel pages (/videos/:channelId) to the unified catalog page.
  const m = path.match(/^\/videos\/([^/?#]+)\/?$/)
  if (!m) return

  const channelId = decodeURIComponent(m[1])
  return sendRedirect(event, `/videos?channelId=${encodeURIComponent(channelId)}`, 301)
})
