export default defineEventHandler(event => {
  const url = event.node.req.url || '/'
  const path = url.split('?')[0] || '/'

  // Redirect legacy channel pages (/videos/:channelId, /en/videos/:channelId) to the catalog.
  const channelRaw = path.match(/^\/(?:en\/)?videos\/([^/?#]+)\/?$/)?.[1]
  if (!channelRaw) return

  const channelId = decodeURIComponent(channelRaw)
  // Nuxt client payload and other internal assets (/_payload.json, /_nuxt, …).
  if (channelId.startsWith('_')) return

  const localePrefix = path.startsWith('/en/') ? '/en' : ''
  return sendRedirect(
    event,
    `${localePrefix}/videos?channelId=${encodeURIComponent(channelId)}`,
    301
  )
})
