import { defineStore } from 'pinia'
import type { Champion } from '@lelanation/shared-types'
import { useVersionStore } from './VersionStore'
import { getFallbackGameVersion } from '~/config/version'
import { getChampionDetailUrl, getChampionIndexUrl } from '~/utils/staticDataUrl'

const ABILITY_ORDER = ['Q', 'W', 'E', 'R'] as const

function abilityRank(slot: string): number {
  const normalized = String(slot || '').toUpperCase()
  const idx = ABILITY_ORDER.indexOf(normalized as (typeof ABILITY_ORDER)[number])
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}

function normalizeChampionDetail(detail: any, current: Champion, fallbackId: string): Champion {
  const championId = String(detail?.id ?? current.id ?? fallbackId)
  const rawSpells = Array.isArray(detail?.spells) ? detail.spells : []
  const sortedSpells = [...rawSpells].sort(
    (a, b) => abilityRank(String(a?.slot ?? '')) - abilityRank(String(b?.slot ?? ''))
  )

  const spells = sortedSpells.map((spell, index) => {
    const slot = String(spell?.slot ?? ABILITY_ORDER[index] ?? '').toUpperCase()
    const slotInOrder = ABILITY_ORDER.includes(slot)
    const fallbackSpellImage = `${championId}${slotInOrder ? slot : (ABILITY_ORDER[index] ?? 'Q')}.png`
    return {
      ...spell,
      image: spell?.image ?? { full: fallbackSpellImage },
      description: String(
        spell?.descriptionHtml ??
          spell?.descriptionParsed ??
          spell?.descriptionText ??
          spell?.parsedText ??
          ''
      ),
      descriptionHtml:
        spell?.descriptionHtml ??
        spell?.descriptionParsed ??
        (typeof spell?.description === 'string' && spell.description.includes('<')
          ? spell.description
          : undefined),
      descriptionParsed: spell?.descriptionParsed ?? spell?.descriptionHtml,
      descriptionText: spell?.descriptionText ?? spell?.parsedText,
      parsedText: spell?.parsedText ?? spell?.descriptionText,
      summaryHtml: spell?.summaryHtml,
      detailedTexts: spell?.detailedTexts,
      headerStats: spell?.headerStats,
      tickStats: spell?.tickStats,
    }
  })

  const passive = detail?.passive
    ? {
        ...detail.passive,
        image: detail.passive?.image ?? { full: `${championId}_Passive.png` },
        description: String(
          detail.passive?.descriptionHtml ??
            detail.passive?.descriptionParsed ??
            detail.passive?.descriptionText ??
            detail.passive?.parsedText ??
            ''
        ),
        descriptionHtml:
          detail.passive?.descriptionHtml ??
          detail.passive?.descriptionParsed ??
          (typeof detail.passive?.description === 'string' &&
          detail.passive.description.includes('<')
            ? detail.passive.description
            : undefined),
        descriptionParsed: detail.passive?.descriptionParsed ?? detail.passive?.descriptionHtml,
        descriptionText: detail.passive?.descriptionText ?? detail.passive?.parsedText,
        parsedText: detail.passive?.parsedText ?? detail.passive?.descriptionText,
      }
    : current.passive

  return {
    ...current,
    ...detail,
    id: championId,
    key: String(detail?.key ?? current.key ?? ''),
    tags: Array.isArray(detail?.tags)
      ? detail.tags
      : Array.isArray(current.tags)
        ? current.tags
        : [],
    image: detail?.image ?? current.image ?? { full: `${championId}.png` },
    spells: spells.length > 0 ? spells : current.spells,
    passive,
  } as Champion
}

interface ChampionsState {
  champions: Champion[]
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  loadedDetailKeys: Record<string, true>
}

export const useChampionsStore = defineStore('champions', {
  state: (): ChampionsState => ({
    champions: [],
    status: 'idle',
    error: null,
    loadedDetailKeys: {},
  }),

  getters: {
    championsByRole(): Record<string, Champion[]> {
      const byRole: Record<string, Champion[]> = {}
      for (const champion of this.champions) {
        for (const tag of champion.tags) {
          if (!byRole[tag]) {
            byRole[tag] = []
          }
          byRole[tag].push(champion)
        }
      }
      return byRole
    },

    searchChampions() {
      return (query: string, roles?: string | string[]): Champion[] => {
        let filtered = this.champions

        // Filter by role(s) if provided
        if (roles) {
          const rolesArray = Array.isArray(roles) ? roles : [roles]
          if (rolesArray.length > 0) {
            // Show champions that have ALL of the selected roles
            filtered = filtered.filter(champion =>
              rolesArray.every(role => champion.tags.includes(role))
            )
          }
        }

        // Search by name
        if (query) {
          const lowerQuery = query.toLowerCase()
          filtered = filtered.filter(
            champion =>
              champion.name.toLowerCase().includes(lowerQuery) ||
              champion.id.toLowerCase().includes(lowerQuery)
          )
        }

        return filtered
      }
    },
  },

  actions: {
    async resolveGameVersion(): Promise<string> {
      const versionStore = useVersionStore()
      if (!versionStore.currentVersion) {
        await versionStore.loadCurrentVersion()
      }
      return versionStore.currentVersion || getFallbackGameVersion()
    },
    async loadChampions(language: string = 'fr_FR') {
      try {
        this.status = 'loading'
        this.error = null

        const version = await this.resolveGameVersion()
        const response = await fetch(`${getChampionIndexUrl(version, language)}?_t=${Date.now()}`, {
          cache: 'no-cache',
        })
        if (!response.ok) {
          throw new Error(`Static champion index returned ${response.status}`)
        }
        const payload = await response.json()
        const champions = Array.isArray(payload?.champions) ? payload.champions : []
        this.loadedDetailKeys = {}
        this.champions = champions.map((champion: any) => {
          const id = String(champion.id ?? '')
          return {
            ...(champion as Champion),
            id,
            key: String(champion.key ?? ''),
            tags: Array.isArray(champion.tags) ? champion.tags : [],
            image: champion.image ?? { full: `${id}.png` },
          } as Champion
        })
        this.status = 'success'
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load champions'
        this.status = 'error'
        // Fallback: empty array, will be populated when data is available
        this.champions = []
      }
    },
    async loadChampionDetails(
      championId: string,
      language: string = 'fr_FR'
    ): Promise<Champion | null> {
      const id = String(championId || '').trim()
      if (!id) return null

      const championIndex = this.champions.findIndex(champion => champion.id === id)
      if (championIndex === -1) return null

      const cacheKey = `${language}:${id.toLowerCase()}`
      if (this.loadedDetailKeys[cacheKey]) {
        return this.champions[championIndex] ?? null
      }

      try {
        const version = await this.resolveGameVersion()
        const response = await fetch(
          `${getChampionDetailUrl(version, language, id)}?_t=${Date.now()}`,
          {
            cache: 'no-cache',
          }
        )
        if (!response.ok) {
          return this.champions[championIndex] ?? null
        }

        const payload = await response.json()
        const detail = payload?.champion
        if (!detail || typeof detail !== 'object') {
          return this.champions[championIndex] ?? null
        }

        const current = this.champions[championIndex]
        if (!current) {
          return null
        }
        const merged = normalizeChampionDetail(detail, current, id)

        this.champions.splice(championIndex, 1, merged)
        this.loadedDetailKeys[cacheKey] = true
        return merged
      } catch {
        return this.champions[championIndex] ?? null
      }
    },
  },
})
