import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Locale } from '~/types/locale'

export type ChangeType = 'buff' | 'nerf' | 'adjustment' | 'new' | 'removed' | 'text'
export type EntityCategory =
  | 'champion'
  | 'item'
  | 'rune'
  | 'system'
  | 'aram'
  | 'aram-chaos'
  | 'arena'
  | 'bugfix'

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

export function resolvePatchNotesAssetPath(
  localPath: string | undefined,
  patchVersion: string
): string | null {
  if (!localPath) return null
  if (localPath.startsWith('http://') || localPath.startsWith('https://')) return localPath
  if (localPath.startsWith('/data/patch-notes/')) return localPath
  if (localPath.startsWith('data/patch-notes/')) {
    return `/${localPath}`
  }
  if (localPath.startsWith('data/patches/')) {
    const filename = localPath.split('/').pop() ?? localPath
    // Legacy paths may reference 26.x filenames while files are stored as 16.x
    const normalizedFilename = filename.replace(/^patch-26\.(\d+)-/, `patch-16.$1-`)
    return `${getPatchNotesBaseUrl()}/${patchVersion}/${normalizedFilename}`
  }
  if (!localPath.includes('/')) {
    return `${getPatchNotesBaseUrl()}/${patchVersion}/${localPath}`
  }
  return `${getPatchNotesBaseUrl()}/${localPath.replace(/^data\/patch-notes\//, '')}`
}

export function resolveSummaryImageUrl(
  patchVersion: string,
  patchLocale: string,
  index: PatchIndex | null,
  summaryImage?: PatchSummaryImage
): string | null {
  const entry = index?.patches.find(p => p.version === patchVersion)
  const summaryFilename = entry?.files?.summary?.[patchLocale] ?? entry?.files?.summary?.['en-GB']

  if (summaryFilename) {
    return `${getPatchNotesBaseUrl()}/${patchVersion}/${summaryFilename}`
  }

  if (summaryImage?.localPath) {
    const resolved = resolvePatchNotesAssetPath(summaryImage.localPath, patchVersion)
    if (resolved) return resolved
  }

  return summaryImage?.url ?? null
}

function getPatchJsonUrl(version: string, patchLocale: string): string {
  return `${getPatchNotesBaseUrl()}/${version}/patch-${version}-${patchLocale}.json`
}

/** Single-flight: parallel loads share one fetch. */
let loadIndexInflight: Promise<void> | null = null
let loadPatchInflight: Promise<PatchData | null> | null = null
let loadPatchInflightKey: string | null = null

export const usePatchNotesStore = defineStore('patchNotes', () => {
  const index = ref<PatchIndex | null>(null)
  const currentPatch = ref<PatchData | null>(null)
  const selectedVersion = ref<string | null>(null)
  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const error = ref<string | null>(null)

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
  const aram = computed(
    () => currentPatch.value?.entities?.filter(e => e.category === 'aram') ?? []
  )
  const aramChaos = computed(
    () => currentPatch.value?.entities?.filter(e => e.category === 'aram-chaos') ?? []
  )
  const arena = computed(
    () => currentPatch.value?.entities?.filter(e => e.category === 'arena') ?? []
  )
  const bugfix = computed(
    () => currentPatch.value?.entities?.filter(e => e.category === 'bugfix') ?? []
  )

  const getSummaryImagePath = computed(() => {
    if (!currentPatch.value?.patchVersion) return null
    const patchLocale = currentPatch.value.locale
    return resolveSummaryImageUrl(
      currentPatch.value.patchVersion,
      patchLocale,
      index.value,
      currentPatch.value.summaryImage
    )
  })

  async function loadIndex(force = false): Promise<void> {
    if (index.value && !force) return
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
      selectedVersion.value = version
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

        const response = await fetch(getPatchJsonUrl(version, patchLocale), { cache: 'no-cache' })

        if (!response.ok) {
          if (patchLocale !== 'en-GB') {
            const fallbackResponse = await fetch(getPatchJsonUrl(version, 'en-GB'), {
              cache: 'no-cache',
            })
            if (fallbackResponse.ok) {
              currentPatch.value = await fallbackResponse.json()
              selectedVersion.value = version
              status.value = 'success'
              return currentPatch.value
            }
          }
          throw new Error(`Failed to load patch ${version}: ${response.status}`)
        }

        currentPatch.value = await response.json()
        selectedVersion.value = version
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

  async function selectPatch(version: string, locale: string): Promise<PatchData | null> {
    await loadIndex()
    return loadPatch(version, locale)
  }

  return {
    index,
    currentPatch,
    selectedVersion,
    status,
    error,
    latestVersion,
    availablePatches,
    champions,
    items,
    runes,
    systems,
    aram,
    aramChaos,
    arena,
    bugfix,
    getSummaryImagePath,
    loadIndex,
    loadPatch,
    loadLatestPatch,
    selectPatch,
  }
})
