import type { MaybeRef } from 'vue'
import { absoluteSitePath } from '~/utils/siteUrl'

type PageOgImageOptions = {
  title: MaybeRef<string>
  subtitle?: MaybeRef<string | undefined>
}

function buildOgImageUrl(siteUrl: string, title: string, subtitle?: string): string {
  const params = new URLSearchParams({ title: title.slice(0, 80) })
  if (subtitle?.trim()) params.set('subtitle', subtitle.trim().slice(0, 120))
  return `${absoluteSitePath(siteUrl, '/og.png')}?${params.toString()}`
}

/** Page-specific Open Graph / Twitter card image via `/og.png`. */
export function usePageOgImage(options: PageOgImageOptions) {
  const siteUrl = useSiteUrl()

  const ogImage = computed(() =>
    buildOgImageUrl(siteUrl, toValue(options.title), toValue(options.subtitle))
  )

  useSeoMeta({
    ogImage,
    twitterImage: ogImage,
    twitterCard: 'summary_large_image',
  })

  return { ogImage }
}
