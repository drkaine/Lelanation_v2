import { computed, type ComputedRef, type Ref } from 'vue'
import type { Build } from '@lelanation/shared-types'
import { fetchPublicBuildDetail } from '~/composables/useBuildDetailFetch'
import { buildHowToJsonLdDocument } from '~/utils/buildHowToJsonLd'

type BuildDetailPageResult = {
  buildId: ComputedRef<string>
  initialBuild: Ref<Build | null | undefined>
}

/** SSR + SEO + JSON-LD pour les pages détail build (`/builds/:id`, `/builds/view/:id`). */
export function useBuildDetailPage(): BuildDetailPageResult {
  const route = useRoute()
  const config = useRuntimeConfig()
  const buildId = computed(() => String(route.params.id ?? ''))

  const { data: initialBuild } = useAsyncData<Build | null>(
    () => `build-detail-${buildId.value}`,
    () => fetchPublicBuildDetail(buildId.value),
    { watch: [buildId] }
  )

  const championLabel = computed(() => initialBuild.value?.champion?.name ?? '')

  useSeoMeta({
    title: () => {
      const name = initialBuild.value?.name
      if (name && championLabel.value) return `${name} — ${championLabel.value}`
      if (name) return name
      return 'Build'
    },
    description: () => {
      const b = initialBuild.value
      if (!b) return 'Build League of Legends sur Lelanation.'
      const parts = [b.name, b.author, championLabel.value].filter(Boolean)
      const base = parts.length > 0 ? parts.join(' · ') : 'Build League of Legends'
      const desc =
        typeof b.description === 'string' ? b.description.replace(/<[^>]+>/g, ' ').trim() : ''
      return desc ? `${base}. ${desc.slice(0, 140)}` : `${base}. Items, runes et ordre de sorts.`
    },
    ogTitle: () => initialBuild.value?.name || 'Build Lelanation',
  })

  useHead({
    script: computed(() => {
      const b = initialBuild.value
      if (!b) return []
      const siteUrl = String(config.public.siteUrl ?? 'https://lelanation.fr')
      return [
        {
          type: 'application/ld+json',
          children: JSON.stringify(buildHowToJsonLdDocument(b, siteUrl)),
        },
      ]
    }),
  })

  return { buildId, initialBuild }
}
