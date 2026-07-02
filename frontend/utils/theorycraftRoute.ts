/** Strip Nuxt i18n locale prefix (`/en/...`) for route comparison. */
export function stripLocalePrefix(path: string): string {
  if (path === '/en') return '/'
  if (path.startsWith('/en/')) return path.slice(3) || '/'
  return path
}

export function isTheorycraftRoutePath(path: string): boolean {
  const normalized = stripLocalePrefix(path)
  return normalized === '/builds/theorycraft' || normalized === '/builds/create/theorycraft'
}

export function isBuilderCreateRoutePath(path: string): boolean {
  return stripLocalePrefix(path).startsWith('/builds/create/')
}
