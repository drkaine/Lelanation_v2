import { defineStore } from 'pinia'
import { getFallbackGameVersion } from '~/config/version'
import { fetchPublicJson, getChampionIndexUrl, getGameDataUrl } from '~/utils/staticDataUrl'
import {
  collectTermsFromMaps,
  indexChampionTerms,
  indexItemTerms,
  isEmptySearchQuery,
  normalizeSearchText,
  searchAnyIncludes,
} from '~/utils/searchText'

export const SEARCH_LANGUAGES = ['fr_FR', 'en_US'] as const

export type SearchLanguage = (typeof SEARCH_LANGUAGES)[number]

interface MultilingualSearchState {
  status: 'idle' | 'loading' | 'ready' | 'error'
  loadedVersion: string | null
  loadedLanguages: SearchLanguage[]
  championTermsBySlug: Record<string, string[]>
  championTermsByKey: Record<string, string[]>
  itemTermsById: Record<string, string[]>
}

let loadInflight: Promise<void> | null = null
let loadInflightKey: string | null = null

export function riotLocaleFromI18n(locale: string): SearchLanguage {
  return locale === 'en' ? 'en_US' : 'fr_FR'
}

async function fetchChampionIndex(version: string, language: SearchLanguage) {
  try {
    const payload = await fetchPublicJson<{
      champions?: Array<{ id?: string; key?: string | number; name?: string }>
    }>(getChampionIndexUrl(version, language))
    return Array.isArray(payload?.champions) ? payload.champions : []
  } catch {
    return []
  }
}

async function fetchItemRecords(version: string, language: SearchLanguage) {
  let payload: { data?: Record<string, unknown> }
  try {
    payload = await fetchPublicJson<{ data?: Record<string, unknown> }>(
      getGameDataUrl(version, 'item', language)
    )
  } catch {
    return []
  }
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
    loadedLanguages: [],
    championTermsBySlug: {},
    championTermsByKey: {},
    itemTermsById: {},
  }),

  actions: {
    resetForVersion(targetVersion: string) {
      this.championTermsBySlug = {}
      this.championTermsByKey = {}
      this.itemTermsById = {}
      this.loadedLanguages = []
      this.loadedVersion = targetVersion
    },

    async loadLanguages(targetVersion: string, languages: SearchLanguage[]) {
      const pending = languages.filter(lang => !this.loadedLanguages.includes(lang))
      if (pending.length === 0) return

      if (this.loadedVersion && this.loadedVersion !== targetVersion) {
        this.resetForVersion(targetVersion)
      } else if (!this.loadedVersion) {
        this.loadedVersion = targetVersion
      }

      const championLists = await Promise.all(
        pending.map(lang => fetchChampionIndex(targetVersion, lang))
      )
      for (const champions of championLists) {
        for (const champion of champions) {
          indexChampionTerms(this.championTermsBySlug, this.championTermsByKey, champion)
        }
      }

      const itemLists = await Promise.all(
        pending.map(lang => fetchItemRecords(targetVersion, lang))
      )
      for (const records of itemLists) {
        for (const { id, item } of records) {
          indexItemTerms(this.itemTermsById, id, item)
        }
      }

      this.loadedLanguages.push(...pending)
      this.loadedVersion = targetVersion
      this.status = 'ready'
    },

    /** Charge la langue UI (2 JSON : champions + items). */
    async ensureLoaded(version?: string, language?: SearchLanguage) {
      if (import.meta.server) return
      const targetVersion = version || getFallbackGameVersion()
      const primaryLang = language ?? 'fr_FR'

      if (
        this.status === 'ready' &&
        this.loadedVersion === targetVersion &&
        this.loadedLanguages.includes(primaryLang)
      ) {
        return
      }

      const inflightKey = `${targetVersion}|${primaryLang}`
      if (loadInflight && loadInflightKey === inflightKey) {
        await loadInflight
        return
      }

      loadInflightKey = inflightKey
      loadInflight = (async () => {
        this.status = 'loading'
        try {
          await this.loadLanguages(targetVersion, [primaryLang])
        } catch {
          this.status = 'error'
        } finally {
          loadInflight = null
          loadInflightKey = null
        }
      })()

      await loadInflight
    },

    /** Langue secondaire (recherche cross-langue) — uniquement à la demande. */
    ensureSecondaryLanguageLoaded() {
      if (import.meta.server) return
      if (!this.loadedVersion || this.status !== 'ready') return

      const secondary = SEARCH_LANGUAGES.find(lang => !this.loadedLanguages.includes(lang))
      if (!secondary) return

      this.loadLanguages(this.loadedVersion, [secondary]).catch(() => undefined)
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
      if (!isEmptySearchQuery(query)) {
        this.ensureSecondaryLanguageLoaded()
      }
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
      if (!isEmptySearchQuery(query)) {
        this.ensureSecondaryLanguageLoaded()
      }
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
