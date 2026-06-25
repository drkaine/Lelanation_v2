import { webSiteJsonLd, organizationJsonLd } from '~/utils/jsonLd'
import { absoluteSitePath, defaultOgImageUrl } from '~/utils/siteUrl'
import { useJsonLdHead } from '~/composables/useJsonLdHead'
import { useOgMetaTags } from '~/composables/useOgMetaTags'

/** Site-wide OG fallback + JSON-LD. Canonical is set in `app.vue` (single source, www). */
export function useGlobalSeo() {
  const route = useRoute()
  const siteUrl = useSiteUrl()

  const canonicalUrl = computed(() => {
    const path = route.path || '/'
    return absoluteSitePath(siteUrl, path)
  })
  const defaultOgImage = computed(() => defaultOgImageUrl(siteUrl))

  useSeoMeta({
    ogTitle: 'Lelanation',
    ogSiteName: 'Lelanation',
    ogImage: defaultOgImage,
    twitterImage: defaultOgImage,
    ogUrl: canonicalUrl,
    twitterCard: 'summary_large_image',
  })

  useOgMetaTags({
    title: 'Lelanation',
    image: defaultOgImage,
    url: canonicalUrl,
  })

  useJsonLdHead('global-website', () => {
    if (String(route.path).includes('/render/')) return null
    return webSiteJsonLd(siteUrl)
  })

  useJsonLdHead('global-organization', () => {
    if (String(route.path).includes('/render/')) return null
    return organizationJsonLd(siteUrl)
  })

  return { canonicalUrl }
}
