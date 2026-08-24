export default defineEventHandler(event => {
  const url = event.node.req.url || '/'
  const [path, queryString] = url.split('?')

  if (!/^\/(?:en\/)?builds\/theorycraft\/?$/.test(path)) return

  const localePrefix = path.startsWith('/en/') ? '/en' : ''
  const destination = `${localePrefix}/builds/create/theorycraft${queryString ? `?${queryString}` : ''}`
  return sendRedirect(event, destination, 301)
})
