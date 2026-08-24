import { stripLocalePrefix } from '~/utils/theorycraftRoute'

export default defineNuxtRouteMiddleware(to => {
  if (stripLocalePrefix(to.path) !== '/builds/theorycraft') return

  const localePrefix = to.path.startsWith('/en/') ? '/en' : ''
  return navigateTo(
    {
      path: `${localePrefix}/builds/create/theorycraft`,
      query: to.query,
    },
    { replace: true, redirectCode: 301 }
  )
})
