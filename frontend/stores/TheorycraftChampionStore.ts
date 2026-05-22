import { defineStore } from 'pinia'
import { useVersionStore } from './VersionStore'
import { getFallbackGameVersion } from '~/config/version'
import { getChampionDetailUrl, getChampionIndexUrl } from '~/utils/staticDataUrl'

type SupportedLang = 'fr_FR' | 'en_US'

type ChampionIndexEntry = {
  id: string
  key: number
  name: string
  title: string
  roles: string[]
  tags: string[]
}

type ChampionDetailResponse = {
  schemaVersion: number
  dataVersion: string
  generatedAt: string
  champion: Record<string, unknown>
}

interface TheorycraftChampionState {
  indexByLang: Record<SupportedLang, ChampionIndexEntry[]>
  championByKey: Record<string, Record<string, unknown>>
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
}

const loadIndexInflight = new Map<SupportedLang, Promise<ChampionIndexEntry[]>>()
const loadChampionInflight = new Map<string, Promise<Record<string, unknown>>>()

export const useTheorycraftChampionStore = defineStore('theorycraftChampion', {
  state: (): TheorycraftChampionState => ({
    indexByLang: {
      fr_FR: [],
      en_US: [],
    },
    championByKey: {},
    status: 'idle',
    error: null,
  }),
  actions: {
    async resolveGameVersion(): Promise<string> {
      const versionStore = useVersionStore()
      if (!versionStore.currentVersion) {
        await versionStore.loadCurrentVersion()
      }
      return versionStore.currentVersion || getFallbackGameVersion()
    },
    async loadIndex(lang: SupportedLang): Promise<ChampionIndexEntry[]> {
      const cached = this.indexByLang[lang]
      if (cached.length > 0) return cached

      const inflight = loadIndexInflight.get(lang)
      if (inflight) return inflight

      const request = (async (): Promise<ChampionIndexEntry[]> => {
        this.status = 'loading'
        try {
          const version = await this.resolveGameVersion()
          const payload = await $fetch<{ champions: ChampionIndexEntry[] }>(
            getChampionIndexUrl(version, lang)
          )
          const champions = Array.isArray(payload.champions) ? payload.champions : []
          this.indexByLang[lang] = champions
          this.status = 'success'
          return champions
        } catch (error) {
          this.status = 'error'
          this.error = error instanceof Error ? error.message : 'Failed to load champion index'
          throw error
        } finally {
          loadIndexInflight.delete(lang)
        }
      })()

      loadIndexInflight.set(lang, request)
      return await request
    },
    async loadChampion(lang: SupportedLang, id: string): Promise<Record<string, unknown>> {
      const key = `${lang}:${id.toLowerCase()}`
      const cached = this.championByKey[key]
      if (cached) return cached

      const inflight = loadChampionInflight.get(key)
      if (inflight) return inflight

      const request = (async (): Promise<Record<string, unknown>> => {
        this.status = 'loading'
        try {
          const version = await this.resolveGameVersion()
          const payload = await $fetch<ChampionDetailResponse>(
            getChampionDetailUrl(version, lang, id)
          )
          this.championByKey[key] = payload.champion ?? {}
          this.status = 'success'
          return this.championByKey[key] ?? {}
        } catch (error) {
          this.status = 'error'
          this.error = error instanceof Error ? error.message : 'Failed to load champion details'
          throw error
        } finally {
          loadChampionInflight.delete(key)
        }
      })()

      loadChampionInflight.set(key, request)
      return await request
    },
  },
})
