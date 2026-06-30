import { defineStore } from 'pinia'
import { getFallbackGameVersion } from '~/config/version'
import { getChampionIndexUrl, getGameDataUrl } from '~/utils/staticDataUrl'
import {
  collectTermsFromMaps,
  indexChampionTerms,
  indexItemTerms,
  isEmptySearchQuery,
  normalizeSearchText,
  searchAnyIncludes,
} from '~/utils/searchText'

const SEARCH_LANGUAGES = ['fr_FR', 'en_US'] as const

type SearchLanguage = (typeof SEARCH_LANGUAGES)[number]

interface MultilingualSearchState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  loadedVersion: string | null
  championTermsBySlug: Record<string, string[]>
  championTermsByKey: Record<string, string[]>
  itemTermsById: Record<string, string[]>
}

let loadInflight: Promise<void> | null = null
let loadInflightVersion: string | null = null

async function fetchChampionIndex(version: string, language: SearchLanguage) {
  const response = await fetch(getChampionIndexUrl(version, language))
  if (!response.ok) return []
  const payload = await response.json()
  return Array.isArray(payload?.champions) ? payload.champions : []
}

async function fetchItemRecords(version: string, language: SearchLanguage) {
  const response = await fetch(getGameDataUrl(version, 'item', language))
  if (!response.ok) return []
  const payload = await response.json()
  const raw = payload?.data
  if (!raw || typeof raw !== 'object') return []
  return Object.entries(raw as Record<string, unknown>).map(([id, item]) => ({
    id,
    item: item as { name?: string; colloq?: string; plaintext?: string },
  }))
}

export const useMultilingualSearchStore = defineStore('multilingualSearch', {
  state: (): MultilingualSearchState => ({
    status: 'idle',
    loadedVersion: null,
    championTermsBySlug: {},
    championTermsByKey: {},
    itemTermsById: {},
  }),

  actions: {
    async ensureLoaded(version?: string) {
      if (import.meta.server) return
      const targetVersion = version || getFallbackGameVersion()
      if (this.status === 'ready' && this.loadedVersion === targetVersion) return

      if (loadInflight && loadInflightVersion === targetVersion) {
        await loadInflight
        return
      }

      loadInflightVersion = targetVersion
      loadInflight = (async () => {
        this.status = 'loading'
        try {
          const championBySlug: Record<string, string[]> = {}
          const championByKey: Record<string, string[]> = {}
          const itemById: Record<string, string[]> = {}

          const championLists = await Promise.all(
            SEARCH_LANGUAGES.map(lang => fetchChampionIndex(targetVersion, lang))
          )
          for (const champions of championLists) {
            for (const champion of champions) {
              indexChampionTerms(championBySlug, championByKey, champion)
            }
          }

          const itemLists = await Promise.all(
            SEARCH_LANGUAGES.map(lang => fetchItemRecords(targetVersion, lang))
          )
          for (const records of itemLists) {
            for (const { id, item } of records) {
              indexItemTerms(itemById, id, item)
            }
          }

          this.championTermsBySlug = championBySlug
          this.championTermsByKey = championByKey
          this.itemTermsById = itemById
          this.loadedVersion = targetVersion
          this.status = 'ready'
        } catch {
          this.status = 'error'
        } finally {
          loadInflight = null
          loadInflightVersion = null
        }
      })()

      await loadInflight
    },

    championMatches(
      query: string,
      opts: {
        id?: string | null
        key?: string | number | null
        championId?: string | number | null
        name?: string | null
      } = {}
    ): boolean {
      if (isEmptySearchQuery(query)) return true

      const q = normalizeSearchText(query)
      const terms = new Set<string>()

      if (opts.name) terms.add(normalizeSearchText(opts.name))

      const slug = String(opts.id ?? '').trim()
      if (slug) {
        for (const term of collectTermsFromMaps([this.championTermsBySlug], slug)) terms.add(term)
      }

      const numericKeys = [opts.key, opts.championId, slug && /^\d+$/.test(slug) ? slug : null]
        .filter(value => value != null && String(value).trim() !== '')
        .map(value => String(value).trim())

      for (const key of numericKeys) {
        for (const term of collectTermsFromMaps([this.championTermsByKey], key)) terms.add(term)
      }

      if (terms.size === 0) {
        return searchAnyIncludes(query, [opts.name ?? '', slug, ...numericKeys])
      }

      return [...terms].some(term => term.includes(q))
    },

    itemMatches(
      query: string,
      opts: {
        id?: string | number | null
        name?: string | null
        colloq?: string | null
        plaintext?: string | null
      } = {}
    ): boolean {
      if (isEmptySearchQuery(query)) return true

      const q = normalizeSearchText(query)
      const id = opts.id != null ? String(opts.id).trim() : ''
      const terms = new Set<string>()

      for (const local of [opts.name, opts.colloq, opts.plaintext]) {
        if (local) terms.add(normalizeSearchText(local))
      }

      if (id) {
        for (const term of collectTermsFromMaps([this.itemTermsById], id)) terms.add(term)
      }

      if (terms.size === 0) {
        return searchAnyIncludes(query, [opts.name, opts.colloq, opts.plaintext, id])
      }

      return [...terms].some(term => term.includes(q))
    },
  },
})
