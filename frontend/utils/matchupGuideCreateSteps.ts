import type { MatchupEntry } from '@lelanation/shared-types'
import type { MatchupGuideDraftStep } from '~/stores/MatchupGuideDraftStore'
import { getMatchupBuildVariants } from '~/utils/matchupEntryUtils'

export const MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE = 10

export const MATCHUP_GUIDE_STEP_ORDER: MatchupGuideDraftStep[] = [
  'champion',
  'rune',
  'item',
  'info',
  'matchups',
  'write',
  'finalize',
]

export function matchupGuideStepRank(step: MatchupGuideDraftStep): number {
  return MATCHUP_GUIDE_STEP_ORDER.indexOf(step)
}

export function hasReachedMatchupGuideStep(
  maxReachedStep: MatchupGuideDraftStep,
  target: MatchupGuideDraftStep
): boolean {
  return matchupGuideStepRank(maxReachedStep) >= matchupGuideStepRank(target)
}

export function effectiveMatchupGuideMaxReachedStep(
  lastStep: MatchupGuideDraftStep,
  maxReachedStep: MatchupGuideDraftStep
): MatchupGuideDraftStep {
  return hasReachedMatchupGuideStep(lastStep, maxReachedStep) ? lastStep : maxReachedStep
}

export function inferMaxReachedStep(
  lastStep: MatchupGuideDraftStep,
  matchupCount: number
): MatchupGuideDraftStep {
  let maxReached = lastStep
  if (
    matchupCount >= MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE &&
    matchupGuideStepRank(maxReached) < matchupGuideStepRank('write')
  ) {
    maxReached = 'write'
  } else if (matchupGuideStepRank(maxReached) < matchupGuideStepRank('matchups')) {
    maxReached = 'matchups'
  }
  return maxReached
}

export function matchupEntryHasDifficulty(entry: MatchupEntry): boolean {
  if (entry.difficultyBand) return true
  return (
    typeof entry.difficultyScore === 'number' &&
    entry.difficultyScore >= 1 &&
    entry.difficultyScore <= 10
  )
}

export function matchupEntryHasBuildPick(entry: MatchupEntry): boolean {
  return getMatchupBuildVariants(entry).length > 0
}

export function matchupEntryHasAdvice(entry: MatchupEntry): boolean {
  return Boolean(entry.comments?.trim())
}

export function isMatchupEntryFinalizeReady(entry: MatchupEntry): boolean {
  return (
    matchupEntryHasDifficulty(entry) &&
    matchupEntryHasBuildPick(entry) &&
    matchupEntryHasAdvice(entry)
  )
}

export type MatchupRequiredFieldKey = 'difficulty' | 'build' | 'comments'

export function getMatchupEntryMissingRequiredFields(
  entry: MatchupEntry
): MatchupRequiredFieldKey[] {
  const missing: MatchupRequiredFieldKey[] = []
  if (!matchupEntryHasDifficulty(entry)) missing.push('difficulty')
  if (!matchupEntryHasBuildPick(entry)) missing.push('build')
  if (!matchupEntryHasAdvice(entry)) missing.push('comments')
  return missing
}

export function getMissingRequiredFieldsForEntries(
  entries: MatchupEntry[]
): Set<MatchupRequiredFieldKey> {
  const missing = new Set<MatchupRequiredFieldKey>()
  for (const entry of entries) {
    for (const field of getMatchupEntryMissingRequiredFields(entry)) {
      missing.add(field)
    }
  }
  return missing
}

export function countMatchupsFinalizeReady(entries: MatchupEntry[]): number {
  return entries.filter(isMatchupEntryFinalizeReady).length
}

export function areAllMatchupsFinalizeReady(entries: MatchupEntry[]): boolean {
  return (
    entries.length >= MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE &&
    entries.every(isMatchupEntryFinalizeReady)
  )
}

export type MatchupGuideStepAccessContext = {
  buildValid: boolean
  hasChampion: boolean
  matchupCount: number
  matchupEntries: MatchupEntry[]
}

const BUILDER_STEPS: MatchupGuideDraftStep[] = ['champion', 'rune', 'item', 'info']

export function canOpenMatchupsGuideStep(context: MatchupGuideStepAccessContext): boolean {
  return context.buildValid && context.hasChampion
}

export function canOpenWriteGuideStep(context: MatchupGuideStepAccessContext): boolean {
  return (
    canOpenMatchupsGuideStep(context) &&
    context.matchupCount >= MATCHUP_GUIDE_MIN_OPPONENTS_FOR_WRITE
  )
}

export function canOpenFinalizeGuideStep(context: MatchupGuideStepAccessContext): boolean {
  return canOpenWriteGuideStep(context) && areAllMatchupsFinalizeReady(context.matchupEntries)
}

export type MatchupGuideFinalizeIdentityField = 'guideName' | 'author' | 'shortDescription'

export function getMissingFinalizeIdentityFields(options: {
  guideName?: string
  author?: string
  shortDescription?: string
}): MatchupGuideFinalizeIdentityField[] {
  const missing: MatchupGuideFinalizeIdentityField[] = []
  if (!options.guideName?.trim()) missing.push('guideName')
  if (!options.author?.trim()) missing.push('author')
  if (!options.shortDescription?.trim()) missing.push('shortDescription')
  return missing
}

export function isMatchupGuideFinalizeIdentityReady(options: {
  guideName?: string
  author?: string
  shortDescription?: string
}): boolean {
  return getMissingFinalizeIdentityFields(options).length === 0
}

export function canSaveMatchupGuide(
  context: MatchupGuideStepAccessContext & {
    guideName?: string
    author?: string
    shortDescription?: string
  }
): boolean {
  return (
    canOpenFinalizeGuideStep(context) &&
    context.hasChampion &&
    isMatchupGuideFinalizeIdentityReady(context)
  )
}

export function canNavigateToMatchupGuideStep(
  step: MatchupGuideDraftStep,
  context: MatchupGuideStepAccessContext
): boolean {
  if (BUILDER_STEPS.includes(step)) {
    if (step === 'info' && !context.hasChampion) return false
    return true
  }

  if (step === 'matchups') return canOpenMatchupsGuideStep(context)
  if (step === 'write') return canOpenWriteGuideStep(context)
  if (step === 'finalize') return canOpenFinalizeGuideStep(context)

  return false
}

export function navigateMatchupGuideCreateStepPath(
  direction: -1 | 1,
  context: MatchupGuideStepAccessContext & { currentStep: MatchupGuideDraftStep }
): MatchupGuideDraftStep | null {
  const currentIndex = MATCHUP_GUIDE_STEP_ORDER.indexOf(context.currentStep)
  if (currentIndex < 0) return null

  const nextIndex = currentIndex + direction
  if (nextIndex < 0 || nextIndex >= MATCHUP_GUIDE_STEP_ORDER.length) return null

  const nextStep = MATCHUP_GUIDE_STEP_ORDER[nextIndex]
  if (!canNavigateToMatchupGuideStep(nextStep, context)) return null
  return nextStep
}

export function buildMatchupGuideStepAccessContext(input: {
  buildValid: boolean
  hasChampion: boolean
  matchupEntries: MatchupEntry[]
}): MatchupGuideStepAccessContext {
  return {
    buildValid: input.buildValid,
    hasChampion: input.hasChampion,
    matchupCount: input.matchupEntries.length,
    matchupEntries: input.matchupEntries,
  }
}
