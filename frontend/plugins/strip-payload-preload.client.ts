/** Remove orphaned Nuxt SWR payload preloads after client navigations. */
export default defineNuxtPlugin(() => {
  const router = useRouter()

  function stripPayloadPreloads() {
    document
      .querySelectorAll<HTMLLinkElement>(
        'link[rel="preload"][href*="/_payload."], link[rel="prefetch"][href*="/_payload."]'
      )
      .forEach(link => link.remove())
  }

  router.afterEach(() => {
    stripPayloadPreloads()
  })

  onNuxtReady(stripPayloadPreloads)
})
