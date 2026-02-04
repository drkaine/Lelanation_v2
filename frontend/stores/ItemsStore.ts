import { defineStore } from 'pinia'
import { useVersionStore } from './VersionStore'
import { getFallbackGameVersion } from '~/config/version'
import type { Item } from '~/types/build'
import { apiUrl } from '~/utils/apiUrl'
import { getGameDataUrl } from '~/utils/staticDataUrl'

interface ItemsState {
  items: Item[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
}

export const useItemsStore = defineStore('items', {
  state: (): ItemsState => ({
    items: [],
    status: 'idle',
    error: null,
  }),

  getters: {
    searchItems() {
      return (query: string, tags?: string[]): Item[] => {
        let filtered = this.items

        // Filter by tags if provided
        if (tags && tags.length > 0) {
          filtered = filtered.filter(item => tags.some(tag => item.tags.includes(tag)))
        }

        // Search by name
        if (query) {
          const lowerQuery = query.toLowerCase()
          filtered = filtered.filter(
            item =>
              item.name.toLowerCase().includes(lowerQuery) ||
              item.colloq?.toLowerCase().includes(lowerQuery) ||
              item.plaintext?.toLowerCase().includes(lowerQuery)
          )
        }

        return filtered
      }
    },

    itemsByTag(): Record<string, Item[]> {
      const byTag: Record<string, Item[]> = {}
      for (const item of this.items) {
        for (const tag of item.tags) {
          if (!byTag[tag]) {
            byTag[tag] = []
          }
          byTag[tag].push(item)
        }
      }
      return byTag
    },
  },

  actions: {
    async loadItems(language: string = 'fr_FR') {
      try {
        this.status = 'loading'
        this.error = null

        // Try to load from static file first (faster, no API call)
        const versionStore = useVersionStore()
        if (!versionStore.currentVersion) {
          await versionStore.loadCurrentVersion()
        }
        const version = versionStore.currentVersion || getFallbackGameVersion()

        let data: any
        let useStatic = false

        // Try static file first (only in browser, not SSR)
        if (process.client) {
          try {
            // Add cache-busting parameter based on version to force reload after sync
            const staticUrl = getGameDataUrl(version, 'item', language)
            const urlWithCacheBust = `${staticUrl}?_v=${version.replace(/\./g, '_')}`
            const staticResponse = await fetch(urlWithCacheBust, {
              cache: 'no-cache',
            })
            if (staticResponse.ok) {
              data = await staticResponse.json()
              useStatic = true
            }
          } catch (staticError) {
            // Static file not available, will try API - silently continue
          }
        }

        // Fallback to API if static file not available
        // Always try API as fallback (even in production) since static files might not exist yet
        if (!useStatic) {
          try {
            const apiUrlValue = apiUrl(`/api/game-data/items?lang=${language}`)
            const response = await fetch(apiUrlValue, {
              signal: AbortSignal.timeout(5000),
            })
            if (!response.ok) {
              this.items = []
              this.status = 'success'
              return
            }
            data = await response.json()
          } catch (apiError) {
            this.items = []
            this.status = 'success'
            return
          }
        }

        // Transform Data Dragon format to our format
        // Keys of data.data are the string IDs ("1001", "2055", "1101", etc.)
        // We need to inject them into each item so categorisation and selection
        // logic can reliably use item.id across all languages.
        const rawItems = data?.data || {}
        this.items = Object.entries(rawItems).map(([id, item]) => {
          return {
            ...(item as Item),
            id,
          }
        })
        this.status = 'success'
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load items'
        this.status = 'error'
        this.items = []
      }
    },
  },
})
