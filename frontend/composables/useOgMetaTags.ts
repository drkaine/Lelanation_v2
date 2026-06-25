import type { MaybeRef } from 'vue'

type OgMetaTagsOptions = {
  title?: MaybeRef<string | undefined>
  description?: MaybeRef<string | undefined>
  image?: MaybeRef<string | undefined>
  url?: MaybeRef<string | undefined>
}

/** Explicit `og:*` meta tags (SSR-safe). Complements `useSeoMeta` for crawlers that miss it. */
export function useOgMetaTags(options: OgMetaTagsOptions) {
  useHead({
    meta: computed(() => {
      const tags: Array<Record<string, string>> = []
      const title = toValue(options.title)
      const description = toValue(options.description)
      const image = toValue(options.image)
      const url = toValue(options.url)
      if (title) {
        tags.push({ property: 'og:title', content: title, key: 'og:title' })
        tags.push({ name: 'twitter:title', content: title, key: 'twitter:title' })
      }
      if (description) {
        tags.push({ property: 'og:description', content: description, key: 'og:description' })
        tags.push({ name: 'twitter:description', content: description, key: 'twitter:description' })
      }
      if (image) {
        tags.push({ property: 'og:image', content: image, key: 'og:image' })
        tags.push({ name: 'twitter:image', content: image, key: 'twitter:image' })
      }
      if (url) {
        tags.push({ property: 'og:url', content: url, key: 'og:url' })
      }
      tags.push({ name: 'twitter:card', content: 'summary_large_image', key: 'twitter:card' })
      return tags
    }),
  })
}
