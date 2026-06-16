import { computed, type ComputedRef, type Ref } from 'vue'
import type { Build } from '@lelanation/shared-types'
import { fetchPublicBuildDetail } from '~/composables/useBuildDetailFetch'
import { buildHowToJsonLdDocument } from '~/utils/buildHowToJsonLd'
import { useSiteUrl } from '~/composables/useSiteUrl'
import { usePageOgImage } from '~/composables/usePageOgImage'
import { useJsonLdHead } from '~/composables/useJsonLdHead'

type BuildDetailPageResult = {
  buildId: ComputedRef<string>
  initialBuild: Ref<Build | null | undefined>
}

/** SSR + SEO + JSON-LD pour les pages détail build (`/builds/:id`, `/builds/view/:id`). */
export function useBuildDetailPage(): BuildDetailPageResult {
  const route = useRoute()
  const siteUrl = useSiteUrl()
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

  const buildOgTitle = computed(() => {
    const b = initialBuild.value
    if (!b?.name) return 'Build Lelanation'
    return championLabel.value ? `${b.name} — ${championLabel.value}` : b.name
  })
  const buildOgSubtitle = computed(() => championLabel.value || 'Build League of Legends')
  usePageOgImage({ title: buildOgTitle, subtitle: buildOgSubtitle })

  useJsonLdHead(
    'build-howto',
    computed(() => {
      const b = initialBuild.value
      if (!b) return null
      return buildHowToJsonLdDocument(b, siteUrl)
    })
  )

  return { buildId, initialBuild }
}
