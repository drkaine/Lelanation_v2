import { defineStore } from 'pinia'
import type {
  Build,
  Champion,
  Item,
  RuneSelection,
  ShardSelection,
  SummonerSpell,
  SkillOrder,
  CalculatedStats,
} from '~/types/build'
import { useVersionStore } from '~/stores/VersionStore'

interface BuildState {
  currentBuild: Build | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  calculatedStats: CalculatedStats | null
}

export const useBuildStore = defineStore('build', {
  state: (): BuildState => ({
    currentBuild: null,
    status: 'idle',
    error: null,
    calculatedStats: null,
  }),

  getters: {
    isBuildValid(): boolean {
      if (!this.currentBuild) return false
      const build = this.currentBuild

      // Check champion
      if (!build.champion) return false

      // Check items (at least 1). UI supports: 2 starters + 2 boots + 6 core = up to 10.
      if (!build.items || build.items.length === 0 || build.items.length > 10) {
        return false
      }

      // Check runes
      if (!build.runes) return false
      if (!build.runes.primary.pathId || !build.runes.primary.keystone) {
        return false
      }
      if (!build.runes.secondary.pathId) return false

      // Check summoner spells (exactly 2)
      if (
        !build.summonerSpells ||
        build.summonerSpells.length !== 2 ||
        !build.summonerSpells[0] ||
        !build.summonerSpells[1]
      ) {
        return false
      }

      // Check skill order (all 18 levels)
      if (!build.skillOrder) return false
      const levels = Object.keys(build.skillOrder) as Array<keyof SkillOrder>
      if (levels.length !== 18) return false
      for (const level of levels) {
        if (!build.skillOrder[level]) return false
      }

      return true
    },

    validationErrors(): string[] {
      const errors: string[] = []
      if (!this.currentBuild) {
        errors.push('No build created')
        return errors
      }

      const build = this.currentBuild

      if (!build.champion) {
        errors.push('Champion must be selected')
      }

      if (!build.items || build.items.length === 0) {
        errors.push('At least one item must be selected')
      } else if (build.items.length > 10) {
        errors.push('Maximum 10 items allowed')
      }

      if (!build.runes) {
        errors.push('Runes must be configured')
      } else {
        if (!build.runes.primary.pathId || !build.runes.primary.keystone) {
          errors.push('Primary rune tree and keystone must be selected')
        }
        if (!build.runes.secondary.pathId) {
          errors.push('Secondary rune tree must be selected')
        }
      }

      if (
        !build.summonerSpells ||
        build.summonerSpells.length !== 2 ||
        !build.summonerSpells[0] ||
        !build.summonerSpells[1]
      ) {
        errors.push('Two summoner spells must be selected')
      }

      if (!build.skillOrder) {
        errors.push('Skill order must be configured')
      } else {
        const levels = Object.keys(build.skillOrder) as Array<keyof SkillOrder>
        if (levels.length !== 18) {
          errors.push('Skill order must be complete (18 levels)')
        }
      }

      return errors
    },
  },

  actions: {
    setCurrentBuild(build: Build) {
      this.currentBuild = build
      this.status = 'success'
      this.error = null
      this.recalculateStats()
    },

    /**
     * Import an external build (e.g. from a shared link) into localStorage with a new ID.
     * Returns new build ID, or null if failed.
     */
    importBuild(build: Build, options?: { nameSuffix?: string }): string | null {
      try {
        const now = new Date().toISOString()
        const suffix = options?.nameSuffix ?? ' (copie)'
        const copied: Build = {
          ...build,
          id: crypto.randomUUID(),
          name: build.name ? `${build.name}${suffix}` : `Build${suffix}`,
          createdAt: now,
          updatedAt: now,
        }

        const savedBuilds = this.getSavedBuilds()
        savedBuilds.push(copied)
        localStorage.setItem('lelanation_builds', JSON.stringify(savedBuilds))
        return copied.id
      } catch {
        return null
      }
    },
    createNewBuild() {
      this.currentBuild = {
        id: crypto.randomUUID(),
        name: 'New Build',
        author: '',
        description: '',
        visibility: 'public',
        champion: null,
        items: [],
        runes: null,
        shards: null,
        summonerSpells: [null, null],
        skillOrder: null,
        gameVersion: '', // Will be set from version service
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.status = 'idle'
      this.error = null
    },

    setChampion(champion: Champion) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (this.currentBuild) {
        this.currentBuild.champion = champion
        this.currentBuild.updatedAt = new Date().toISOString()
        // Trigger stats recalculation
        this.recalculateStats()
      }
    },

    addItem(item: Item) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (this.currentBuild && this.currentBuild.items.length < 10) {
        this.currentBuild.items.push(item)
        this.currentBuild.updatedAt = new Date().toISOString()
        this.recalculateStats()
      }
    },

    removeItem(itemId: string) {
      if (this.currentBuild) {
        this.currentBuild.items = this.currentBuild.items.filter(item => item.id !== itemId)
        this.currentBuild.updatedAt = new Date().toISOString()
        this.recalculateStats()
      }
    },

    setItems(items: Item[]) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (this.currentBuild) {
        this.currentBuild.items = items
        this.currentBuild.updatedAt = new Date().toISOString()
        this.recalculateStats()
      }
    },

    setRunes(runes: RuneSelection) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (this.currentBuild) {
        this.currentBuild.runes = runes
        this.currentBuild.updatedAt = new Date().toISOString()
        this.recalculateStats()
      }
    },

    setShards(shards: ShardSelection) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (this.currentBuild) {
        this.currentBuild.shards = shards
        this.currentBuild.updatedAt = new Date().toISOString()
        this.recalculateStats()
      }
    },

    setSummonerSpell(slot: 0 | 1, spell: SummonerSpell | null) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (this.currentBuild) {
        this.currentBuild.summonerSpells[slot] = spell
        this.currentBuild.updatedAt = new Date().toISOString()
      }
    },

    setSkillOrder(skillOrder: SkillOrder) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (this.currentBuild) {
        this.currentBuild.skillOrder = skillOrder
        this.currentBuild.updatedAt = new Date().toISOString()
      }
    },

    setName(name: string) {
      if (this.currentBuild) {
        this.currentBuild.name = name
        this.currentBuild.updatedAt = new Date().toISOString()
      }
    },

    setAuthor(author: string) {
      if (this.currentBuild) {
        this.currentBuild.author = author
        this.currentBuild.updatedAt = new Date().toISOString()
      }
    },

    setDescription(description: string) {
      if (this.currentBuild) {
        this.currentBuild.description = description
        this.currentBuild.updatedAt = new Date().toISOString()
      }
    },

    setVisibility(visibility: 'public' | 'private') {
      if (this.currentBuild) {
        this.currentBuild.visibility = visibility
        this.currentBuild.updatedAt = new Date().toISOString()
      }
    },

    recalculateStats() {
      if (!this.currentBuild || !this.currentBuild.champion) {
        this.calculatedStats = null
        return
      }

      // Import and use stats calculator
      import('~/utils/statsCalculator').then(({ calculateStats }) => {
        const stats = calculateStats(
          this.currentBuild!.champion,
          this.currentBuild!.items,
          this.currentBuild!.runes,
          this.currentBuild!.shards,
          18 // Level 18 for now
        )
        this.calculatedStats = stats
      })
    },

    async saveBuild(): Promise<boolean> {
      if (!this.currentBuild) {
        this.error = 'No build to save'
        this.status = 'error'
        return false
      }

      if (!this.isBuildValid) {
        this.error = 'Build is not valid. Please check all required fields.'
        this.status = 'error'
        return false
      }

      try {
        this.status = 'loading'
        // Get current game version
        const versionStore = useVersionStore()
        if (!versionStore.currentVersion) {
          await versionStore.loadCurrentVersion()
        }
        this.currentBuild.gameVersion = versionStore.currentVersion || '16.2.1'

        // 1) Sauvegarde locale (localStorage) pour l'UX rapide
        const savedBuilds = this.getSavedBuilds()
        const existingIndex = savedBuilds.findIndex(b => b.id === this.currentBuild!.id)

        if (existingIndex >= 0) {
          savedBuilds[existingIndex] = this.currentBuild
        } else {
          savedBuilds.push(this.currentBuild)
        }
        localStorage.setItem('lelanation_builds', JSON.stringify(savedBuilds))

        // 2) Sauvegarde fichier JSON côté serveur (dans le front) via l'API
        //    -> best effort seulement : si l'API est down (502 en prod),
        //       on NE casse PAS la sauvegarde locale.
        try {
          const { apiUrl } = await import('~/utils/apiUrl')
          const response = await fetch(apiUrl('/api/builds'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(this.currentBuild),
          })

          if (response.ok) {
            const result = await response.json()
            // Mettre à jour l'ID si le backend en a généré un (cas import ou ancien build)
            if (result.id && !this.currentBuild.id) {
              this.currentBuild.id = result.id
            }
          } else {
            // En prod actuellement on a un 502 -> on ignore pour garder le site statique
            // et on s'appuie sur localStorage + éventuel traitement offline.
            // eslint-disable-next-line no-console
            console.warn('Build saved locally but failed to save JSON on server.', response.status)
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Build saved locally but API /api/builds is unreachable.', e)
        }

        this.status = 'success'
        this.error = null
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to save build'
        this.status = 'error'
        return false
      }
    },

    getSavedBuilds(): Build[] {
      try {
        const stored = localStorage.getItem('lelanation_builds')
        if (!stored) return []
        return JSON.parse(stored) as Build[]
      } catch {
        return []
      }
    },

    loadBuild(buildId: string): boolean {
      try {
        const savedBuilds = this.getSavedBuilds()
        const build = savedBuilds.find(b => b.id === buildId)
        if (build) {
          this.currentBuild = build
          this.status = 'success'
          this.error = null
          this.recalculateStats()
          return true
        }
        this.error = 'Build not found'
        this.status = 'error'
        return false
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to load build'
        this.status = 'error'
        return false
      }
    },

    deleteBuild(buildId: string): boolean {
      try {
        const savedBuilds = this.getSavedBuilds()
        const filtered = savedBuilds.filter(b => b.id !== buildId)
        localStorage.setItem('lelanation_builds', JSON.stringify(filtered))

        // If current build is deleted, clear it
        if (this.currentBuild?.id === buildId) {
          this.currentBuild = null
        }

        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to delete build'
        this.status = 'error'
        return false
      }
    },
  },
})
