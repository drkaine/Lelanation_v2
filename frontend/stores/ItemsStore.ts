import { defineStore } from 'pinia'
import type { Item } from '~/types/build'
import { apiUrl } from '~/utils/apiUrl'

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

        // TODO: Load from API endpoint (Epic 2)
        const response = await fetch(apiUrl(`/api/game-data/items?lang=${language}`))
        if (!response.ok) {
          throw new Error('Failed to load items')
        }

        const data = await response.json()
        // Transform Data Dragon format to our format
        this.items = Object.values(data.data || {}) as Item[]
        this.status = 'success'
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load items'
        this.status = 'error'
        this.items = []
      }
    },
  },
})
