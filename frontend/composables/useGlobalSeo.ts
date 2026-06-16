import { webSiteJsonLd, organizationJsonLd } from '~/utils/jsonLd'
import { absoluteSitePath, defaultOgImageUrl } from '~/utils/siteUrl'
import { useJsonLdHead } from '~/composables/useJsonLdHead'

/** Site-wide canonical, OG fallback, JSON-LD. Page-specific OG via `usePageOgImage`. */
export function useGlobalSeo() {
  const route = useRoute()
  const siteUrl = useSiteUrl()

  const canonicalUrl = computed(() => absoluteSitePath(siteUrl, route.path))
  const defaultOgImage = computed(() => defaultOgImageUrl(siteUrl))

  useHead({
    link: computed(() => [{ rel: 'canonical', href: canonicalUrl.value }]),
  })

  useSeoMeta({
    ogImage: defaultOgImage,
    twitterImage: defaultOgImage,
    ogUrl: canonicalUrl,
    twitterCard: 'summary_large_image',
  })

  useJsonLdHead('global-website', () => {
    if (String(route.path).includes('/render/')) return null
    return webSiteJsonLd(siteUrl)
  })

  useJsonLdHead('global-organization', () => {
    if (String(route.path).includes('/render/')) return null
    return organizationJsonLd(siteUrl)
  })
}
