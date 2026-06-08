import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Locale } from '~/types/locale'

export type ChangeType = 'buff' | 'nerf' | 'adjustment' | 'new' | 'removed' | 'text'
export type EntityCategory = 'champion' | 'item' | 'rune' | 'system'

export interface StatChange {
  stat: string
  before: string
  after: string
  type: ChangeType
}

export interface PatchEntity {
  name: string
  category: EntityCategory
  id?: string
  imageUrl?: string
  patchSlug?: string
  subCategory?: string
  changes: StatChange[]
}

export interface PatchSummaryImage {
  url: string
  localPath: string
  width?: number
  height?: number
}

export interface PatchData {
  patchVersion: string
  locale: Locale
  scrapedAt: string
  url: string
  summaryImage?: PatchSummaryImage
  entities: PatchEntity[]
}

export interface PatchIndexEntry {
  version: string
  scrapedAt: string
  locales: string[]
  files: {
    summary: Record<string, string>
    [key: string]: string | Record<string, string>
  }
}

export interface PatchIndex {
  updatedAt: string
  latest: string
  patches: PatchIndexEntry[]
}

function getPatchNotesBaseUrl(): string {
  return '/data/patch-notes'
}

function localeToPatchLocale(locale: string): string {
  if (locale === 'fr') return 'fr-FR'
  return 'en-GB'
}

/** Single-flight: parallel loads share one fetch. */
let loadIndexInflight: Promise<void> | null = null
let loadPatchInflight: Promise<PatchData | null> | null = null
let loadPatchInflightKey: string | null = null

export const usePatchNotesStore = defineStore('patchNotes', () => {
  // State
  const index = ref<PatchIndex | null>(null)
  const currentPatch = ref<PatchData | null>(null)
  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const error = ref<string | null>(null)

  // Getters (computed)
  const latestVersion = computed(() => index.value?.latest ?? null)
  const availablePatches = computed(() => index.value?.patches ?? [])

  const champions = computed(
    () => currentPatch.value?.entities?.filter(e => e.category === 'champion') ?? []
  )
  const items = computed(
    () => currentPatch.value?.entities?.filter(e => e.category === 'item') ?? []
  )
  const runes = computed(
    () => currentPatch.value?.entities?.filter(e => e.category === 'rune') ?? []
  )
  const systems = computed(
    () => currentPatch.value?.entities?.filter(e => e.category === 'system') ?? []
  )

  const getSummaryImagePath = computed(() => {
    if (!currentPatch.value?.summaryImage) return null
    const localPath = currentPatch.value.summaryImage.localPath
    if (localPath) {
      return localPath.replace(/^data\/patches\//, '/data/patch-notes/')
    }
    return currentPatch.value.summaryImage.url
  })

  // Actions
  async function loadIndex(): Promise<void> {
    if (index.value) return
    if (loadIndexInflight) {
      await loadIndexInflight
      return
    }

    loadIndexInflight = (async () => {
      try {
        status.value = 'loading'
        error.value = null

        const response = await fetch(`${getPatchNotesBaseUrl()}/index.json`, {
          cache: 'no-cache',
        })

        if (!response.ok) {
          throw new Error(`Failed to load patch index: ${response.status}`)
        }

        index.value = await response.json()
        status.value = 'success'
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to load patch index'
        status.value = 'error'
      } finally {
        loadIndexInflight = null
      }
    })()

    await loadIndexInflight
  }

  async function loadPatch(version: string, locale: string): Promise<PatchData | null> {
    const patchLocale = localeToPatchLocale(locale)
    const inflightKey = `${version}-${patchLocale}`

    if (
      currentPatch.value?.patchVersion === version &&
      currentPatch.value?.locale === patchLocale
    ) {
      return currentPatch.value
    }

    if (loadPatchInflight && loadPatchInflightKey === inflightKey) {
      return await loadPatchInflight
    }

    loadPatchInflightKey = inflightKey
    loadPatchInflight = (async (): Promise<PatchData | null> => {
      try {
        status.value = 'loading'
        error.value = null

        const response = await fetch(
          `${getPatchNotesBaseUrl()}/patch-${version}-${patchLocale}.json`,
          { cache: 'no-cache' }
        )

        if (!response.ok) {
          // Try fallback to en-GB if locale not available
          if (patchLocale !== 'en-GB') {
            const fallbackResponse = await fetch(
              `${getPatchNotesBaseUrl()}/patch-${version}-en-GB.json`,
              { cache: 'no-cache' }
            )
            if (fallbackResponse.ok) {
              currentPatch.value = await fallbackResponse.json()
              status.value = 'success'
              return currentPatch.value
            }
          }
          throw new Error(`Failed to load patch ${version}: ${response.status}`)
        }

        currentPatch.value = await response.json()
        status.value = 'success'
        return currentPatch.value
      } catch (err) {
        error.value = err instanceof Error ? err.message : 'Failed to load patch'
        status.value = 'error'
        return null
      } finally {
        loadPatchInflight = null
        loadPatchInflightKey = null
      }
    })()

    return await loadPatchInflight
  }

  async function loadLatestPatch(locale: string): Promise<PatchData | null> {
    await loadIndex()
    if (!latestVersion.value) return null
    return loadPatch(latestVersion.value, locale)
  }

  return {
    index,
    currentPatch,
    status,
    error,
    latestVersion,
    availablePatches,
    champions,
    items,
    runes,
    systems,
    getSummaryImagePath,
    loadIndex,
    loadPatch,
    loadLatestPatch,
  }
})
