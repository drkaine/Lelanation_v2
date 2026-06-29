import { defineStore } from 'pinia'
import type {
  Build,
  SubBuild,
  type KaynForm,
  Champion,
  Item,
  RuneSelection,
  ShardSelection,
  SummonerSpell,
  SkillOrder,
  CalculatedStats,
  Role,
  PatchStaleInfo,
  StoredBuild,
} from '@lelanation/shared-types'
import { isStarterItem } from '@lelanation/builds-ui'
import { getFallbackGameVersion } from '~/config/version'
import { apiUrl } from '~/utils/apiUrl'
import { serializeBuild, hydrateBuild, isStoredBuild } from '~/utils/buildSerialize'
import {
  applyPatchStaleToBuild,
  extractPatchStaleMap,
  mergePatchStaleIntoBuilds,
} from '~/utils/mergePatchStale'
import { useVersionStore } from '~/stores/VersionStore'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useVoteStore } from '~/stores/VoteStore'
import { shouldAutoPrivatizeFromCommunityVotes } from '~/utils/communityVoteVisibility'
import {
  passiveRankForChampionLevel,
  clampChampionLevel,
  baseHpAtLevel,
  championWithStatsForBuild,
  maxChampionLevelForRoles,
  resolveChampionStatsForBuild,
  toTheorycraftBuildStats,
} from '~/utils/theorycraftStats'
import {
  clampDisabledIndicesToActiveLimit,
  isWithinActiveItemLimit,
  remapDisabledItemIndices,
  resolveBuildItemsWithCatalog,
  selectTheorycraftItemsForStats,
} from '~/utils/theorycraftItems'
import {
  applyJungleSmiteToSummonerSpells,
  atlasUpgradeMissing,
  findSmiteSpell,
  isSmiteSpell,
  lookupCatalogItem,
  normalizeBuildItemsAfterChange,
  stripSmiteFromSummonerSpells,
} from '~/utils/buildItemRules'
import { useItemsStore } from '~/stores/ItemsStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import {
  applyTheorycraftItemModifiers,
  remapTheorycraftItemStacksByIndex,
} from '~/utils/theorycraftItemModifiers'
import {
  applyTheorycraftRuneModifiers,
  resolveTheorycraftAdaptiveForBuild,
} from '~/utils/theorycraftRuneModifiers'
import type { TheorycraftRuneModifierLine } from '~/utils/theorycraftRuneModifiers'
import type { TheorycraftItemModifierLine } from '~/utils/theorycraftItemModifiers'
import { computeTheorycraftItemProcLines } from '~/utils/theorycraftItemProcs'
import type { TheorycraftItemProcLine } from '~/utils/theorycraftItemProcs'
import { applyTheorycraftItemPassives } from '~/utils/theorycraftItemPassives'
import type { TheorycraftItemPassiveLine } from '~/utils/theorycraftItemPassives'
import {
  applyTheorycraftSpellBuffs,
  type TheorycraftSpellBuffLine,
  type TheorycraftSpellRuntime,
} from '~/utils/theorycraftSpellBuffs'
import type { TheorycraftStackDefinition } from '~/types/theorycraft'
import type { TheorycraftSpellCalculation } from '~/composables/useTheorycraftTooltip'

const CURRENT_BUILD_STORAGE_KEY = 'lelanation_current_build'
const EDIT_BUILD_STORAGE_KEY = 'lelanation_current_build_edit'
const THEORYCRAFT_BUILD_STORAGE_KEY = 'lelanation_theorycraft_draft'
const THEORYCRAFT_STACKS_STORAGE_KEY = 'lelanation_theorycraft_stacks'
const THEORYCRAFT_DISABLED_ITEMS_STORAGE_KEY = 'lelanation_theorycraft_disabled_items'
const THEORYCRAFT_ITEM_STACKS_STORAGE_KEY = 'lelanation_theorycraft_item_stacks'
const THEORYCRAFT_ITEM_TRANSFORMED_STORAGE_KEY = 'lelanation_theorycraft_item_transformed'
const THEORYCRAFT_RUNE_STACKS_STORAGE_KEY = 'lelanation_theorycraft_rune_stacks'
const THEORYCRAFT_GAME_DURATION_STORAGE_KEY = 'lelanation_theorycraft_game_duration'
const THEORYCRAFT_ACTIVE_ITEM_PASSIVES_STORAGE_KEY = 'lelanation_theorycraft_active_item_passives'
const BUILDER_STEP_STORAGE_KEY = 'lelanation_builder_step'

export type BuildStoreSession = 'create' | 'theorycraft' | 'edit'

interface BuildState {
  currentBuild: Build | null
  status: 'idle' | 'loading' | 'success' | 'error'
  error: string | null
  calculatedStats: CalculatedStats | null
  /** Niveau champion utilisé pour recalculateStats (1–18). */
  statsLevel: number
  /** Session builder active (draft localStorage isolé pour theorycraft). */
  builderSession: BuildStoreSession
  /** Stacks passif/sort pour theorycraft (id définition → nombre). */
  theorycraftStackCounts: Record<string, number>
  /** Définitions de stacks exportées pour le champion theorycraft courant. */
  theorycraftStackDefinitions: TheorycraftStackDefinition[]
  /** Calculs par source (passive, spell id/slot) pour résoudre les bonus de stacks. */
  theorycraftStackCalculationsBySource: Record<string, TheorycraftSpellCalculation[]>
  /** Champion id associé au contexte stacks theorycraft. */
  theorycraftStackChampionId: string | null
  /** Indices d'items exclus du calcul de stats en theorycraft. */
  theorycraftDisabledItemIndices: number[]
  /** Stacks par index d'item (Mejai, Cœuracier, Larme…). */
  theorycraftItemStacks: Record<number, number>
  /** Objet transformé (Séraphin, Muramana…) par index. */
  theorycraftItemTransformed: Record<number, boolean>
  /** Détail des bonus % / stacks appliqués au dernier calcul. */
  theorycraftItemModifierLines: TheorycraftItemModifierLine[]
  /** Sorts du champion export theorycraft (pour buffs actifs). */
  theorycraftChampionSpells: TheorycraftSpellRuntime[]
  /** Sort actif (buff temporaire) par id de sort. */
  theorycraftActiveSpells: Record<string, boolean>
  /** Rang sélectionné par sort (panneau theorycraft). */
  theorycraftSpellRanks: Record<string, number>
  /** Lignes de buffs de sorts actifs appliqués aux stats. */
  theorycraftSpellBuffLines: TheorycraftSpellBuffLine[]
  /** Dégâts on-hit / proc des objets équipés. */
  theorycraftItemProcLines: TheorycraftItemProcLine[]
  /** Passif d'objet activé manuellement (Jak'Sho, Brillance…) par index. */
  theorycraftActiveItemPassives: Record<number, boolean>
  /** Bonus passifs d'objets actifs appliqués aux stats. */
  theorycraftItemPassiveLines: TheorycraftItemPassiveLine[]
  /** Stacks de runes (Ruban de mana, Légende, Moisson noire…). */
  theorycraftRuneStacks: Record<number, number>
  /** Durée de partie en minutes (Tempête menaçante). */
  theorycraftGameDurationMinutes: number
  /** Lignes de bonus runes / shards appliqués au dernier calcul. */
  theorycraftRuneModifierLines: TheorycraftRuneModifierLine[]
  /** Incrémenté à chaque modification de la liste sauvegardée (save/delete/copy) pour forcer le refresh des vues. */
  savedBuildsVersion: number
  /** Variante actuellement affichée dans le builder : 'main' = build principal, number = index dans subBuilds. */
  displayedVariant: 'main' | number
  /** Champion en attente de changement (si des variantes existent — confirmation requise). */
  pendingChampionChange: Champion | null
  /** Build en cours d’édition (même id que `currentBuild` ; sert aux URLs `?editId=` et au brouillon dédié). */
  editSourceBuildId: string | null
}

type BuildLikeForValidation = Pick<
  Build,
  'champion' | 'roles' | 'items' | 'runes' | 'summonerSpells' | 'skillOrder'
>
type BuildTag = NonNullable<Build['tags']>[number]

function isBuildPayloadValid(build: BuildLikeForValidation | null | undefined): boolean {
  if (!build) return false

  if (!build.champion) return false
  if (!build.roles || build.roles.length === 0) return false

  if (!build.items || build.items.length === 0 || build.items.length > 10) {
    return false
  }
  if (!build.items.some((it: Item) => isStarterItem(it))) return false
  if (atlasUpgradeMissing(build.items, build.roles)) return false

  if (!build.runes) return false
  if (!build.runes.primary.pathId || !build.runes.primary.keystone) return false
  if (!build.runes.secondary.pathId) return false

  if (
    !build.summonerSpells ||
    build.summonerSpells.length !== 2 ||
    !build.summonerSpells[0] ||
    !build.summonerSpells[1]
  ) {
    return false
  }

  if (!build.skillOrder) return false
  if (!build.skillOrder.firstThreeUps || build.skillOrder.firstThreeUps.length !== 3) return false
  if (build.skillOrder.firstThreeUps.some(up => !up)) return false
  if (!build.skillOrder.skillUpOrder || build.skillOrder.skillUpOrder.length !== 3) return false
  if (build.skillOrder.skillUpOrder.some(up => !up)) return false

  return true
}

export const useBuildStore = defineStore('build', {
  state: (): BuildState => ({
    currentBuild: null,
    status: 'idle',
    error: null,
    calculatedStats: null,
    statsLevel: 18,
    builderSession: 'create' as BuildStoreSession,
    theorycraftStackCounts: {},
    theorycraftStackDefinitions: [],
    theorycraftStackCalculationsBySource: {},
    theorycraftStackChampionId: null,
    theorycraftDisabledItemIndices: [],
    theorycraftItemStacks: {},
    theorycraftItemTransformed: {},
    theorycraftItemModifierLines: [],
    theorycraftChampionSpells: [],
    theorycraftActiveSpells: {},
    theorycraftSpellRanks: {},
    theorycraftSpellBuffLines: [],
    theorycraftItemProcLines: [],
    theorycraftActiveItemPassives: {},
    theorycraftItemPassiveLines: [],
    theorycraftRuneStacks: {},
    theorycraftGameDurationMinutes: 30,
    theorycraftRuneModifierLines: [],
    savedBuildsVersion: 0,
    displayedVariant: 'main',
    pendingChampionChange: null,
    editSourceBuildId: null,
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
        tags: sub.tags !== undefined ? sub.tags : (this.currentBuild.tags ?? []),
        description: sub.description ?? this.currentBuild.description,
        gameVersion: sub.gameVersion || this.currentBuild.gameVersion,
        kaynForm: sub.kaynForm ?? 0,
      } as Build
    },

    maxStatsLevel(): number {
      const build = this.displayedBuild ?? this.currentBuild
      return maxChampionLevelForRoles(build?.roles)
    },

    isBuildValid(): boolean {
      if (!this.currentBuild) return false
      if (!isBuildPayloadValid(this.currentBuild)) return false

      const subs = (this.currentBuild.subBuilds as SubBuild[] | undefined) ?? []
      for (const sub of subs) {
        const variantAsBuild = {
          champion: this.currentBuild.champion,
          roles: this.currentBuild.roles,
          items: sub.items ?? [],
          runes: sub.runes ?? null,
          summonerSpells: sub.summonerSpells ?? [null, null],
          skillOrder: sub.skillOrder ?? null,
        } as BuildLikeForValidation
        if (!isBuildPayloadValid(variantAsBuild)) return false
      }
      return true
    },

    isMainBuildValid(): boolean {
      return isBuildPayloadValid(this.currentBuild)
    },

    firstIncompleteSubBuildIndex(): number | null {
      if (!this.currentBuild) return null
      const subs = (this.currentBuild.subBuilds as SubBuild[] | undefined) ?? []
      for (let i = 0; i < subs.length; i += 1) {
        const sub = subs[i]
        if (!sub) continue
        const variantAsBuild = {
          champion: this.currentBuild.champion,
          roles: this.currentBuild.roles,
          items: sub.items ?? [],
          runes: sub.runes ?? null,
          summonerSpells: sub.summonerSpells ?? [null, null],
          skillOrder: sub.skillOrder ?? null,
        } as BuildLikeForValidation
        if (!isBuildPayloadValid(variantAsBuild)) return i
      }
      return null
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

      if (!build.roles || build.roles.length === 0) {
        errors.push('At least one role must be selected')
      }

      if (!build.items || build.items.length === 0) {
        errors.push('At least one item must be selected')
      } else if (build.items.length > 10) {
        errors.push('Maximum 10 items allowed')
      } else if (!build.items.some((it: Item) => isStarterItem(it))) {
        errors.push('At least one starter item must be selected')
      } else if (atlasUpgradeMissing(build.items, build.roles)) {
        errors.push('An Atlas upgrade must be selected for this support build')
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
      this.editSourceBuildId = null
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

    /**
     * Upsert a shared/imported build in localStorage without changing its ID or name.
     * Used for cross-browser linking so public builds keep ownership/editability.
     */
    upsertImportedBuild(build: Build): string | null {
      try {
        if (!build?.id) return null
        const savedBuilds = this.getSavedBuilds()
        const index = savedBuilds.findIndex(b => b.id === build.id)
        if (index >= 0) {
          const existing = savedBuilds[index]
          if (!existing) return null
          savedBuilds[index] = {
            ...existing,
            ...build,
            id: build.id,
          }
        } else {
          savedBuilds.push(build)
        }
        const toStore = savedBuilds.map(b => serializeBuild(b))
        localStorage.setItem('lelanation_builds', JSON.stringify(toStore))
        this.savedBuildsVersion++
        return build.id
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
          slot3: 5011,
        },
        summonerSpells: [null, null],
        skillOrder: {
          firstThreeUps: [null as any, null as any, null as any],
          skillUpOrder: [null as any, null as any, null as any],
        },
        roles: [],
        tags: [],
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
      this.editSourceBuildId = null
      this.status = 'idle'
      this.error = null
      this.setLastBuilderStep('champion')
    },

    loadCurrentBuildDraft(): boolean {
      if (import.meta.server) return false
      try {
        const saved = localStorage.getItem(this.getCurrentDraftStorageKey())
        if (!saved) return false
        const parsed = JSON.parse(saved) as Build | ReturnType<typeof serializeBuild>
        const build = isStoredBuild(parsed) ? hydrateBuild(parsed) : (parsed as Build)
        this.setCurrentBuild(build)
        this.setRoles(this.currentBuild?.roles ?? [])
        this.ensureBuildChampionStats().catch(() => undefined)
        return true
      } catch {
        return false
      }
    },

    async ensureBuildChampionStats() {
      if (import.meta.server || !this.currentBuild?.champion) return

      const rehydrateFromDraft = (): boolean => {
        try {
          const saved = localStorage.getItem(this.getCurrentDraftStorageKey())
          if (!saved) return false
          const parsed = JSON.parse(saved) as Build | StoredBuild
          if (!isStoredBuild(parsed)) return false
          const build = hydrateBuild(parsed)
          this.currentBuild = {
            ...build,
            subBuilds: build.subBuilds ?? [],
            descriptionMode: build.descriptionMode ?? 'single',
          }
          this.displayedVariant = 'main'
          return resolveChampionStatsForBuild(this.currentBuild.champion) != null
        } catch {
          return false
        }
      }

      if (resolveChampionStatsForBuild(this.currentBuild.champion)) {
        this.recalculateStats()
        return
      }

      const championsStore = useChampionsStore()
      if (championsStore.champions.length === 0) {
        await championsStore.loadChampions()
      }

      if (rehydrateFromDraft()) {
        this.recalculateStats()
        return
      }

      const championId = this.currentBuild.champion.id
      let enriched = championsStore.champions.find(champion => champion.id === championId) ?? null
      if (!resolveChampionStatsForBuild(enriched)) {
        enriched = (await championsStore.loadChampionDetails(championId)) ?? enriched
      }

      if (enriched) {
        this.currentBuild.champion = championWithStatsForBuild({
          ...this.currentBuild.champion,
          ...enriched,
        })
        this.persistCurrentBuildDraft()
      }

      this.recalculateStats()
    },

    persistCurrentBuildDraft() {
      if (import.meta.server || !this.currentBuild) return
      try {
        localStorage.setItem(
          this.getCurrentDraftStorageKey(),
          JSON.stringify(serializeBuild(this.currentBuild))
        )
      } catch {
        // ignore persistence errors
      }
    },

    enterTheorycraftSession() {
      const keepInMemory = this.builderSession === 'theorycraft' && this.currentBuild !== null

      this.builderSession = 'theorycraft'
      this.displayedVariant = 'main'
      this.pendingChampionChange = null
      this.editSourceBuildId = null
      this.status = 'idle'
      this.error = null
      this.loadTheorycraftDisabledItems()
      this.loadTheorycraftItemStacks()
      this.loadTheorycraftActiveItemPassives()
      this.loadTheorycraftRuneStacks()

      if (keepInMemory) {
        this.recalculateStats()
        return
      }

      this.clearTheorycraftStackContext()
      this.currentBuild = null
      if (!this.loadCurrentBuildDraft()) {
        this.statsLevel = 18
        this.createNewBuild()
      } else {
        this.clampTheorycraftActiveItemsForRole()
        this.clampStatsLevelForRole()
        this.recalculateStats()
      }
    },

    leaveTheorycraftSession() {
      if (this.builderSession !== 'theorycraft') return
      if (this.currentBuild) {
        try {
          localStorage.setItem(
            THEORYCRAFT_BUILD_STORAGE_KEY,
            JSON.stringify(serializeBuild(this.currentBuild))
          )
        } catch {
          // ignore persistence errors
        }
      }
      this.builderSession = 'create'
      this.currentBuild = null
      this.calculatedStats = null
      this.displayedVariant = 'main'
      this.pendingChampionChange = null
      this.editSourceBuildId = null
      this.clearTheorycraftStackContext()
      this.theorycraftDisabledItemIndices = []
      this.theorycraftItemStacks = {}
      this.theorycraftItemTransformed = {}
      this.theorycraftItemModifierLines = []
      this.theorycraftChampionSpells = []
      this.theorycraftActiveSpells = {}
      this.theorycraftSpellRanks = {}
      this.theorycraftSpellBuffLines = []
      this.theorycraftItemProcLines = []
      this.theorycraftActiveItemPassives = {}
      this.theorycraftItemPassiveLines = []
      this.theorycraftRuneStacks = {}
      this.theorycraftGameDurationMinutes = 30
      this.theorycraftRuneModifierLines = []
    },

    loadTheorycraftActiveItemPassives() {
      if (import.meta.server) return
      try {
        const raw = localStorage.getItem(THEORYCRAFT_ACTIVE_ITEM_PASSIVES_STORAGE_KEY)
        this.theorycraftActiveItemPassives = raw ? (JSON.parse(raw) as Record<number, boolean>) : {}
      } catch {
        this.theorycraftActiveItemPassives = {}
      }
    },

    persistTheorycraftActiveItemPassives() {
      if (import.meta.server || this.builderSession !== 'theorycraft') return
      try {
        localStorage.setItem(
          THEORYCRAFT_ACTIVE_ITEM_PASSIVES_STORAGE_KEY,
          JSON.stringify(this.theorycraftActiveItemPassives)
        )
      } catch {
        // ignore
      }
    },

    toggleTheorycraftActiveItemPassive(index: number) {
      if (this.builderSession !== 'theorycraft') return
      const next = { ...this.theorycraftActiveItemPassives }
      next[index] = !next[index]
      if (!next[index]) delete next[index]
      this.theorycraftActiveItemPassives = next
      this.persistTheorycraftActiveItemPassives()
      this.recalculateStats()
    },

    loadTheorycraftRuneStacks() {
      if (import.meta.server) return
      try {
        const rawStacks = localStorage.getItem(THEORYCRAFT_RUNE_STACKS_STORAGE_KEY)
        const rawDuration = localStorage.getItem(THEORYCRAFT_GAME_DURATION_STORAGE_KEY)
        this.theorycraftRuneStacks = rawStacks
          ? (JSON.parse(rawStacks) as Record<number, number>)
          : {}
        const duration = rawDuration ? Number(JSON.parse(rawDuration)) : 30
        this.theorycraftGameDurationMinutes = Number.isFinite(duration)
          ? Math.max(0, Math.min(90, Math.trunc(duration)))
          : 30
      } catch {
        this.theorycraftRuneStacks = {}
        this.theorycraftGameDurationMinutes = 30
      }
    },

    persistTheorycraftRuneStacks() {
      if (import.meta.server || this.builderSession !== 'theorycraft') return
      try {
        localStorage.setItem(
          THEORYCRAFT_RUNE_STACKS_STORAGE_KEY,
          JSON.stringify(this.theorycraftRuneStacks)
        )
        localStorage.setItem(
          THEORYCRAFT_GAME_DURATION_STORAGE_KEY,
          JSON.stringify(this.theorycraftGameDurationMinutes)
        )
      } catch {
        // ignore
      }
    },

    setTheorycraftRuneStacks(runeId: number, stacks: number) {
      if (this.builderSession !== 'theorycraft') return
      const next = { ...this.theorycraftRuneStacks }
      if (!Number.isFinite(stacks) || stacks <= 0) delete next[runeId]
      else next[runeId] = Math.max(0, Math.trunc(stacks))
      this.theorycraftRuneStacks = next
      this.persistTheorycraftRuneStacks()
      this.recalculateStats()
    },

    setTheorycraftGameDurationMinutes(minutes: number) {
      if (this.builderSession !== 'theorycraft') return
      const value = Number.isFinite(minutes) ? Math.max(0, Math.min(90, Math.trunc(minutes))) : 0
      this.theorycraftGameDurationMinutes = value
      this.persistTheorycraftRuneStacks()
      this.recalculateStats()
    },

    loadTheorycraftItemStacks() {
      if (import.meta.server) return
      try {
        const rawStacks = localStorage.getItem(THEORYCRAFT_ITEM_STACKS_STORAGE_KEY)
        const rawTransformed = localStorage.getItem(THEORYCRAFT_ITEM_TRANSFORMED_STORAGE_KEY)
        this.theorycraftItemStacks = rawStacks
          ? (JSON.parse(rawStacks) as Record<number, number>)
          : {}
        this.theorycraftItemTransformed = rawTransformed
          ? (JSON.parse(rawTransformed) as Record<number, boolean>)
          : {}
      } catch {
        this.theorycraftItemStacks = {}
        this.theorycraftItemTransformed = {}
      }
    },

    persistTheorycraftItemStacks() {
      if (import.meta.server || this.builderSession !== 'theorycraft') return
      try {
        localStorage.setItem(
          THEORYCRAFT_ITEM_STACKS_STORAGE_KEY,
          JSON.stringify(this.theorycraftItemStacks)
        )
        localStorage.setItem(
          THEORYCRAFT_ITEM_TRANSFORMED_STORAGE_KEY,
          JSON.stringify(this.theorycraftItemTransformed)
        )
      } catch {
        // ignore persistence errors
      }
    },

    setTheorycraftItemStacks(index: number, stacks: number) {
      if (this.builderSession !== 'theorycraft') return
      const next = { ...this.theorycraftItemStacks }
      if (!Number.isFinite(stacks) || stacks <= 0) delete next[index]
      else next[index] = Math.max(0, Math.trunc(stacks))
      this.theorycraftItemStacks = next
      this.persistTheorycraftItemStacks()
      this.recalculateStats()
    },

    setTheorycraftItemTransformed(index: number, transformed: boolean) {
      if (this.builderSession !== 'theorycraft') return
      const next = { ...this.theorycraftItemTransformed }
      if (transformed) next[index] = true
      else delete next[index]
      this.theorycraftItemTransformed = next
      this.persistTheorycraftItemStacks()
      this.recalculateStats()
    },

    loadTheorycraftDisabledItems() {
      if (import.meta.server) return
      try {
        const raw = localStorage.getItem(THEORYCRAFT_DISABLED_ITEMS_STORAGE_KEY)
        if (!raw) {
          this.theorycraftDisabledItemIndices = []
          return
        }
        const parsed = JSON.parse(raw) as number[]
        this.theorycraftDisabledItemIndices = Array.isArray(parsed)
          ? parsed.filter(index => Number.isInteger(index) && index >= 0)
          : []
      } catch {
        this.theorycraftDisabledItemIndices = []
      }
    },

    persistTheorycraftDisabledItems() {
      if (import.meta.server || this.builderSession !== 'theorycraft') return
      try {
        localStorage.setItem(
          THEORYCRAFT_DISABLED_ITEMS_STORAGE_KEY,
          JSON.stringify(this.theorycraftDisabledItemIndices)
        )
      } catch {
        // ignore persistence errors
      }
    },

    remapTheorycraftDisabledItems(previousItems: Item[], nextItems: Item[]) {
      if (this.builderSession !== 'theorycraft') return
      this.theorycraftDisabledItemIndices = remapDisabledItemIndices(
        previousItems,
        nextItems,
        this.theorycraftDisabledItemIndices
      )
      this.theorycraftItemStacks = remapTheorycraftItemStacksByIndex(
        previousItems,
        nextItems,
        this.theorycraftItemStacks
      )
      this.theorycraftItemTransformed = remapTheorycraftItemStacksByIndex(
        previousItems,
        nextItems,
        this.theorycraftItemTransformed
      )
      this.theorycraftActiveItemPassives = remapTheorycraftItemStacksByIndex(
        previousItems,
        nextItems,
        this.theorycraftActiveItemPassives
      )
      this.persistTheorycraftDisabledItems()
      this.persistTheorycraftItemStacks()
      this.persistTheorycraftActiveItemPassives()
    },

    clampTheorycraftActiveItemsForRole() {
      if (this.builderSession !== 'theorycraft') return
      const build = this.displayedBuild ?? this.currentBuild
      if (!build) return
      const next = clampDisabledIndicesToActiveLimit(
        build.items,
        new Set(this.theorycraftDisabledItemIndices),
        build.roles
      )
      if (
        next.length === this.theorycraftDisabledItemIndices.length &&
        next.every((value, index) => value === this.theorycraftDisabledItemIndices[index])
      ) {
        return
      }
      this.theorycraftDisabledItemIndices = next
      this.persistTheorycraftDisabledItems()
      this.recalculateStats()
    },

    toggleTheorycraftItemForStats(index: number): 'enabled' | 'disabled' | 'limit_reached' {
      if (this.builderSession !== 'theorycraft') return 'limit_reached'
      const build = this.displayedBuild ?? this.currentBuild
      if (!build || index < 0 || index >= build.items.length) return 'limit_reached'

      const disabled = new Set(this.theorycraftDisabledItemIndices)
      if (disabled.has(index)) {
        disabled.delete(index)
        if (!isWithinActiveItemLimit(build.items, disabled, build.roles)) {
          return 'limit_reached'
        }
        this.theorycraftDisabledItemIndices = Array.from(disabled)
        this.persistTheorycraftDisabledItems()
        this.recalculateStats()
        return 'enabled'
      }

      disabled.add(index)
      this.theorycraftDisabledItemIndices = Array.from(disabled)
      this.persistTheorycraftDisabledItems()
      this.recalculateStats()
      return 'disabled'
    },

    isTheorycraftItemDisabled(index: number): boolean {
      return this.theorycraftDisabledItemIndices.includes(index)
    },

    getTheorycraftItemsForStats(): Item[] {
      const build = this.displayedBuild ?? this.currentBuild
      if (!build) return []
      if (this.builderSession !== 'theorycraft') return build.items

      const active = selectTheorycraftItemsForStats(
        build.items,
        new Set(this.theorycraftDisabledItemIndices),
        build.roles
      )
      const itemsStore = useItemsStore()
      if (itemsStore.items.length === 0) return active

      return resolveBuildItemsWithCatalog(active, id => lookupCatalogItem(itemsStore.items, id))
    },

    getTheorycraftActiveItemsWithIndex(): { index: number; item: Item }[] {
      const build = this.displayedBuild ?? this.currentBuild
      if (!build || this.builderSession !== 'theorycraft') return []

      const disabled = new Set(this.theorycraftDisabledItemIndices)
      const itemsStore = useItemsStore()
      const lookup = (id: string) => lookupCatalogItem(itemsStore.items, id)

      const entries: { index: number; item: Item }[] = []
      for (let index = 0; index < build.items.length; index++) {
        if (disabled.has(index)) continue
        const raw = build.items[index]
        if (!raw?.id) continue
        const [item] = resolveBuildItemsWithCatalog([raw], lookup)
        if (item) entries.push({ index, item })
      }
      return entries
    },

    clearTheorycraftStackContext() {
      this.theorycraftStackCounts = {}
      this.theorycraftStackDefinitions = []
      this.theorycraftStackCalculationsBySource = {}
      this.theorycraftStackChampionId = null
      this.theorycraftChampionSpells = []
      this.theorycraftActiveSpells = {}
      this.theorycraftSpellRanks = {}
      this.theorycraftSpellBuffLines = []
      this.theorycraftItemProcLines = []
      this.theorycraftActiveItemPassives = {}
      this.theorycraftItemPassiveLines = []
    },

    loadTheorycraftStacksForChampion(championId: string) {
      try {
        const raw = localStorage.getItem(THEORYCRAFT_STACKS_STORAGE_KEY)
        if (!raw) {
          this.theorycraftStackCounts = {}
          return
        }
        const parsed = JSON.parse(raw) as Record<string, Record<string, number>>
        this.theorycraftStackCounts = parsed[championId] ?? {}
      } catch {
        this.theorycraftStackCounts = {}
      }
    },

    persistTheorycraftStacks() {
      if (this.builderSession !== 'theorycraft' || !this.theorycraftStackChampionId) return
      try {
        const raw = localStorage.getItem(THEORYCRAFT_STACKS_STORAGE_KEY)
        const parsed = raw ? (JSON.parse(raw) as Record<string, Record<string, number>>) : {}
        parsed[this.theorycraftStackChampionId] = { ...this.theorycraftStackCounts }
        localStorage.setItem(THEORYCRAFT_STACKS_STORAGE_KEY, JSON.stringify(parsed))
      } catch {
        // ignore persistence errors
      }
    },

    setTheorycraftStackContext(args: {
      championId: string
      definitions: TheorycraftStackDefinition[]
      calculationsBySource: Record<string, TheorycraftSpellCalculation[]>
      spells?: TheorycraftSpellRuntime[]
    }) {
      const championChanged = this.theorycraftStackChampionId !== args.championId
      this.theorycraftStackChampionId = args.championId
      this.theorycraftStackDefinitions = args.definitions
      this.theorycraftStackCalculationsBySource = args.calculationsBySource
      this.theorycraftChampionSpells = args.spells ?? []
      if (championChanged) {
        this.loadTheorycraftStacksForChampion(args.championId)
        this.theorycraftActiveSpells = {}
        this.theorycraftSpellRanks = {}
      }
      this.recalculateStats()
    },

    setTheorycraftSpellRank(spellId: string, rank: number) {
      if (this.builderSession !== 'theorycraft') return
      const safe = Math.max(1, Math.trunc(Number.isFinite(rank) ? rank : 1))
      this.theorycraftSpellRanks = { ...this.theorycraftSpellRanks, [spellId]: safe }
      this.recalculateStats()
    },

    toggleTheorycraftActiveSpell(spellId: string) {
      if (this.builderSession !== 'theorycraft') return
      const next = { ...this.theorycraftActiveSpells }
      next[spellId] = !next[spellId]
      this.theorycraftActiveSpells = next
      this.recalculateStats()
    },

    setTheorycraftStackCount(definitionId: string, count: number) {
      const safe = Math.max(0, Math.trunc(Number.isFinite(count) ? count : 0))
      this.theorycraftStackCounts = {
        ...this.theorycraftStackCounts,
        [definitionId]: safe,
      }
      this.persistTheorycraftStacks()
      this.recalculateStats()
    },

    setStatsLevel(level: number) {
      const build = this.displayedBuild ?? this.currentBuild
      const safe = clampChampionLevel(level, build?.roles)
      if (this.statsLevel === safe) return
      this.statsLevel = safe
      this.recalculateStats()
    },

    clampStatsLevelForRole() {
      const build = this.displayedBuild ?? this.currentBuild
      const safe = clampChampionLevel(this.statsLevel, build?.roles)
      if (this.statsLevel === safe) return
      this.statsLevel = safe
      this.recalculateStats()
    },

    /**
     * Charge un build existant dans le builder pour le modifier (même id).
     * La sauvegarde remplace l’entrée dans `lelanation_builds` au lieu d’en ajouter une nouvelle.
     */
    startEditingBuild(buildId: string): boolean {
      try {
        const savedBuilds = this.getSavedBuilds()
        const source = savedBuilds.find(b => b.id === buildId)
        if (!source) return false
        this.currentBuild = {
          ...source,
          subBuilds: Array.isArray(source.subBuilds) ? [...source.subBuilds] : [],
          descriptionMode: source.descriptionMode ?? 'single',
        }
        this.displayedVariant = 'main'
        this.pendingChampionChange = null
        this.editSourceBuildId = buildId
        this.status = 'idle'
        this.error = null
        this.recalculateStats()
        return true
      } catch {
        return false
      }
    },

    getCurrentDraftStorageKey(): string {
      if (this.builderSession === 'theorycraft') return THEORYCRAFT_BUILD_STORAGE_KEY
      return this.editSourceBuildId ? EDIT_BUILD_STORAGE_KEY : CURRENT_BUILD_STORAGE_KEY
    },

    leaveEditSessionAndRestoreCreateDraft() {
      this.editSourceBuildId = null
      this.currentBuild = null
      this.displayedVariant = 'main'
      this.pendingChampionChange = null
      this.status = 'idle'
      this.error = null
      this.recalculateStats()
      this.ensureCurrentBuild()
    },

    ensureCurrentBuild() {
      if (this.currentBuild) return
      if (!this.loadCurrentBuildDraft()) {
        this.createNewBuild()
      }
    },

    setLastBuilderStep(step: 'champion' | 'rune' | 'item' | 'info') {
      if (import.meta.server) return
      try {
        localStorage.setItem(BUILDER_STEP_STORAGE_KEY, step)
      } catch {
        // ignore
      }
    },

    getLastBuilderStep(): 'champion' | 'rune' | 'item' | 'info' {
      const build = this.currentBuild
      if (!build?.champion) return 'champion'
      if (
        !build.runes?.primary?.pathId ||
        !build.runes?.primary?.keystone ||
        !build.runes?.secondary?.pathId
      ) {
        return 'rune'
      }
      if (!build.items?.length) return 'item'
      if (
        !build.skillOrder?.firstThreeUps?.length ||
        build.skillOrder.firstThreeUps.some(up => !up) ||
        !build.skillOrder?.skillUpOrder?.length ||
        build.skillOrder.skillUpOrder.some(up => !up)
      ) {
        return 'item'
      }
      if (import.meta.client) {
        try {
          const saved = localStorage.getItem(BUILDER_STEP_STORAGE_KEY)
          if (saved === 'champion' || saved === 'rune' || saved === 'item' || saved === 'info') {
            return saved
          }
          if (saved === 'skill-order') {
            return 'item'
          }
        } catch {
          // ignore
        }
      }
      return 'info'
    },

    /** Crée une nouvelle variante (sous-build) en dupliquant le build principal. */
    /** Crée une nouvelle variante vide (items, runes, sorts, skill order vides). */
    createSubBuild(title?: string) {
      if (!this.currentBuild) return
      const b = this.currentBuild
      const newSub: SubBuild = {
        title: title ?? `Variante ${(b.subBuilds?.length ?? 0) + 2}`,
        description: '',
        champion: b.champion,
        items: [],
        runes: null,
        shards: null,
        summonerSpells: [null, null],
        skillOrder: null,
        roles: [...(b.roles ?? [])],
        tags: [...(b.tags ?? [])],
        gameVersion: b.gameVersion || '',
        kaynForm: 0,
      }
      if (!b.subBuilds) b.subBuilds = []
      b.subBuilds.push(newSub)
      this.displayedVariant = b.subBuilds.length - 1
      b.updatedAt = new Date().toISOString()
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
        this.currentBuild.champion = championWithStatsForBuild(champion)
        this.currentBuild.kaynForm = 0
        this.currentBuild.updatedAt = new Date().toISOString()
        if (this.builderSession === 'theorycraft') {
          this.clearTheorycraftStackContext()
        }
        this.recalculateStats()
      }
      return true
    },

    setActiveKaynForm(form: KaynForm) {
      if (!this.currentBuild) return
      const b = this.currentBuild
      if (this.displayedVariant === 'main') {
        b.kaynForm = form
      } else if (typeof this.displayedVariant === 'number') {
        const sub = b.subBuilds?.[this.displayedVariant]
        if (sub) sub.kaynForm = form
      }
      b.updatedAt = new Date().toISOString()
    },

    clearChampion() {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (this.currentBuild) {
        this.currentBuild.champion = null
        this.currentBuild.updatedAt = new Date().toISOString()
        this.pendingChampionChange = null
        this.currentBuild.kaynForm = 0
        if (this.builderSession === 'theorycraft') {
          this.clearTheorycraftStackContext()
        }
        this.recalculateStats()
      }
    },

    /** Confirme le changement de champion en attente : supprime les variantes et applique. */
    confirmChampionChange() {
      if (!this.pendingChampionChange || !this.currentBuild) return
      this.currentBuild.champion = this.pendingChampionChange
      this.currentBuild.kaynForm = 0
      this.currentBuild.subBuilds = []
      this.currentBuild.updatedAt = new Date().toISOString()
      this.displayedVariant = 'main'
      this.pendingChampionChange = null
      if (this.builderSession === 'theorycraft') {
        this.clearTheorycraftStackContext()
      }
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
      const previousItems =
        target.type === 'main' ? [...target.build.items] : [...(target.sub.items ?? [])]
      if (previousItems.length >= 10) return
      this.setItems([...previousItems, item])
      if (this.builderSession === 'theorycraft') {
        const build = this.displayedBuild ?? this.currentBuild
        const nextItems = target.type === 'main' ? target.build.items : (target.sub.items ?? [])
        const disabledSet = new Set(this.theorycraftDisabledItemIndices)
        const newIndex = nextItems.length - 1
        if (newIndex >= 0) {
          disabledSet.delete(newIndex)
          if (!isWithinActiveItemLimit(nextItems, disabledSet, build?.roles)) {
            disabledSet.add(newIndex)
          }
          this.theorycraftDisabledItemIndices = Array.from(disabledSet)
          this.persistTheorycraftDisabledItems()
        }
      }
    },

    removeItem(itemId: string) {
      const target = this.getEditableTarget()
      if (!target) return
      const previousItems =
        target.type === 'main' ? [...target.build.items] : [...(target.sub.items ?? [])]
      if (target.type === 'main') {
        target.build.items = target.build.items.filter(item => item.id !== itemId)
      } else {
        target.sub.items = (target.sub.items ?? []).filter(item => item.id !== itemId)
      }
      const nextItems = target.type === 'main' ? target.build.items : (target.sub.items ?? [])
      if (this.builderSession === 'theorycraft') {
        this.remapTheorycraftDisabledItems(previousItems, nextItems)
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
      const build = this.displayedBuild ?? this.currentBuild
      const itemsStore = useItemsStore()
      const normalized = normalizeBuildItemsAfterChange(items, build?.roles ?? [], id =>
        lookupCatalogItem(itemsStore.items, id)
      )
      const previousItems =
        target.type === 'main' ? [...target.build.items] : [...(target.sub.items ?? [])]
      if (target.type === 'main') {
        target.build.items = normalized
      } else {
        target.sub.items = normalized
      }
      if (this.builderSession === 'theorycraft') {
        this.remapTheorycraftDisabledItems(previousItems, normalized)
        this.clampTheorycraftActiveItemsForRole()
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
      if (spell && isSmiteSpell(spell) && !this.currentBuild!.roles?.includes('jungle')) {
        return
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

    /**
     * Données d'une source (build principal ou variante) pour la copie.
     * Utilisé par la modale "Copier depuis...".
     */
    getSourceBuildData(source: 'main' | number): {
      items: Item[]
      runes: RuneSelection | null
      shards: ShardSelection | null
      summonerSpells: [SummonerSpell | null, SummonerSpell | null]
      skillOrder: SkillOrder | null
      description: string
      tags: BuildTag[]
      kaynForm: KaynForm
    } | null {
      if (!this.currentBuild) return null
      const b = this.currentBuild
      if (source === 'main') {
        return {
          items: b.items ?? [],
          runes: b.runes ?? null,
          shards: b.shards ?? null,
          summonerSpells: b.summonerSpells ?? [null, null],
          skillOrder: b.skillOrder ?? null,
          description: b.description ?? '',
          tags: [...(b.tags ?? [])],
          kaynForm: b.kaynForm ?? 0,
        }
      }
      const subs = b.subBuilds as SubBuild[] | undefined
      const sub = subs?.[source]
      if (!sub) return null
      return {
        items: sub.items ?? [],
        runes: sub.runes ?? null,
        shards: sub.shards ?? null,
        summonerSpells: sub.summonerSpells ?? [null, null],
        skillOrder: sub.skillOrder ?? null,
        description: sub.description ?? '',
        tags: sub.tags !== undefined ? [...sub.tags] : [...(b.tags ?? [])],
        kaynForm: sub.kaynForm ?? 0,
      }
    },

    /**
     * Copie les champs sélectionnés depuis une source vers une destination.
     * firstThreeUps / skillUpOrder permettent de copier une partie du skillOrder.
     */
    copyVariantFieldsTo(
      source: 'main' | number,
      destination: 'main' | number,
      fields: {
        items?: boolean
        runes?: boolean
        shards?: boolean
        summonerSpells?: boolean
        skillOrder?: boolean
        firstThreeUps?: boolean
        skillUpOrder?: boolean
        description?: boolean
        tags?: boolean
        kaynForm?: boolean
      }
    ) {
      const data = this.getSourceBuildData(source)
      if (!data || !this.currentBuild) return
      const b = this.currentBuild
      const subs = (b.subBuilds as SubBuild[] | undefined) ?? []
      const destBuild = destination === 'main' ? b : subs[destination]
      if (!destBuild) return

      if (fields.items) destBuild.items = [...data.items]
      if (fields.runes && data.runes) destBuild.runes = data.runes
      if (fields.shards && data.shards) destBuild.shards = data.shards
      if (fields.summonerSpells)
        destBuild.summonerSpells = [data.summonerSpells[0], data.summonerSpells[1]]
      if (fields.description) destBuild.description = data.description
      if (fields.tags) destBuild.tags = [...data.tags]
      if (fields.kaynForm) {
        if (destination === 'main') {
          b.kaynForm = data.kaynForm
        } else {
          destBuild.kaynForm = data.kaynForm
        }
      }

      if (fields.skillOrder && data.skillOrder) {
        destBuild.skillOrder = data.skillOrder
      } else if (fields.firstThreeUps || fields.skillUpOrder) {
        const src = data.skillOrder
        const dest = destBuild.skillOrder
        const pad3 = <T>(arr: T[] | null | undefined): [T | null, T | null, T | null] =>
          arr && arr.length >= 3
            ? [arr[0] ?? null, arr[1] ?? null, arr[2] ?? null]
            : [null, null, null]
        const merged: SkillOrder = {
          firstThreeUps:
            fields.firstThreeUps && src?.firstThreeUps
              ? (src.firstThreeUps as SkillOrder['firstThreeUps'])
              : (pad3(dest?.firstThreeUps) as SkillOrder['firstThreeUps']),
          skillUpOrder:
            fields.skillUpOrder && src?.skillUpOrder
              ? (src.skillUpOrder as SkillOrder['skillUpOrder'])
              : (pad3(dest?.skillUpOrder) as SkillOrder['skillUpOrder']),
        }
        destBuild.skillOrder = merged
      }

      b.updatedAt = new Date().toISOString()
      this.recalculateStats()
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

      const itemsStore = useItemsStore()
      const itemLookup = (id: string) => lookupCatalogItem(itemsStore.items, id)
      const normalizeItemsForRole = (items: Item[]) =>
        normalizeBuildItemsAfterChange(items, roles, itemLookup)

      const spellsStore = useSummonerSpellsStore()
      const smite = findSmiteSpell(spellsStore.spells)
      const applySpellsForRole = (
        spells: [SummonerSpell | null, SummonerSpell | null] | null | undefined
      ) =>
        roles.includes('jungle')
          ? applyJungleSmiteToSummonerSpells(spells, smite)
          : stripSmiteFromSummonerSpells(spells)

      const build = this.currentBuild
      const previousMainItems = [...(build.items ?? [])]
      build.items = normalizeItemsForRole(previousMainItems)
      build.summonerSpells = applySpellsForRole(build.summonerSpells)

      const subs = (build.subBuilds as SubBuild[] | undefined) ?? []
      for (const sub of subs) {
        const previousSubItems = [...(sub.items ?? [])]
        sub.items = normalizeItemsForRole(previousSubItems)
        sub.summonerSpells = applySpellsForRole(sub.summonerSpells)
      }

      if (this.builderSession === 'theorycraft') {
        this.remapTheorycraftDisabledItems(previousMainItems, build.items)
      }

      this.currentBuild.updatedAt = new Date().toISOString()
      this.clampStatsLevelForRole()
      this.clampTheorycraftActiveItemsForRole()
      this.recalculateStats()
    },

    /** Tags du build principal ou de la variante actuellement affichée. */
    setTags(tags: BuildTag[]) {
      if (!this.currentBuild) {
        this.createNewBuild()
      }
      if (!this.currentBuild) return
      const b = this.currentBuild
      const next = [...tags]
      if (this.displayedVariant === 'main') {
        b.tags = next
      } else if (typeof this.displayedVariant === 'number') {
        const sub = b.subBuilds?.[this.displayedVariant]
        if (sub) {
          sub.tags = next
        }
      }
      b.updatedAt = new Date().toISOString()
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

    mergeTheorycraftChampionDetail(detail: Record<string, unknown>) {
      if (this.builderSession !== 'theorycraft' || !this.currentBuild?.champion) return
      const current = this.currentBuild.champion
      let next: Champion = { ...current }
      let changed = false

      if (!resolveChampionStatsForBuild(current)) {
        const baseStats = detail.baseStats
        const growthStats = detail.growthStats
        if (baseStats && growthStats) {
          next = championWithStatsForBuild({ ...next, baseStats, growthStats } as Champion)
          changed = true
        }
      }

      const detailSpells = detail.spells
      if (
        Array.isArray(detailSpells) &&
        detailSpells.length > 0 &&
        (!Array.isArray(next.spells) || next.spells.length === 0)
      ) {
        next = { ...next, spells: detailSpells as Champion['spells'] }
        changed = true
      }

      const detailPassive = detail.passive
      if (detailPassive && typeof detailPassive === 'object' && !next.passive) {
        next = { ...next, passive: detailPassive as Champion['passive'] }
        changed = true
      }

      if (!changed) return

      this.currentBuild.champion = next
      this.recalculateStats()
    },

    recalculateStats() {
      const build = this.displayedBuild ?? this.currentBuild
      const hasChampionStats = (champion: unknown): boolean =>
        resolveChampionStatsForBuild(champion as Champion | null | undefined) != null

      if (!build || !build.champion || !hasChampionStats(build.champion)) {
        this.calculatedStats = null
        return
      }

      // Import and use stats calculator
      import('@lelanation/builds-stats').then(async ({ calculateStats }) => {
        const b = this.displayedBuild ?? this.currentBuild
        if (!b || !b.champion || !hasChampionStats(b.champion)) {
          this.calculatedStats = null
          return
        }

        const championForStats = championWithStatsForBuild(b.champion)
        const activeItemsForCalc =
          this.builderSession === 'theorycraft' ? this.getTheorycraftItemsForStats() : b.items

        let options: import('@lelanation/builds-stats').CalculateStatsOptions | undefined
        if (this.builderSession === 'theorycraft') {
          options = {
            includeStarterItems: true,
            adaptiveStat: resolveTheorycraftAdaptiveForBuild(championForStats, activeItemsForCalc),
          }
          if (this.theorycraftStackDefinitions.length > 0) {
            const { buildPassiveStackStatsProvider, buildPassiveStacksInput } =
              await import('~/utils/theorycraftStacks')
            const rankIndex = passiveRankForChampionLevel(this.statsLevel) - 1
            const passiveStacks = buildPassiveStacksInput(
              this.theorycraftStackDefinitions,
              this.theorycraftStackCounts
            )
            if (Object.keys(passiveStacks).length > 0) {
              options = {
                ...options,
                passiveStacks,
                getPassiveStackStats: buildPassiveStackStatsProvider(
                  this.theorycraftStackDefinitions,
                  this.theorycraftStackCalculationsBySource,
                  rankIndex,
                  this.theorycraftSpellRanks
                ),
              }
            }
          }
        }

        const stats = calculateStats(
          championForStats,
          activeItemsForCalc,
          b.runes,
          b.shards,
          this.statsLevel,
          options
        )

        if (this.builderSession === 'theorycraft' && stats) {
          const activeItems = this.getTheorycraftItemsForStats()
          const itemStacksById: Record<string, number> = {}
          const transformedById: Record<string, boolean> = {}
          for (const [indexStr, stacks] of Object.entries(this.theorycraftItemStacks)) {
            const item = b.items[Number(indexStr)]
            if (item) itemStacksById[item.id] = stacks
          }
          for (const [indexStr, transformed] of Object.entries(this.theorycraftItemTransformed)) {
            if (!transformed) continue
            const item = b.items[Number(indexStr)]
            if (item) transformedById[item.id] = true
          }
          const modifierResult = applyTheorycraftItemModifiers({
            stats,
            items: activeItems,
            itemStacksById,
            transformedById,
            labels: {},
            championBaseHealth: baseHpAtLevel(championForStats, this.statsLevel),
          })

          const adaptive = resolveTheorycraftAdaptiveForBuild(championForStats, activeItems)
          const runeModifierResult = applyTheorycraftRuneModifiers({
            stats: modifierResult.stats,
            runes: b.runes,
            shards: b.shards,
            runeStacksById: this.theorycraftRuneStacks,
            level: this.statsLevel,
            gameDurationMinutes: this.theorycraftGameDurationMinutes,
            adaptive,
            labels: {},
          })

          const activeSpellIds = new Set(
            Object.entries(this.theorycraftActiveSpells)
              .filter(([, enabled]) => enabled)
              .map(([id]) => id)
          )
          const buffResult = applyTheorycraftSpellBuffs({
            stats: runeModifierResult.stats,
            spells: this.theorycraftChampionSpells,
            activeSpellIds,
            spellRanks: this.theorycraftSpellRanks,
            level: this.statsLevel,
            labels: {},
          })

          const itemsWithIndex = this.getTheorycraftActiveItemsWithIndex()
          const passiveResult = applyTheorycraftItemPassives({
            stats: buffResult.stats,
            champion: championForStats,
            level: this.statsLevel,
            itemsWithIndex,
            activeByIndex: this.theorycraftActiveItemPassives,
            labels: {},
          })

          const buildStats = toTheorycraftBuildStats(
            passiveResult.stats,
            championForStats,
            this.statsLevel
          )
          this.theorycraftItemProcLines = computeTheorycraftItemProcLines({
            items: activeItems,
            itemsWithIndex,
            activePassivesByIndex: this.theorycraftActiveItemPassives,
            buildStats,
            labels: {},
          })

          this.calculatedStats = passiveResult.stats
          this.theorycraftItemModifierLines = modifierResult.lines
          this.theorycraftRuneModifierLines = runeModifierResult.lines
          this.theorycraftSpellBuffLines = buffResult.lines
          this.theorycraftItemPassiveLines = passiveResult.lines
          return
        }

        this.theorycraftItemModifierLines = []
        this.theorycraftRuneModifierLines = []
        this.theorycraftSpellBuffLines = []
        this.theorycraftItemProcLines = []
        this.theorycraftItemPassiveLines = []
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
                // Build saved locally but failed to remove from server (public→private)
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
              // Build saved locally but failed to save JSON on server
            }
          }
        } catch {
          // Build saved locally but API /api/builds is unreachable
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

      if (shouldAutoPrivatizeFromCommunityVotes(upvotes, downvotes)) {
        // Passer le build en privé (public → privé = supprimer sur le serveur)
        if (this.currentBuild && this.currentBuild.id === targetId) {
          this.currentBuild.visibility = 'private'
        }

        // Mettre à jour le build correspondant dans la liste sauvegardée
        const savedBuilds = this.getSavedBuilds()
        const existingIndex = savedBuilds.findIndex(b => b.id === targetId)
        if (existingIndex >= 0) {
          const existing = savedBuilds[existingIndex]
          if (!existing) return
          savedBuilds[existingIndex] = {
            ...existing,
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
    },

    getSavedBuilds(): Build[] {
      if (import.meta.server) return []
      try {
        const stored = localStorage.getItem('lelanation_builds')
        if (!stored) return []
        const parsed = JSON.parse(stored) as unknown[]
        return parsed.map(b => (isStoredBuild(b) ? hydrateBuild(b) : (b as Build)))
      } catch {
        return []
      }
    },

    async fetchServerPatchStaleMap(): Promise<Map<string, PatchStaleInfo | null>> {
      try {
        const response = await fetch(apiUrl('/api/builds'))
        if (!response.ok) return new Map()
        const serverBuilds = (await response.json()) as Array<
          Pick<StoredBuild, 'id'> & { patchStale?: PatchStaleInfo | null }
        >
        return extractPatchStaleMap(serverBuilds)
      } catch {
        return new Map()
      }
    },

    async syncPatchStaleFromServer(): Promise<void> {
      if (import.meta.server) return

      const savedBuilds = this.getSavedBuilds()
      if (savedBuilds.length === 0) return

      const patchStaleById = await this.fetchServerPatchStaleMap()
      if (patchStaleById.size === 0) return

      const merged = mergePatchStaleIntoBuilds(savedBuilds, patchStaleById)
      const changed = merged.some((build, index) => build !== savedBuilds[index])
      if (!changed) return

      const toStore = merged.map(build => serializeBuild(build))
      localStorage.setItem('lelanation_builds', JSON.stringify(toStore))
      this.savedBuildsVersion++
    },

    async applyServerPatchStale(build: Build): Promise<Build> {
      try {
        const response = await fetch(apiUrl(`/api/builds/${encodeURIComponent(build.id)}`))
        if (!response.ok) return build
        const serverBuild = (await response.json()) as {
          patchStale?: PatchStaleInfo | null
        }
        return applyPatchStaleToBuild(build, serverBuild.patchStale ?? null)
      } catch {
        return build
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
            // Build might not exist on server (404 is ok)
          }
        } catch {
          // Don't fail the deletion if API call fails (build might not exist on server)
        }

        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to delete build'
        this.status = 'error'
        return false
      }
    },

    async setSavedBuildVisibility(
      buildId: string,
      visibility: 'public' | 'private'
    ): Promise<boolean> {
      if (import.meta.server) return false
      try {
        const savedBuilds = this.getSavedBuilds()
        const index = savedBuilds.findIndex(b => b.id === buildId)
        if (index < 0) return false
        const existing = savedBuilds[index]
        if (!existing) return false

        const updated: Build = {
          ...existing,
          visibility,
          updatedAt: new Date().toISOString(),
        }
        savedBuilds[index] = updated
        localStorage.setItem(
          'lelanation_builds',
          JSON.stringify(savedBuilds.map(b => serializeBuild(b)))
        )
        this.savedBuildsVersion++

        if (this.currentBuild?.id === buildId) {
          this.currentBuild.visibility = visibility
          this.currentBuild.updatedAt = updated.updatedAt
        }

        try {
          if (visibility === 'private') {
            const delResponse = await fetch(apiUrl(`/api/builds/${encodeURIComponent(buildId)}`), {
              method: 'DELETE',
            })
            if (!delResponse.ok && delResponse.status !== 404) {
              // keep local update even if server delete fails
            }
          } else {
            await fetch(apiUrl('/api/builds'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(serializeBuild(updated)),
            })
          }
        } catch {
          // keep local update even if API is unreachable
        }

        return true
      } catch (error) {
        this.error = error instanceof Error ? error.message : 'Failed to update build visibility'
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
          try {
            const saveResponse = await fetch(apiUrl('/api/builds'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(serializeBuild(build)),
            })

            if (saveResponse.ok) {
              return true
            }
            return false
          } catch {
            return false
          }
        } else if (checkResponse.ok) {
          return true
        } else {
          return false
        }
      } catch {
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
