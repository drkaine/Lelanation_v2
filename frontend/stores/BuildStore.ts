import { defineStore } from 'pinia'
import type {
  Build,
  SubBuild,
  Champion,
  Item,
  RuneSelection,
  ShardSelection,
  SummonerSpell,
  SkillOrder,
  CalculatedStats,
  Role,
} from '@lelanation/shared-types'
import { getFallbackGameVersion } from '~/config/version'
import { apiUrl } from '~/utils/apiUrl'
import { serializeBuild, hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import { useVersionStore } from '~/stores/VersionStore'
import { useVoteStore } from '~/stores/VoteStore'

interface BuildState {
  currentBuild: Build | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  calculatedStats: CalculatedStats | null
  /** Incrémenté à chaque modification de la liste sauvegardée (save/delete/copy) pour forcer le refresh des vues. */
  savedBuildsVersion: number
  /** Variante actuellement affichée dans le builder : 'main' = build principal, number = index dans subBuilds. */
  displayedVariant: 'main' | number
  /** Champion en attente de changement (si des variantes existent — confirmation requise). */
  pendingChampionChange: Champion | null
}

export const useBuildStore = defineStore('build', {
  state: (): BuildState => ({
    currentBuild: null,
    status: 'idle',
    error: null,
    calculatedStats: null,
    savedBuildsVersion: 0,
    displayedVariant: 'main',
    pendingChampionChange: null,
  }),

  getters: {
    /**
     * Build actuellement affiché (build principal ou variante sélectionnée).
     * Utilisé pour les stats, la card, et le partage.
     */
    displayedBuild(): Build | null {
      if (!this.currentBuild) return null
      if (this.displayedVariant === 'main') return this.currentBuild
      const subs = this.currentBuild.subBuilds
      if (!subs || typeof this.displayedVariant !== 'number') return this.currentBuild
      const sub = subs[this.displayedVariant]
      if (!sub) return this.currentBuild
      // Merge sub-build into a Build-like object for display (uses parent champion)
      return {
        ...this.currentBuild,
        items: sub.items,
        runes: sub.runes,
        shards: sub.shards,
        summonerSpells: sub.summonerSpells,
        skillOrder: sub.skillOrder,
        roles: sub.roles,
        description: sub.description ?? this.currentBuild.description,
        gameVersion: sub.gameVersion || this.currentBuild.gameVersion,
      } as Build
    },

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

      // Check skill order (firstThreeUps and skillUpOrder must be complete)
      if (!build.skillOrder) return false
      // Les 3 premiers up doivent être définis
      if (!build.skillOrder.firstThreeUps || build.skillOrder.firstThreeUps.length !== 3) {
        return false
      }
      if (build.skillOrder.firstThreeUps.some(up => !up)) return false
      // L'ordre de montée doit être défini
      if (!build.skillOrder.skillUpOrder || build.skillOrder.skillUpOrder.length !== 3) {
        return false
      }
      if (build.skillOrder.skillUpOrder.some(up => !up)) return false

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
        // Vérifier les 3 premiers up
        if (
          !build.skillOrder.firstThreeUps ||
          build.skillOrder.firstThreeUps.length !== 3 ||
          build.skillOrder.firstThreeUps.some(up => !up)
        ) {
          errors.push('Les 3 premiers "up" doivent être définis (niveaux 1, 2, 3)')
        }
        // Vérifier l'ordre de montée
        if (
          !build.skillOrder.skillUpOrder ||
          build.skillOrder.skillUpOrder.length !== 3 ||
          build.skillOrder.skillUpOrder.some(up => !up)
        ) {
          errors.push("L'ordre de montée des compétences doit être défini (3 compétences)")
        }
      }

      return errors
    },
  },

  actions: {
    setCurrentBuild(build: Build) {
      // Normaliser les champs ajoutés par la feature sous-builds pour les builds anciens
      this.currentBuild = {
        ...build,
        subBuilds: build.subBuilds ?? [],
        descriptionMode: build.descriptionMode ?? 'single',
      }
      this.displayedVariant = 'main'
      this.pendingChampionChange = null
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
        const toStore = savedBuilds.map(b => serializeBuild(b))
        localStorage.setItem('lelanation_builds', JSON.stringify(toStore))
        this.savedBuildsVersion++
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
        shards: {
          slot1: 5008,
          slot2: 5008,
          slot3: 5001,
        },
        summonerSpells: [null, null],
        skillOrder: {
          firstThreeUps: [null as any, null as any, null as any],
          skillUpOrder: [null as any, null as any, null as any],
        },
        roles: [],
        upvote: 0,
        downvote: 0,
        gameVersion: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        subBuilds: [],
        descriptionMode: 'single',
      }
      this.displayedVariant = 'main'
      this.pendingChampionChange = null
      this.status = 'idle'
      this.error = null
    },

    /** Crée une nouvelle variante (sous-build) en dupliquant le build principal. */
    createSubBuild(title?: string) {
      if (!this.currentBuild) return
      const source = this.currentBuild
      const newSub: SubBuild = {
        title: title ?? `Variante ${(this.currentBuild.subBuilds?.length ?? 0) + 2}`,
        description: '',
        champion: this.currentBuild.champion, // Toujours le champion du build principal
        items: [...(source.items ?? [])],
        runes: source.runes
          ? {
              ...source.runes,
              primary: { ...source.runes.primary },
              secondary: { ...source.runes.secondary },
            }
          : null,
        shards: source.shards ? { ...source.shards } : null,
        summonerSpells: [...(source.summonerSpells ?? [null, null])] as [any, any],
        skillOrder: source.skillOrder
          ? {
              firstThreeUps: [...source.skillOrder.firstThreeUps] as any,
              skillUpOrder: [...source.skillOrder.skillUpOrder] as any,
            }
          : null,
        roles: [...(source.roles ?? [])],
        gameVersion: source.gameVersion || '',
      }
      if (!this.currentBuild.subBuilds) this.currentBuild.subBuilds = []
      this.currentBuild.subBuilds.push(newSub)
      this.displayedVariant = this.currentBuild.subBuilds.length - 1
      this.currentBuild.updatedAt = new Date().toISOString()
      this.recalculateStats()
    },

    /** Affiche le build principal (variante 'main'). */
    showMainBuild() {
      this.displayedVariant = 'main'
      this.recalculateStats()
    },

    /** Affiche la variante à l'index donné. */
    showSubBuild(index: number) {
      const subs = this.currentBuild?.subBuilds
      if (!subs || index < 0 || index >= subs.length) return
      this.displayedVariant = index
      this.recalculateStats()
    },

    /** Supprime la variante à l'index donné. */
    removeSubBuild(index: number) {
      if (!this.currentBuild?.subBuilds) return
      this.currentBuild.subBuilds.splice(index, 1)
      // Réajuster displayedVariant si nécessaire
      if (this.displayedVariant === index) {
        this.displayedVariant = 'main'
      } else if (typeof this.displayedVariant === 'number' && this.displayedVariant > index) {
        this.displayedVariant = (this.displayedVariant as number) - 1
      }
      this.currentBuild.updatedAt = new Date().toISOString()
      this.recalculateStats()
    },

    /** Met à jour le titre d'une variante. */
    setSubBuildTitle(index: number, title: string) {
      const sub = this.currentBuild?.subBuilds?.[index]
      if (sub) {
        sub.title = title
        this.currentBuild!.updatedAt = new Date().toISOString()
      }
    },

    /** Met à jour la description d'une variante. */
    setSubBuildDescription(index: number, description: string) {
      const sub = this.currentBuild?.subBuilds?.[index]
      if (sub) {
        sub.description = description
        this.currentBuild!.updatedAt = new Date().toISOString()
      }
    },

    /** Change le mode de description (single/multiple). */
    setDescriptionMode(mode: 'single' | 'multiple') {
      if (this.currentBuild) {
        this.currentBuild.descriptionMode = mode
        this.currentBuild.updatedAt = new Date().toISOString()
      }
    },

    /**
     * Tente de changer le champion du build.
     * Si des variantes existent, stocke le champion en attente et retourne false (l'UI doit afficher un popup).
     * Retourne true si le changement a été appliqué directement.
     */
    setChampion(champion: Champion): boolean {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      const hasVariants = (this.currentBuild?.subBuilds?.length ?? 0) > 0
      if (hasVariants) {
        this.pendingChampionChange = champion
        return false
      }
      if (this.currentBuild) {
        this.currentBuild.champion = champion
        this.currentBuild.updatedAt = new Date().toISOString()
        this.recalculateStats()
      }
      return true
    },

    /** Confirme le changement de champion en attente : supprime les variantes et applique. */
    confirmChampionChange() {
      if (!this.pendingChampionChange || !this.currentBuild) return
      this.currentBuild.champion = this.pendingChampionChange
      this.currentBuild.subBuilds = []
      this.currentBuild.updatedAt = new Date().toISOString()
      this.displayedVariant = 'main'
      this.pendingChampionChange = null
      this.recalculateStats()
    },

    /** Annule le changement de champion en attente. */
    cancelChampionChange() {
      this.pendingChampionChange = null
    },

    /**
     * Retourne la cible d'édition courante : soit le build principal, soit la variante affichée.
     */
    getEditableTarget():
      | { type: 'main'; build: Build }
      | { type: 'sub'; build: Build; sub: SubBuild; index: number }
      | null {
      if (!this.currentBuild) return null
      if (this.displayedVariant === 'main') {
        return { type: 'main', build: this.currentBuild }
      }
      const idx = this.displayedVariant as number
      const subs = this.currentBuild.subBuilds as SubBuild[] | undefined
      if (!subs || idx < 0 || idx >= subs.length) {
        return { type: 'main', build: this.currentBuild }
      }
      const sub = subs[idx]
      if (!sub) {
        return { type: 'main', build: this.currentBuild }
      }
      return { type: 'sub', build: this.currentBuild, sub, index: idx }
    },

    addItem(item: Item) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      const target = this.getEditableTarget()
      if (!target) return
      if (target.type === 'main') {
        if (target.build.items.length >= 10) return
        target.build.items.push(item)
      } else {
        target.sub.items = [...(target.sub.items ?? []), item]
      }
      this.currentBuild!.updatedAt = new Date().toISOString()
      this.recalculateStats()
    },

    removeItem(itemId: string) {
      const target = this.getEditableTarget()
      if (!target) return
      if (target.type === 'main') {
        target.build.items = target.build.items.filter(item => item.id !== itemId)
      } else {
        target.sub.items = (target.sub.items ?? []).filter(item => item.id !== itemId)
      }
      this.currentBuild!.updatedAt = new Date().toISOString()
      this.recalculateStats()
    },

    setItems(items: Item[]) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      const target = this.getEditableTarget()
      if (!target) return
      if (target.type === 'main') {
        target.build.items = items
      } else {
        target.sub.items = items
      }
      this.currentBuild!.updatedAt = new Date().toISOString()
      this.recalculateStats()
    },

    setRunes(runes: RuneSelection) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      const target = this.getEditableTarget()
      if (!target) return
      if (target.type === 'main') {
        target.build.runes = runes
      } else {
        target.sub.runes = runes
      }
      this.currentBuild!.updatedAt = new Date().toISOString()
      this.recalculateStats()
    },

    setShards(shards: ShardSelection) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      const target = this.getEditableTarget()
      if (!target) return
      if (target.type === 'main') {
        target.build.shards = shards
      } else {
        target.sub.shards = shards
      }
      this.currentBuild!.updatedAt = new Date().toISOString()
      this.recalculateStats()
    },

    setSummonerSpell(slot: 0 | 1, spell: SummonerSpell | null) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      const target = this.getEditableTarget()
      if (!target) return
      if (target.type === 'main') {
        target.build.summonerSpells[slot] = spell
      } else {
        if (!target.sub.summonerSpells) {
          target.sub.summonerSpells = [null, null]
        }
        target.sub.summonerSpells[slot] = spell
      }
      this.currentBuild!.updatedAt = new Date().toISOString()
      this.recalculateStats()
    },

    setSkillOrder(skillOrder: SkillOrder) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      const target = this.getEditableTarget()
      if (!target) return
      if (target.type === 'main') {
        target.build.skillOrder = skillOrder
      } else {
        target.sub.skillOrder = skillOrder
      }
      this.currentBuild!.updatedAt = new Date().toISOString()
    },

    /** Rôles partagés entre le build principal et toutes les variantes. */
    setRoles(roles: Role[]) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (!this.currentBuild) return
      this.currentBuild.roles = roles
      if (this.currentBuild.subBuilds && this.currentBuild.subBuilds.length > 0) {
        this.currentBuild.subBuilds = this.currentBuild.subBuilds.map(sub => ({
          ...sub,
          roles,
        }))
      }
      this.currentBuild.updatedAt = new Date().toISOString()
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
      const build = this.displayedBuild ?? this.currentBuild
      if (!build || !build.champion) {
        this.calculatedStats = null
        return
      }

      // Import and use stats calculator
      import('@lelanation/builds-stats').then(({ calculateStats, filterItemsForStats }) => {
        const b = this.displayedBuild ?? this.currentBuild
        if (!b || !b.champion) {
          this.calculatedStats = null
          return
        }
        const filteredItems = filterItemsForStats(b.items)
        const stats = calculateStats(b.champion, filteredItems, b.runes, b.shards, 18)
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
        this.currentBuild.gameVersion = versionStore.currentVersion || getFallbackGameVersion()

        // 1) Sauvegarde locale (localStorage) pour l'UX rapide
        const savedBuilds = this.getSavedBuilds()
        const existingIndex = savedBuilds.findIndex(b => b.id === this.currentBuild!.id)
        const previousBuild = existingIndex >= 0 ? savedBuilds[existingIndex] : null
        const previousVisibility = previousBuild?.visibility ?? null
        const newVisibility = this.currentBuild!.visibility ?? 'public'

        const now = new Date().toISOString()
        this.currentBuild.updatedAt = now
        if (existingIndex >= 0) {
          savedBuilds[existingIndex] = this.currentBuild
        } else {
          this.currentBuild.createdAt = now
          savedBuilds.push(this.currentBuild)
        }
        const toStore = savedBuilds.map(b => serializeBuild(b))
        localStorage.setItem('lelanation_builds', JSON.stringify(toStore))
        this.savedBuildsVersion++

        // 2) Sync serveur selon visibilité :
        //    - Build privé : on ne sauvegarde que en local (pas d'envoi au serveur).
        //    - Passage privé → public : on ajoute/met à jour sur le serveur (POST).
        //    - Passage public → privé : on supprime sur le serveur (DELETE).
        try {
          if (newVisibility === 'private') {
            // Privé : pas d'envoi au serveur. Si on passait de public à privé, supprimer du serveur.
            if (previousVisibility === 'public' && this.currentBuild!.id) {
              const delResponse = await fetch(
                apiUrl(`/api/builds/${encodeURIComponent(this.currentBuild!.id)}`),
                { method: 'DELETE' }
              )
              if (!delResponse.ok && delResponse.status !== 404) {
                // eslint-disable-next-line no-console
                console.warn(
                  'Build saved locally but failed to remove from server (public→private).',
                  delResponse.status
                )
              }
            }
          } else {
            // Public : ajout ou mise à jour sur le serveur (best effort)
            const response = await fetch(apiUrl('/api/builds'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(serializeBuild(this.currentBuild!)),
            })

            if (response.ok) {
              const result = await response.json()
              if (result.id && !this.currentBuild!.id) {
                this.currentBuild!.id = result.id
              }
            } else {
              // eslint-disable-next-line no-console
              console.warn(
                'Build saved locally but failed to save JSON on server.',
                response.status
              )
            }
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Build saved locally but API /api/builds is unreachable.', e)
        }

        // 3) Vérifier si le build doit passer en privé automatiquement (votes)
        await this.checkAndUpdateVisibility()

        this.status = 'success'
        this.error = null
        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to save build'
        this.status = 'error'
        return false
      }
    },

    async checkAndUpdateVisibility(buildId?: string) {
      const targetId = buildId ?? this.currentBuild?.id
      if (!targetId) return

      const voteStore = useVoteStore()
      const upvotes = voteStore.getUpvoteCount(targetId)
      const downvotes = voteStore.getDownvoteCount(targetId)
      const totalVotes = upvotes + downvotes

      if (totalVotes >= 10) {
        const upvotePercentage = (upvotes / totalVotes) * 100
        if (upvotePercentage < 30) {
          // Passer le build en privé (public → privé = supprimer sur le serveur)
          if (this.currentBuild && this.currentBuild.id === targetId) {
            this.currentBuild.visibility = 'private'
          }

          // Mettre à jour le build correspondant dans la liste sauvegardée
          const savedBuilds = this.getSavedBuilds()
          const existingIndex = savedBuilds.findIndex(b => b.id === targetId)
          if (existingIndex >= 0) {
            savedBuilds[existingIndex] = {
              ...savedBuilds[existingIndex],
              visibility: 'private',
            }
            const toStore = savedBuilds.map(b => serializeBuild(b))
            localStorage.setItem('lelanation_builds', JSON.stringify(toStore))
          }

          try {
            await fetch(apiUrl(`/api/builds/${encodeURIComponent(targetId)}`), {
              method: 'DELETE',
            })
          } catch {
            // Ignore errors
          }
        }
      }
    },

    getSavedBuilds(): Build[] {
      try {
        const stored = localStorage.getItem('lelanation_builds')
        if (!stored) return []
        const parsed = JSON.parse(stored) as unknown[]
        return parsed.map(b => (isStoredBuild(b) ? hydrateBuild(b) : (b as Build)))
      } catch {
        return []
      }
    },

    loadBuild(buildId: string): boolean {
      try {
        const savedBuilds = this.getSavedBuilds()
        const build = savedBuilds.find(b => b.id === buildId)
        if (build) {
          // Normaliser les champs sous-builds pour les anciens builds
          this.currentBuild = {
            ...build,
            subBuilds: build.subBuilds ?? [],
            descriptionMode: build.descriptionMode ?? 'single',
          }
          this.displayedVariant = 'main'
          this.pendingChampionChange = null
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

    async deleteBuild(buildId: string): Promise<boolean> {
      try {
        const savedBuilds = this.getSavedBuilds()
        const filtered = savedBuilds.filter(b => b.id !== buildId)
        const toStore = filtered.map(b => serializeBuild(b))
        localStorage.setItem('lelanation_builds', JSON.stringify(toStore))
        this.savedBuildsVersion++

        // If current build is deleted, clear it
        if (this.currentBuild?.id === buildId) {
          this.currentBuild = null
        }

        // Try to delete from server (don't fail if it doesn't exist on server)
        try {
          const response = await fetch(apiUrl(`/api/builds/${encodeURIComponent(buildId)}`), {
            method: 'DELETE',
          })

          if (!response.ok && response.status !== 404) {
            // Only log error if it's not a 404 (build might not exist on server)
            // eslint-disable-next-line no-console
            console.warn(`[BuildStore] Failed to delete build on server: ${response.status}`)
          }
        } catch (apiError) {
          // Don't fail the deletion if API call fails (build might not exist on server)
          // eslint-disable-next-line no-console
          console.warn('[BuildStore] Failed to delete build on server:', apiError)
        }

        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to delete build'
        this.status = 'error'
        return false
      }
    },

    /**
     * Vérifie si un build existe sur le serveur et le resauvegarde si nécessaire.
     * Les builds privés ne sont jamais synchronisés (ils restent locaux / partagés via code uniquement).
     */
    async syncBuildToServer(build: Build): Promise<boolean> {
      if (!build || !build.id) return false
      if (build.visibility === 'private') return true // Pas de sync pour les privés

      try {
        // Vérifier si le build existe sur le serveur
        const checkResponse = await fetch(apiUrl(`/api/builds/${encodeURIComponent(build.id)}`))

        // Si le build n'existe pas (404), retenter de le sauvegarder
        if (checkResponse.status === 404) {
          // eslint-disable-next-line no-console
          console.log(`[BuildStore] Build ${build.id} not found on server, attempting to save...`)

          try {
            const saveResponse = await fetch(apiUrl('/api/builds'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(serializeBuild(build)),
            })

            if (saveResponse.ok) {
              // eslint-disable-next-line no-console
              console.log(`[BuildStore] Build ${build.id} successfully synced to server`)
              return true
            } else {
              // eslint-disable-next-line no-console
              console.warn(
                `[BuildStore] Failed to sync build ${build.id} to server: ${saveResponse.status}`
              )
              return false
            }
          } catch (saveError) {
            // eslint-disable-next-line no-console
            console.warn(`[BuildStore] Failed to sync build ${build.id} to server:`, saveError)
            return false
          }
        } else if (checkResponse.ok) {
          // Build existe déjà sur le serveur
          return true
        } else {
          // Autre erreur (500, etc.)
          // eslint-disable-next-line no-console
          console.warn(
            `[BuildStore] Error checking build ${build.id} on server: ${checkResponse.status}`
          )
          return false
        }
      } catch (error) {
        // Erreur réseau ou autre
        // eslint-disable-next-line no-console
        console.warn(`[BuildStore] Error syncing build ${build.id} to server:`, error)
        return false
      }
    },

    /**
     * Synchronise tous les builds locaux avec le serveur
     * Vérifie chaque build et resauvegarde ceux qui n'existent pas sur le serveur
     */
    async syncAllBuildsToServer(): Promise<void> {
      const savedBuilds = this.getSavedBuilds()

      // Synchroniser tous les builds en parallèle (mais avec un délai pour éviter de surcharger)
      for (const build of savedBuilds) {
        if (build && build.id) {
          await this.syncBuildToServer(build)
          // Petit délai entre chaque sync pour éviter de surcharger le serveur
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    },
  },
})
