import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Build } from '@lelanation/shared-types'
import { useBuildStore } from '~/stores/BuildStore'
import { useBuildDiscoveryStore } from '~/stores/BuildDiscoveryStore'
import { useFavoritesStore } from '~/stores/FavoritesStore'
import { serializeBuild, hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import { filterStandaloneLibraryBuilds } from '~/utils/buildLibrary'
import { useClientHydrated } from '~/composables/useClientHydrated'

export function useBuildShareTransfer() {
  const buildStore = useBuildStore()
  const discoveryStore = useBuildDiscoveryStore()
  const favoritesStore = useFavoritesStore()
  const { hydrated } = useClientHydrated()
  const { t } = useI18n()

  const shareCode = ref<string | null>(null)
  const importCode = ref('')
  const shareLoading = ref(false)
  const importLoading = ref(false)
  const shareError = ref<string | null>(null)
  const shareCopied = ref(false)
  const importSuccess = ref(false)

  const favoriteBuilds = computed<Build[]>(() => {
    if (!hydrated.value) return []
    const ids = new Set(favoritesStore.favoriteBuildIds)
    if (ids.size === 0) return []
    const saved = filterStandaloneLibraryBuilds(buildStore.getSavedBuilds())
    const fromDiscovery = discoveryStore.builds
    const byId = new Map<string, Build>()
    for (const b of saved) byId.set(b.id, b)
    for (const b of fromDiscovery) if (!byId.has(b.id)) byId.set(b.id, b)
    return favoritesStore.favoriteBuildIds
      .map(id => byId.get(id))
      .filter((b): b is Build => Boolean(b))
  })

  async function shareBuilds(): Promise<void> {
    shareError.value = null
    importSuccess.value = false
    favoritesStore.init()

    const localBuilds = filterStandaloneLibraryBuilds(buildStore.getSavedBuilds())
    const byId = new Map<string, Build>()
    for (const build of localBuilds) byId.set(build.id, build)
    for (const build of favoriteBuilds.value) {
      if (!byId.has(build.id)) byId.set(build.id, build)
    }
    const allBuilds = Array.from(byId.values())
    if (allBuilds.length === 0) {
      shareCode.value = null
      shareCopied.value = false
      return
    }

    shareLoading.value = true
    try {
      const stored = allBuilds.map(b => serializeBuild(b))
      const favoriteIds = favoritesStore.favoriteBuildIds.filter(id => byId.has(id))
      const res = await $fetch<{ code: string; expiresAt: string }>('/api/share-builds', {
        method: 'POST',
        body: { builds: stored, favoriteIds },
      })
      shareCode.value = res.code
      shareCopied.value = false
    } catch {
      shareError.value = t('buildsPage.shareError')
      window.setTimeout(() => {
        shareError.value = null
      }, 4000)
    } finally {
      shareLoading.value = false
    }
  }

  async function copyShareCode(): Promise<void> {
    if (!shareCode.value) return
    try {
      await navigator.clipboard.writeText(shareCode.value)
      shareCopied.value = true
      window.setTimeout(() => {
        shareCopied.value = false
      }, 2000)
    } catch {
      // fallback: user can copy manually
    }
  }

  async function importBuildsByCode(): Promise<void> {
    const code = importCode.value.trim().toUpperCase()
    if (!code) return
    importLoading.value = true
    shareError.value = null
    importSuccess.value = false
    try {
      const payload = await $fetch<{ builds: unknown[]; favoriteIds?: string[] }>(
        `/api/share-builds/${encodeURIComponent(code)}`
      )
      const favoriteSourceIds = new Set(
        Array.isArray(payload.favoriteIds)
          ? payload.favoriteIds.filter((id): id is string => typeof id === 'string')
          : []
      )
      const importedBySourceId = new Map<string, string>()
      for (const raw of payload.builds ?? []) {
        const build =
          raw && typeof raw === 'object' && isStoredBuild(raw) ? hydrateBuild(raw) : (raw as Build)
        if (!build || typeof build !== 'object' || !('id' in build)) continue
        const isFavoriteSource = favoriteSourceIds.has(build.id)
        const isPrivateBuild = (build.visibility ?? 'public') === 'private'
        const shouldGrantOwnership = isPrivateBuild || !isFavoriteSource

        if (shouldGrantOwnership) {
          const newId =
            buildStore.upsertImportedBuild?.(build) ??
            buildStore.importBuild?.(build, { nameSuffix: '' })
          if (newId) importedBySourceId.set(build.id, newId)
        } else {
          importedBySourceId.set(build.id, build.id)
        }
      }
      if (Array.isArray(payload.favoriteIds) && payload.favoriteIds.length > 0) {
        for (const sourceId of payload.favoriteIds) {
          const importedId = importedBySourceId.get(sourceId)
          if (!importedId) continue
          if (!favoritesStore.favoriteBuildIds.includes(importedId)) {
            favoritesStore.addFavorite(importedId)
          }
        }
      }
      await discoveryStore.loadBuilds()
      importCode.value = ''
      importSuccess.value = true
    } catch {
      shareError.value = t('buildsPage.shareError')
      window.setTimeout(() => {
        shareError.value = null
      }, 4000)
    } finally {
      importLoading.value = false
    }
  }

  return {
    shareCode,
    importCode,
    shareLoading,
    importLoading,
    shareError,
    shareCopied,
    importSuccess,
    shareBuilds,
    copyShareCode,
    importBuildsByCode,
  }
}
