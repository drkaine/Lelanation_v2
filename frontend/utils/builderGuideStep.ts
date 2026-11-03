import type { MatchupEntry, MatchupGuide, MatchupGuideMeta } from '@lelanation/shared-types'
import type { LocationQuery } from 'vue-router'
import type { Build } from '~/types/build'
import { buildMatchupGuideFromDraft } from '~/utils/matchupGuideFromBuild'
import { syncMatchupEntryLegacyFields } from '~/utils/matchupEntryUtils'
import type { MatchupGuideDraftStep } from '~/stores/MatchupGuideDraftStore'
import {
  buildMatchupGuideStepAccessContext,
  canNavigateToMatchupGuideStep,
} from '~/utils/matchupGuideCreateSteps'

/** Sous-étapes de l'étape Guide du builder (Matchups · Rédaction · Finaliser). */
export type BuilderGuideSubstep = Extract<MatchupGuideDraftStep, 'matchups' | 'write' | 'finalize'>

export const BUILDER_GUIDE_SUBSTEPS: readonly BuilderGuideSubstep[] = [
  'matchups',
  'write',
  'finalize',
]

export const BUILDER_GUIDE_BASE_PATH = '/builds/create/guide'

export function builderGuideStepPath(step: BuilderGuideSubstep): string {
  return `${BUILDER_GUIDE_BASE_PATH}/${step}`
}

export function isBuilderGuideRoute(path: string): boolean {
  return path.includes(BUILDER_GUIDE_BASE_PATH)
}

export type BuilderGuideQuery = {
  /** Guide existant à éditer (distinct de `editId`, réservé au build). */
  guideEditId: string | null
  /** Build de la bibliothèque à partir duquel créer le guide. */
  fromBuildId: string | null
  /** Build en cours d'édition. */
  editId: string | null
}

function queryString(value: LocationQuery[string] | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function readBuilderGuideQuery(query: LocationQuery): BuilderGuideQuery {
  return {
    guideEditId: queryString(query.guideEditId),
    fromBuildId: queryString(query.fromBuildId),
    editId: queryString(query.editId),
  }
}

export function builderGuideQuery(input: BuilderGuideQuery): Record<string, string> {
  const next: Record<string, string> = {}
  if (input.guideEditId) next.guideEditId = input.guideEditId
  if (input.fromBuildId) next.fromBuildId = input.fromBuildId
  if (input.editId) next.editId = input.editId
  return next
}

function isBuilderGuideSubstep(step: string): step is BuilderGuideSubstep {
  const steps: readonly string[] = BUILDER_GUIDE_SUBSTEPS
  return steps.includes(step)
}

/**
 * Sous-étape où reprendre : la dernière visitée si elle est ouverte, sinon la plus avancée ouverte.
 * `null` : l'étape Guide est fermée (build pas encore valide).
 */
export function resolveBuilderGuideSubstep(
  lastStep: MatchupGuideDraftStep,
  input: { buildValid: boolean; hasChampion: boolean; matchupEntries: MatchupEntry[] }
): BuilderGuideSubstep | null {
  const context = buildMatchupGuideStepAccessContext(input)
  if (isBuilderGuideSubstep(lastStep) && canNavigateToMatchupGuideStep(lastStep, context)) {
    return lastStep
  }
  if (!canNavigateToMatchupGuideStep('matchups', context)) return null
  return 'matchups'
}

/** Où renvoyer quand la sous-étape demandée est fermée ; `null` si elle est ouverte. */
export function builderGuideRedirectPath(
  step: BuilderGuideSubstep,
  input: { buildValid: boolean; hasChampion: boolean; matchupEntries: MatchupEntry[] }
): string | null {
  const context = buildMatchupGuideStepAccessContext(input)
  if (canNavigateToMatchupGuideStep(step, context)) return null
  const index = BUILDER_GUIDE_SUBSTEPS.indexOf(step)
  for (let i = index - 1; i >= 0; i--) {
    const previous = BUILDER_GUIDE_SUBSTEPS[i]!
    if (canNavigateToMatchupGuideStep(previous, context)) return builderGuideStepPath(previous)
  }
  return '/builds/create/info'
}

/**
 * Guide à enregistrer avec le build (bouton Sauvegarder du builder).
 * `null` : aucun matchup dans le brouillon, ou brouillon d'un autre champion.
 */
export function guideToSaveWithBuild(
  build: Build,
  draft: {
    guideId: string
    guideChampionId: string | null
    matchupEntries: MatchupEntry[]
    meta: MatchupGuideMeta
  }
): MatchupGuide | null {
  if (!build.champion || !draft.guideId || draft.matchupEntries.length === 0) return null
  if (draft.guideChampionId && draft.guideChampionId !== build.champion.id) return null
  const matchups = draft.matchupEntries.map(entry => syncMatchupEntryLegacyFields({ ...entry }))
  return buildMatchupGuideFromDraft(build, matchups, draft.guideId, draft.meta)
}

/** Guide lié au build qu'on rouvre : celui de la copie d'équipe, sinon un guide local du même build. */
export function linkedGuideForBuild(
  buildId: string,
  sharedGuide: MatchupGuide | null | undefined,
  savedGuides: MatchupGuide[]
): MatchupGuide | null {
  if (sharedGuide && typeof sharedGuide === 'object' && sharedGuide.id) return sharedGuide
  return savedGuides.find(guide => guide.buildId === buildId) ?? null
}
