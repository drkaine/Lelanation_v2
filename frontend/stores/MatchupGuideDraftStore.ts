import { defineStore } from 'pinia'
import type {
  ChampionRef,
  MatchupEntry,
  MatchupGuide,
  MatchupGuideMeta,
} from '@lelanation/shared-types'
import type { Build } from '~/types/build'
import { buildMatchupGuideFromDraft, createEmptyMatchupEntry } from '~/utils/matchupGuideFromBuild'
import {
  extractMatchupCopyPatch,
  normalizeMatchupEntry,
  syncMatchupEntryLegacyFields,
  type MatchupCopyFieldKey,
} from '~/utils/matchupEntryUtils'
import {
  areAllMatchupsFinalizeReady,
  inferMaxReachedStep,
  MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE,
  matchupGuideStepRank,
} from '~/utils/matchupGuideCreateSteps'

const STORAGE_KEY = 'lelanation_matchup_guide_draft'

export type MatchupGuideDraftStep =
  | 'champion'
  | 'rune'
  | 'item'
  | 'info'
  | 'matchups'
  | 'write'
  | 'finalize'

type MatchupGuideDraftSnapshot = {
  guideId: string
  matchupEntries: MatchupEntry[]
  guideChampionId: string | null
  lastStep: MatchupGuideDraftStep
  maxReachedStep: MatchupGuideDraftStep
  meta: MatchupGuideMeta
  selectedOpponentIds: string[]
  savedOpponentIds: string[]
}

function newGuideId(): string {
  if (import.meta.client && typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `guide-${Date.now()}`
}

function isValidChampionRef(value: unknown): value is ChampionRef {
  if (!value || typeof value !== 'object') return false
  const ref = value as ChampionRef
  return (
    typeof ref.id === 'string' &&
    typeof ref.name === 'string' &&
    Boolean(ref.image) &&
    typeof ref.image.full === 'string'
  )
}

function normalizeMeta(value: unknown): MatchupGuideMeta {
  if (!value || typeof value !== 'object') return {}
  const raw = value as MatchupGuideMeta
  const socialLinks = Array.isArray(raw.socialLinks)
    ? raw.socialLinks.filter(
        (link): link is string => typeof link === 'string' && link.trim().length > 0
      )
    : undefined
  return {
    permabanNotes: typeof raw.permabanNotes === 'string' ? raw.permabanNotes : undefined,
    generalBuildNotes:
      typeof raw.generalBuildNotes === 'string' ? raw.generalBuildNotes : undefined,
    socialLinks: socialLinks?.length ? socialLinks : undefined,
  }
}

function normalizeMatchupEntryList(value: unknown): MatchupEntry[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeMatchupEntry).filter((entry): entry is MatchupEntry => entry !== null)
}

function migrateLegacySnapshot(parsed: Record<string, unknown>): MatchupGuideDraftSnapshot | null {
  if (!parsed || typeof parsed.guideId !== 'string' || !parsed.guideId) return null

  const validSteps: MatchupGuideDraftStep[] = [
    'champion',
    'rune',
    'item',
    'info',
    'matchups',
    'write',
    'finalize',
  ]
  const lastStep = parsed.lastStep
  const meta = normalizeMeta(parsed.meta)

  let matchupEntries: MatchupEntry[] = []
  if (Array.isArray(parsed.matchupEntries)) {
    matchupEntries = normalizeMatchupEntryList(parsed.matchupEntries)
  } else {
    const rankedOpponents = Array.isArray(parsed.rankedOpponents)
      ? parsed.rankedOpponents.filter(isValidChampionRef)
      : []
    matchupEntries = rankedOpponents.map(createEmptyMatchupEntry)
  }

  let selectedOpponentIds: string[] = []
  if (Array.isArray(parsed.selectedOpponentIds)) {
    selectedOpponentIds = parsed.selectedOpponentIds.filter(
      (id): id is string => typeof id === 'string'
    )
  } else if (typeof parsed.selectedOpponentId === 'string') {
    selectedOpponentIds = [parsed.selectedOpponentId]
  }

  let savedOpponentIds: string[] = []
  if (Array.isArray(parsed.savedOpponentIds)) {
    savedOpponentIds = parsed.savedOpponentIds.filter((id): id is string => typeof id === 'string')
  }

  const resolvedLastStep = validSteps.includes(lastStep as MatchupGuideDraftStep)
    ? (lastStep as MatchupGuideDraftStep)
    : 'champion'

  let maxReachedStep: MatchupGuideDraftStep = resolvedLastStep
  if (
    typeof parsed.maxReachedStep === 'string' &&
    validSteps.includes(parsed.maxReachedStep as MatchupGuideDraftStep)
  ) {
    maxReachedStep = parsed.maxReachedStep as MatchupGuideDraftStep
  } else {
    maxReachedStep = inferMaxReachedStep(resolvedLastStep, matchupEntries.length)
  }

  if (
    matchupGuideStepRank(maxReachedStep) <
    matchupGuideStepRank(inferMaxReachedStep(resolvedLastStep, matchupEntries.length))
  ) {
    maxReachedStep = inferMaxReachedStep(resolvedLastStep, matchupEntries.length)
  }

  if (matchupGuideStepRank(maxReachedStep) < matchupGuideStepRank(resolvedLastStep)) {
    maxReachedStep = resolvedLastStep
  }

  return {
    guideId: parsed.guideId,
    matchupEntries,
    guideChampionId: typeof parsed.guideChampionId === 'string' ? parsed.guideChampionId : null,
    lastStep: resolvedLastStep,
    maxReachedStep,
    meta,
    selectedOpponentIds,
    savedOpponentIds,
  }
}

function readDraftSnapshot(): MatchupGuideDraftSnapshot | null {
  if (import.meta.server) return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return migrateLegacySnapshot(parsed)
  } catch {
    return null
  }
}

function writeDraftSnapshot(snapshot: MatchupGuideDraftSnapshot | null) {
  if (import.meta.server) return
  try {
    if (!snapshot) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // ignore persistence errors
  }
}

export const useMatchupGuideDraftStore = defineStore('matchupGuideDraft', {
  state: () => ({
    guideId: '' as string,
    matchupEntries: [] as MatchupEntry[],
    guideChampionId: null as string | null,
    lastStep: 'champion' as MatchupGuideDraftStep,
    maxReachedStep: 'champion' as MatchupGuideDraftStep,
    meta: {} as MatchupGuideMeta,
    selectedOpponentIds: [] as string[],
    savedOpponentIds: [] as string[],
    hydrated: false,
  }),

  getters: {
    rankedOpponents(state): ChampionRef[] {
      return state.matchupEntries.map(entry => entry.opponent)
    },
    rankedOpponentIds(state): Set<string> {
      return new Set(state.matchupEntries.map(entry => entry.opponent.id))
    },
    selectedEntries(state): MatchupEntry[] {
      if (state.selectedOpponentIds.length === 0) return []
      const ids = new Set(state.selectedOpponentIds)
      return state.matchupEntries.filter(entry => ids.has(entry.opponent.id))
    },
    savedOpponentIdSet(state): Set<string> {
      return new Set(state.savedOpponentIds)
    },
    allMatchupsSaved(state): boolean {
      return (
        state.matchupEntries.length > 0 &&
        state.matchupEntries.every(entry => state.savedOpponentIds.includes(entry.opponent.id))
      )
    },
    hasMatchupScale(state): boolean {
      return state.matchupEntries.length >= MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE
    },
    canOpenWriteStep(state): boolean {
      return state.matchupEntries.length >= MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE
    },
    canOpenFinalizeStep(state): boolean {
      return areAllMatchupsFinalizeReady(state.matchupEntries)
    },
  },

  actions: {
    toSnapshot(): MatchupGuideDraftSnapshot {
      return {
        guideId: this.guideId,
        matchupEntries: this.matchupEntries,
        guideChampionId: this.guideChampionId,
        lastStep: this.lastStep,
        maxReachedStep: this.maxReachedStep,
        meta: this.meta,
        selectedOpponentIds: this.selectedOpponentIds,
        savedOpponentIds: this.savedOpponentIds,
      }
    },

    persist() {
      if (!this.guideId) {
        writeDraftSnapshot(null)
        return
      }
      writeDraftSnapshot(this.toSnapshot())
    },

    hydrateFromStorage() {
      const snapshot = readDraftSnapshot()
      if (!snapshot) {
        this.hydrated = true
        return
      }

      if (this.hydrated && this.guideId === snapshot.guideId) return

      this.guideId = snapshot.guideId
      this.matchupEntries = snapshot.matchupEntries
      this.guideChampionId = snapshot.guideChampionId
      this.lastStep = snapshot.lastStep
      this.maxReachedStep = snapshot.maxReachedStep
      this.meta = snapshot.meta
      this.selectedOpponentIds = snapshot.selectedOpponentIds
      this.savedOpponentIds = snapshot.savedOpponentIds.filter(id =>
        this.matchupEntries.some(entry => entry.opponent.id === id)
      )
      if (this.selectedOpponentIds.length === 0 && this.matchupEntries[0]) {
        this.selectedOpponentIds = [this.matchupEntries[0].opponent.id]
      }
      this.hydrated = true
    },

    setLastStep(step: MatchupGuideDraftStep) {
      this.ensureGuideId()
      if (matchupGuideStepRank(step) > matchupGuideStepRank(this.maxReachedStep)) {
        this.maxReachedStep = step
      }
      this.lastStep = step
      this.persist()
    },

    advanceMaxReachedStep(step: MatchupGuideDraftStep) {
      this.ensureGuideId()
      if (matchupGuideStepRank(step) > matchupGuideStepRank(this.maxReachedStep)) {
        this.maxReachedStep = step
        this.persist()
      }
    },

    setSelectedOpponents(opponentIds: string[]) {
      this.selectedOpponentIds = opponentIds.filter(id =>
        this.matchupEntries.some(entry => entry.opponent.id === id)
      )
      if (this.selectedOpponentIds.length === 0 && this.matchupEntries[0]) {
        this.selectedOpponentIds = [this.matchupEntries[0].opponent.id]
      }
      this.persist()
    },

    toggleSelectedOpponent(opponentId: string) {
      const ids = new Set(this.selectedOpponentIds)
      if (ids.has(opponentId)) ids.delete(opponentId)
      else ids.add(opponentId)
      this.selectedOpponentIds = [...ids]
      if (this.selectedOpponentIds.length === 0 && this.matchupEntries[0]) {
        this.selectedOpponentIds = [this.matchupEntries[0].opponent.id]
      }
      this.persist()
    },

    updateMeta(patch: Partial<MatchupGuideMeta>) {
      this.meta = { ...this.meta, ...patch }
      this.persist()
    },

    updateMatchupEntry(opponentId: string, patch: Partial<Omit<MatchupEntry, 'opponent'>>) {
      const index = this.matchupEntries.findIndex(e => e.opponent.id === opponentId)
      if (index < 0) return
      this.matchupEntries[index] = syncMatchupEntryLegacyFields({
        ...this.matchupEntries[index],
        ...patch,
      })
      this.persist()
    },

    updateSelectedMatchupEntries(patch: Partial<Omit<MatchupEntry, 'opponent'>>) {
      const ids = new Set(this.selectedOpponentIds)
      if (ids.size === 0) return
      this.matchupEntries = this.matchupEntries.map(entry =>
        ids.has(entry.opponent.id) ? syncMatchupEntryLegacyFields({ ...entry, ...patch }) : entry
      )
      this.persist()
    },

    markSelectedAsSaved(): 'saved' | 'advanced' | 'all_done' | 'none' {
      const ids = this.selectedOpponentIds.filter(id =>
        this.matchupEntries.some(entry => entry.opponent.id === id)
      )
      if (!ids.length) return 'none'

      const saved = new Set(this.savedOpponentIds)
      let newlySaved = false
      for (const id of ids) {
        if (!saved.has(id)) {
          saved.add(id)
          newlySaved = true
        }
      }
      this.savedOpponentIds = [...saved]

      const next = this.matchupEntries.find(entry => !saved.has(entry.opponent.id))
      if (next) {
        this.selectedOpponentIds = [next.opponent.id]
      }

      this.persist()
      if (!next) return 'all_done'
      return newlySaved ? 'saved' : 'advanced'
    },

    copyMatchupFieldsToTargets(
      sourceOpponentId: string,
      targetOpponentIds: string[],
      fields: MatchupCopyFieldKey[]
    ): boolean {
      if (!fields.length) return false

      const source = this.matchupEntries.find(entry => entry.opponent.id === sourceOpponentId)
      if (!source) return false

      const targets = [...new Set(targetOpponentIds.filter(id => id !== sourceOpponentId))]
      if (!targets.length) return false

      const patch = extractMatchupCopyPatch(source, new Set(fields))
      this.matchupEntries = this.matchupEntries.map(entry =>
        targets.includes(entry.opponent.id)
          ? syncMatchupEntryLegacyFields({ ...entry, ...patch })
          : entry
      )
      this.persist()
      return true
    },

    syncGuideChampion(championId: string | null) {
      if (!this.hydrated) this.hydrateFromStorage()

      if (!championId) {
        if (this.guideChampionId !== null || this.matchupEntries.length > 0) {
          this.guideChampionId = null
          this.matchupEntries = []
          this.selectedOpponentIds = []
          this.savedOpponentIds = []
          this.maxReachedStep = 'champion'
          this.persist()
        }
        return
      }

      if (!this.guideChampionId) {
        this.guideChampionId = championId
        this.persist()
        return
      }

      if (this.guideChampionId !== championId) {
        this.guideChampionId = championId
        this.matchupEntries = []
        this.selectedOpponentIds = []
        this.savedOpponentIds = []
        this.maxReachedStep = 'champion'
        this.persist()
      }
    },

    startNewGuide() {
      this.guideId = newGuideId()
      this.matchupEntries = []
      this.guideChampionId = null
      this.lastStep = 'champion'
      this.maxReachedStep = 'champion'
      this.meta = {}
      this.selectedOpponentIds = []
      this.savedOpponentIds = []
      this.hydrated = true
      this.persist()
    },

    ensureGuideId() {
      if (!this.guideId) {
        if (!this.hydrated) this.hydrateFromStorage()
      }
      if (!this.guideId) this.guideId = newGuideId()
      this.persist()
    },

    addOpponent(opponent: ChampionRef) {
      if (this.matchupEntries.some(e => e.opponent.id === opponent.id)) return
      this.matchupEntries.push(createEmptyMatchupEntry(opponent))
      this.selectedOpponentIds = [opponent.id]
      this.persist()
    },

    removeOpponent(opponentId: string) {
      this.matchupEntries = this.matchupEntries.filter(e => e.opponent.id !== opponentId)
      this.selectedOpponentIds = this.selectedOpponentIds.filter(id => id !== opponentId)
      this.savedOpponentIds = this.savedOpponentIds.filter(id => id !== opponentId)
      if (this.selectedOpponentIds.length === 0 && this.matchupEntries[0]) {
        this.selectedOpponentIds = [this.matchupEntries[0].opponent.id]
      }
      this.persist()
    },

    moveOpponent(fromIndex: number, toIndex: number) {
      if (fromIndex < 0 || toIndex < 0) return
      if (fromIndex >= this.matchupEntries.length || toIndex >= this.matchupEntries.length) return
      const next = [...this.matchupEntries]
      const [moved] = next.splice(fromIndex, 1)
      if (!moved) return
      next.splice(toIndex, 0, moved)
      this.matchupEntries = next
      this.persist()
    },

    /** `rank` is 1-based (1 = best matchup at the top). */
    setOpponentRank(fromIndex: number, rank: number) {
      const count = this.matchupEntries.length
      if (count === 0) return
      if (fromIndex < 0 || fromIndex >= count) return
      if (!Number.isFinite(rank)) return
      const toIndex = Math.min(Math.max(1, Math.trunc(rank)), count) - 1
      if (toIndex === fromIndex) return
      this.moveOpponent(fromIndex, toIndex)
    },

    buildGuideFromCurrentBuild(build: Build | null) {
      this.ensureGuideId()
      if (!build?.champion) return null
      if (this.matchupEntries.length < MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE) return null
      if (!areAllMatchupsFinalizeReady(this.matchupEntries)) return null
      const matchups = this.matchupEntries.map(entry => syncMatchupEntryLegacyFields({ ...entry }))
      return buildMatchupGuideFromDraft(build, matchups, this.guideId, this.meta)
    },

    reset() {
      this.guideId = ''
      this.matchupEntries = []
      this.guideChampionId = null
      this.lastStep = 'champion'
      this.maxReachedStep = 'champion'
      this.meta = {}
      this.selectedOpponentIds = []
      this.savedOpponentIds = []
      this.hydrated = true
      writeDraftSnapshot(null)
    },

    loadFromGuide(guide: MatchupGuide) {
      this.guideId = guide.id
      this.matchupEntries = matchupEntriesFromGuide(guide)
      this.guideChampionId = guide.champion?.id ?? null
      this.meta = guide.meta ?? {}
      this.selectedOpponentIds = this.matchupEntries[0] ? [this.matchupEntries[0].opponent.id] : []
      this.savedOpponentIds = []
      this.lastStep =
        this.matchupEntries.length >= MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE
          ? 'finalize'
          : 'champion'
      this.maxReachedStep =
        this.matchupEntries.length >= MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE
          ? 'finalize'
          : 'champion'
      this.hydrated = true
      this.persist()
    },
  },
})

function matchupEntriesFromGuide(guide: MatchupGuide) {
  if (guide.matchups?.length) return guide.matchups

  const seen = new Set<string>()
  const opponents = []
  for (const opponent of guide.bestMatchups ?? []) {
    if (seen.has(opponent.id)) continue
    seen.add(opponent.id)
    opponents.push(opponent)
  }
  for (const opponent of [...(guide.worstMatchups ?? [])].reverse()) {
    if (seen.has(opponent.id)) continue
    seen.add(opponent.id)
    opponents.push(opponent)
  }
  return opponents.map(createEmptyMatchupEntry)
}
