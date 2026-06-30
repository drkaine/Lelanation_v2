import type {
  MatchupBuildVariantPick,
  MatchupBuildVariantRef,
  MatchupDifficultyBand,
  MatchupDifficultyMode,
  MatchupEntry,
  MatchupOutcomeKind,
  MatchupPhaseNotes,
  MatchupPhaseTag,
  MatchupPowerSpike,
  MatchupSkillFavor,
} from '@lelanation/shared-types'
import type { Build } from '~/types/build'

const OUTCOME_KINDS: MatchupOutcomeKind[] = ['win', 'lose', 'skill', 'even']
const SKILL_FAVORS: MatchupSkillFavor[] = ['self', 'opponent', 'even']
const DIFFICULTY_BANDS: MatchupDifficultyBand[] = ['easy', 'medium', 'hard', 'very_hard']
const DIFFICULTY_MODES: MatchupDifficultyMode[] = ['score', 'band']
const PHASE_TAGS: MatchupPhaseTag[] = [
  'win',
  'lose',
  'skill',
  'even',
  'farm',
  'demand_gank',
  'aggressive',
  'passive',
]

function normalizeBuildVariantRef(value: unknown): MatchupBuildVariantRef | null {
  if (value === 'main') return 'main'
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value)
  }
  return null
}

function normalizeBuildVariantPick(value: unknown): MatchupBuildVariantPick | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as MatchupBuildVariantPick
  const variant = normalizeBuildVariantRef(raw.variant)
  if (variant === null) return null
  const reason = typeof raw.reason === 'string' ? raw.reason.trim() : undefined
  return { variant, reason: reason || undefined }
}

function normalizeBuildVariants(
  raw: Partial<MatchupEntry> & { buildVariants?: unknown; buildVariant?: unknown }
): MatchupBuildVariantPick[] | undefined {
  if (Array.isArray(raw.buildVariants)) {
    const picks = raw.buildVariants
      .map(normalizeBuildVariantPick)
      .filter((pick): pick is MatchupBuildVariantPick => pick !== null)
    return picks.length ? picks : undefined
  }

  const legacy = normalizeBuildVariantRef(raw.buildVariant)
  return legacy !== null ? [{ variant: legacy }] : undefined
}

function normalizePowerSpike(value: unknown): MatchupPowerSpike | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as MatchupPowerSpike
  const levels = Array.isArray(raw.levels)
    ? [
        ...new Set(
          raw.levels.filter(l => typeof l === 'number' && l >= 1 && l <= 20).map(Math.trunc)
        ),
      ].sort((a, b) => a - b)
    : []
  const notes = typeof raw.notes === 'string' ? raw.notes.trim() : undefined
  if (!levels.length && !notes) return undefined
  return { levels, notes: notes || undefined }
}

function normalizePhaseNotes(value: unknown): MatchupPhaseNotes | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as MatchupPhaseNotes
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is MatchupPhaseTag => PHASE_TAGS.includes(tag as MatchupPhaseTag))
    : undefined
  const notes = typeof raw.notes === 'string' ? raw.notes : undefined
  if (!tags?.length && !notes?.trim()) return undefined
  return { tags: tags?.length ? tags : undefined, notes: notes?.trim() || undefined }
}

export function getMatchupBuildVariants(entry: MatchupEntry): MatchupBuildVariantPick[] {
  if (entry.buildVariants?.length) return entry.buildVariants
  if (entry.buildVariant !== undefined) return [{ variant: entry.buildVariant }]
  return []
}

export function buildVariantLabel(
  variant: MatchupBuildVariantRef,
  build: Build | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  if (!build) {
    return variant === 'main'
      ? t('matchupGuideCreate.buildVariantMain')
      : t('matchupGuideCreate.buildVariantSub', { n: Number(variant) + 1 })
  }
  if (variant === 'main') {
    return build.name?.trim() || t('matchupGuideCreate.buildVariantMain')
  }
  const sub = build.subBuilds?.[variant]
  return sub?.title?.trim() || t('matchupGuideCreate.buildVariantSub', { n: variant + 1 })
}

export function listBuildVariantOptions(
  build: Build | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
): Array<{ variant: MatchupBuildVariantRef; subIndex: number | null; label: string }> {
  if (!build) return []
  const options: Array<{
    variant: MatchupBuildVariantRef
    subIndex: number | null
    label: string
  }> = [
    {
      variant: 'main',
      subIndex: null,
      label: buildVariantLabel('main', build, t),
    },
  ]
  ;(build.subBuilds ?? []).forEach((sub, index) => {
    options.push({
      variant: index,
      subIndex: index,
      label: sub.title?.trim() || t('matchupGuideCreate.buildVariantSub', { n: index + 1 }),
    })
  })
  return options
}

export function formatBuildVariantsCell(
  entry: MatchupEntry,
  build: Build | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  const picks = getMatchupBuildVariants(entry)
  if (!picks.length) {
    if (entry.itemPath?.trim()) return entry.itemPath.trim()
    return '—'
  }
  return picks
    .map(pick => {
      const label = buildVariantLabel(pick.variant, build, t)
      return pick.reason?.trim() ? `${label} (${pick.reason.trim()})` : label
    })
    .join(' · ')
}

export function formatPowerSpikeCell(entry: MatchupEntry): string {
  const spike = entry.powerSpike
  if (!spike?.levels?.length && !spike?.notes?.trim()) return '—'
  const parts: string[] = []
  if (spike.levels?.length) parts.push(spike.levels.map(l => `${l}`).join(', '))
  if (spike.notes?.trim()) parts.push(spike.notes.trim())
  return parts.join(' — ')
}

export function normalizeMatchupEntry(value: unknown): MatchupEntry | null {
  if (!value || typeof value !== 'object') return null
  const raw = value as Partial<MatchupEntry> & { opponent?: unknown }
  if (
    !raw.opponent ||
    typeof raw.opponent !== 'object' ||
    typeof (raw.opponent as { id?: string }).id !== 'string'
  ) {
    return null
  }

  const opponent = raw.opponent as MatchupEntry['opponent']
  const difficultyScore =
    typeof raw.difficultyScore === 'number' && raw.difficultyScore >= 1 && raw.difficultyScore <= 10
      ? Math.trunc(raw.difficultyScore)
      : undefined
  const buildVariants = normalizeBuildVariants(raw)

  return {
    opponent,
    difficultyScore,
    difficultyBand: DIFFICULTY_BANDS.includes(raw.difficultyBand as MatchupDifficultyBand)
      ? (raw.difficultyBand as MatchupDifficultyBand)
      : undefined,
    difficultyMode: DIFFICULTY_MODES.includes(raw.difficultyMode as MatchupDifficultyMode)
      ? (raw.difficultyMode as MatchupDifficultyMode)
      : undefined,
    outcomeKind: OUTCOME_KINDS.includes(raw.outcomeKind as MatchupOutcomeKind)
      ? (raw.outcomeKind as MatchupOutcomeKind)
      : undefined,
    skillFavor: SKILL_FAVORS.includes(raw.skillFavor as MatchupSkillFavor)
      ? (raw.skillFavor as MatchupSkillFavor)
      : undefined,
    buildVariants,
    buildVariant: buildVariants?.length === 1 ? buildVariants[0].variant : undefined,
    powerSpike: normalizePowerSpike(raw.powerSpike),
    early: normalizePhaseNotes(raw.early),
    mid: normalizePhaseNotes(raw.mid),
    late: normalizePhaseNotes(raw.late),
    outcome: typeof raw.outcome === 'string' ? raw.outcome : undefined,
    runes: typeof raw.runes === 'string' ? raw.runes : undefined,
    itemPath: typeof raw.itemPath === 'string' ? raw.itemPath : undefined,
    difficulty: typeof raw.difficulty === 'string' ? raw.difficulty : undefined,
    comments: typeof raw.comments === 'string' ? raw.comments : undefined,
  }
}

export function syncMatchupEntryLegacyFields(entry: MatchupEntry): MatchupEntry {
  const next = { ...entry }
  const picks = getMatchupBuildVariants(next)

  if (picks.length === 1) {
    next.buildVariant = picks[0].variant
  } else {
    next.buildVariant = undefined
  }
  next.buildVariants = picks.length ? picks : undefined

  if (next.outcomeKind) {
    if (next.outcomeKind === 'skill' && next.skillFavor) {
      const favor =
        next.skillFavor === 'self' ? 'self' : next.skillFavor === 'opponent' ? 'opponent' : 'even'
      next.outcome = `Skill (${favor})`
    } else {
      next.outcome = next.outcomeKind
    }
  }

  if (next.difficultyMode === 'score' && next.difficultyScore) {
    next.difficulty = `${next.difficultyScore}/10`
  } else if (next.difficultyBand) {
    next.difficulty = next.difficultyBand
  }

  return next
}

export function formatPhaseTags(
  tags: MatchupPhaseTag[] | undefined,
  t: (key: string) => string
): string {
  if (!tags?.length) return ''
  return tags.map(tag => t(`matchupGuideCreate.phaseTag.${tag}`)).join(', ')
}

export function variantRefKey(variant: MatchupBuildVariantRef): string {
  return variant === 'main' ? 'main' : String(variant)
}

export function variantRefFromKey(key: string): MatchupBuildVariantRef | null {
  if (key === 'main') return 'main'
  const parsed = Number.parseInt(key, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export const MATCHUP_COPY_FIELD_KEYS = [
  'difficulty',
  'outcome',
  'buildVariants',
  'powerSpike',
  'early',
  'mid',
  'late',
  'comments',
] as const

export type MatchupCopyFieldKey = (typeof MATCHUP_COPY_FIELD_KEYS)[number]

function clonePhaseNotes(value: MatchupPhaseNotes | undefined): MatchupPhaseNotes | undefined {
  if (!value) return undefined
  return {
    tags: value.tags?.length ? [...value.tags] : undefined,
    notes: value.notes,
  }
}

function cloneBuildVariants(
  value: MatchupBuildVariantPick[] | undefined
): MatchupBuildVariantPick[] | undefined {
  if (!value?.length) return undefined
  return value.map(pick => ({ ...pick }))
}

function clonePowerSpike(value: MatchupPowerSpike | undefined): MatchupPowerSpike | undefined {
  if (!value) return undefined
  return {
    levels: [...value.levels],
    notes: value.notes,
  }
}

export function matchupEntryHasContent(entry: MatchupEntry): boolean {
  return Boolean(
    entry.outcomeKind ||
    entry.difficultyScore ||
    entry.difficultyBand ||
    entry.buildVariants?.length ||
    entry.buildVariant !== undefined ||
    entry.powerSpike?.levels?.length ||
    entry.powerSpike?.notes?.trim() ||
    entry.comments?.trim() ||
    entry.early?.tags?.length ||
    entry.early?.notes?.trim() ||
    entry.mid?.tags?.length ||
    entry.mid?.notes?.trim() ||
    entry.late?.tags?.length ||
    entry.late?.notes?.trim()
  )
}

export function extractMatchupCopyPatch(
  entry: MatchupEntry,
  fields: ReadonlySet<MatchupCopyFieldKey>
): Partial<Omit<MatchupEntry, 'opponent'>> {
  const patch: Partial<Omit<MatchupEntry, 'opponent'>> = {}

  if (fields.has('difficulty')) {
    patch.difficultyMode = entry.difficultyMode
    patch.difficultyScore = entry.difficultyScore
    patch.difficultyBand = entry.difficultyBand
  }

  if (fields.has('outcome')) {
    patch.outcomeKind = entry.outcomeKind
    patch.skillFavor = entry.skillFavor
  }

  if (fields.has('buildVariants')) {
    patch.buildVariants = cloneBuildVariants(entry.buildVariants)
    patch.buildVariant = entry.buildVariant
  }

  if (fields.has('powerSpike')) {
    patch.powerSpike = clonePowerSpike(entry.powerSpike)
  }

  if (fields.has('early')) patch.early = clonePhaseNotes(entry.early)
  if (fields.has('mid')) patch.mid = clonePhaseNotes(entry.mid)
  if (fields.has('late')) patch.late = clonePhaseNotes(entry.late)

  if (fields.has('comments')) {
    patch.comments = entry.comments
  }

  return patch
}

const DIFFICULTY_BAND_SORT: Record<MatchupDifficultyBand, number> = {
  easy: 2,
  medium: 5,
  hard: 7,
  very_hard: 9,
}

export function formatMatchupOutcome(entry: MatchupEntry, t: (key: string) => string): string {
  if (entry.outcomeKind) {
    let label = t(`matchupGuideCreate.outcomeKind.${entry.outcomeKind}`)
    if (entry.outcomeKind === 'skill' && entry.skillFavor) {
      label += ` (${t(`matchupGuideCreate.skillFavor.${entry.skillFavor}`)})`
    }
    return label
  }
  return entry.outcome?.trim() || '—'
}

export function formatMatchupDifficulty(entry: MatchupEntry, t: (key: string) => string): string {
  if (entry.difficultyMode === 'score' && entry.difficultyScore) {
    return `${entry.difficultyScore}/10`
  }
  if (entry.difficultyBand) {
    return t(`matchupGuideCreate.difficultyBand.${entry.difficultyBand}`)
  }
  return entry.difficulty?.trim() || '—'
}

export function matchupDifficultySortValue(entry: MatchupEntry): number | null {
  if (entry.difficultyMode === 'score' && typeof entry.difficultyScore === 'number') {
    return entry.difficultyScore
  }
  if (entry.difficultyBand) {
    return DIFFICULTY_BAND_SORT[entry.difficultyBand] ?? null
  }
  return null
}

export { PHASE_TAGS, OUTCOME_KINDS, SKILL_FAVORS, DIFFICULTY_BANDS, DIFFICULTY_MODES }
