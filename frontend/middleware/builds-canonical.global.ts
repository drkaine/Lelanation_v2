const TAB_PATHS: Record<string, string> = {
  discover: '/builds/discover',
  'my-builds': '/builds/my-builds',
  favoris: '/builds/favoris',
  lelariva: '/statistics/lelariva',
}

function buildsIndexPath(path: string): boolean {
  return path === '/builds' || path === '/en/builds'
}

export default defineNuxtRouteMiddleware(to => {
  if (!buildsIndexPath(to.path)) return

  const tab = typeof to.query.tab === 'string' ? to.query.tab : null
  const target = tab ? TAB_PATHS[tab] : '/builds/discover'
  if (!target) return

  const localePrefix = to.path.startsWith('/en/') ? '/en' : ''
  const destination = `${localePrefix}${target}`

  if (to.path === destination && !tab) return

  return navigateTo(
    {
      path: destination,
      query: Object.fromEntries(Object.entries(to.query).filter(([key]) => key !== 'tab')),
    },
    { redirectCode: 301 }
  )
})
