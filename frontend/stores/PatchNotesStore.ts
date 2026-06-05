import { defineStore } from 'pinia'
import { apiUrl } from '~/utils/apiUrl'

export type PatchChangeType = 'buff' | 'nerf' | 'adjust' | 'rework'

export interface PatchChange {
  stat: string
  old_value: string
  new_value: string
  type: PatchChangeType
  description_fr: string
  description_en: string
}

export interface PatchEntity {
  slug: string
  name_fr: string
  name_en: string
  image_url?: string
  ddragon_id: string
  global_type: PatchChangeType
  changes: PatchChange[]
}

export interface PatchHighlight {
  title_fr: string
  title_en: string
  image_url?: string
}

export interface PatchSkin {
  name_fr: string
  name_en: string
  champion: string
  image_url?: string
}

export interface PatchSystemSection {
  title_fr: string
  title_en: string
  content_fr: string
  content_en: string
}

export interface PatchNotesData {
  version: string
  date: string
  summary: { fr: string; en: string }
  highlights: PatchHighlight[]
  champions: PatchEntity[]
  items: PatchEntity[]
  runes: PatchEntity[]
  systems: PatchSystemSection[]
  skins: PatchSkin[]
}

export interface PatchNotesIndex {
  latest: string
  patches: string[]
}

export interface BuildCheckResult {
  score: number
  status: 'current' | 'affected' | 'outdated'
  affected: Array<{
    entity_type: 'champion' | 'item' | 'rune'
    slug: string
    name_fr: string
    name_en: string
    ddragon_id: string
    global_type: PatchChangeType
    patch_version: string
    changes: PatchChange[]
  }>
  patches_since: number
}

type PatchEntityTab = 'champions' | 'items' | 'runes' | 'systems' | 'skins'

export const usePatchNotesStore = defineStore('patchNotes', {
  state: () => ({
    index: null as PatchNotesIndex | null,
    patchesCache: {} as Record<string, PatchNotesData>,
    currentPatch: null as PatchNotesData | null,
    selectedVersion: '' as string,
    lang: 'fr' as 'fr' | 'en',
    activeTab: 'champions' as PatchEntityTab,
    loading: false,
    error: null as string | null,
    buildCheckResult: null as BuildCheckResult | null,
    buildCheckLoading: false,
  }),

  getters: {
    patches(): string[] {
      return this.index?.patches ?? []
    },
    latestPatch(): string {
      return this.index?.latest ?? ''
    },
    entityCount(): Record<PatchEntityTab, number> {
      const patch = this.currentPatch
      return {
        champions: patch?.champions.length ?? 0,
        items: patch?.items.length ?? 0,
        runes: patch?.runes.length ?? 0,
        systems: patch?.systems.length ?? 0,
        skins: patch?.skins.length ?? 0,
      }
    },
    activeEntities(): PatchEntity[] | PatchSystemSection[] | PatchSkin[] {
      if (!this.currentPatch) return []
      return this.currentPatch[this.activeTab] ?? []
    },
    cachedPatches(): PatchNotesData[] {
      const versions = this.index?.patches ?? Object.keys(this.patchesCache)
      return versions.map(v => this.patchesCache[v]).filter((p): p is PatchNotesData => Boolean(p))
    },
  },

  actions: {
    async loadIndex() {
      this.loading = true
      this.error = null
      try {
        const res = await fetch(apiUrl('/api/patch-notes'))
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        this.index = await res.json()
        await this.loadAllPatches()
        if (!this.selectedVersion && this.index?.latest) {
          await this.selectPatch(this.index.latest)
        }
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load patch index'
      } finally {
        this.loading = false
      }
    },

    async fetchPatch(version: string): Promise<PatchNotesData | null> {
      if (this.patchesCache[version]) return this.patchesCache[version]
      const res = await fetch(apiUrl(`/api/patch-notes/${encodeURIComponent(version)}`))
      if (!res.ok) return null
      const patch = (await res.json()) as PatchNotesData
      this.patchesCache[version] = patch
      return patch
    },

    async loadAllPatches() {
      if (!this.index?.patches.length) return
      await Promise.all(this.index.patches.map(v => this.fetchPatch(v)))
    },

    async loadPatch(version: string) {
      if (!version) return
      this.loading = true
      this.error = null
      this.selectedVersion = version
      try {
        const patch = await this.fetchPatch(version)
        if (!patch) throw new Error(`HTTP 404`)
        this.currentPatch = patch
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Failed to load patch'
        this.currentPatch = null
      } finally {
        this.loading = false
      }
    },

    async selectPatch(version: string) {
      const cached = this.patchesCache[version]
      this.selectedVersion = version
      this.currentPatch = cached ?? null
      if (!cached) {
        await this.loadPatch(version)
      }
    },

    setLang(lang: 'fr' | 'en') {
      this.lang = lang
    },

    setActiveTab(tab: PatchEntityTab) {
      this.activeTab = tab
    },

    async checkBuild(payload: {
      champion_ddragon_id?: string
      items?: Array<{ ddragon_id: string }>
      runes?: Array<{ ddragon_id: string }>
      patch_created: string
    }) {
      this.buildCheckLoading = true
      this.buildCheckResult = null
      try {
        const res = await fetch(apiUrl('/api/patch-notes/check-build'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        this.buildCheckResult = await res.json()
      } catch (e) {
        this.error = e instanceof Error ? e.message : 'Build check failed'
      } finally {
        this.buildCheckLoading = false
      }
    },
  },
})
