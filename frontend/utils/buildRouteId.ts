const BUILD_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Route param for `/builds/:id` — rejects Nuxt internals like `_payload.json`. */
export function isPublicBuildRouteId(id: string): boolean {
  if (!id || id.startsWith('_')) return false
  return BUILD_ID_RE.test(id)
}
