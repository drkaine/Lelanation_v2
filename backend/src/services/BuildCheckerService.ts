import type {
  BuildAffectedEntry,
  BuildCheckInput,
  BuildCheckResult,
  PatchChangeType,
  PatchEntity,
  PatchNotesData,
} from '../types/patchNotes.js'
import { comparePatchVersions, normalizeSlug } from '../utils/patchVersion.js'
import { PatchNotesService } from './PatchNotesService.js'

const SCORE_START = 100
const CHAMPION_NERF = -20
const ITEM_CORE_NERF = -15
const ITEM_SITUATIONAL_NERF = -8
const RUNE_NERF = -5
const ITEM_BUFF = 3

function entityMatches(
  entity: PatchEntity,
  slug?: string,
  ddragonId?: string
): boolean {
  if (ddragonId && entity.ddragon_id === ddragonId) return true
  if (slug && entity.slug === normalizeSlug(slug)) return true
  if (slug && normalizeSlug(entity.name_en) === normalizeSlug(slug)) return true
  if (slug && normalizeSlug(entity.name_fr) === normalizeSlug(slug)) return true
  return false
}

function scoreDeltaForEntity(
  entity: PatchEntity,
  entityType: BuildAffectedEntry['entity_type'],
  itemIndex?: number
): number {
  const type = entity.global_type
  if (type === 'adjust' || type === 'rework') return 0

  if (entityType === 'champion') {
    if (type === 'nerf') return CHAMPION_NERF
    return 0
  }

  if (entityType === 'item') {
    if (type === 'buff') return ITEM_BUFF
    if (type === 'nerf') {
      const isCore = itemIndex !== undefined && itemIndex <= 2
      return isCore ? ITEM_CORE_NERF : ITEM_SITUATIONAL_NERF
    }
    return 0
  }

  if (entityType === 'rune') {
    if (type === 'nerf') return RUNE_NERF
    return 0
  }

  return 0
}

function statusFromScore(score: number): BuildCheckResult['status'] {
  if (score >= 80) return 'current'
  if (score >= 60) return 'affected'
  return 'outdated'
}

export function checkBuildAgainstPatches(
  build: BuildCheckInput,
  patches: PatchNotesData[]
): BuildCheckResult {
  let score = SCORE_START
  const affected: BuildAffectedEntry[] = []
  const patchCreated = build.patch_created

  const relevantPatches = patches.filter(
    p => comparePatchVersions(p.version, patchCreated) > 0
  )

  for (const patch of relevantPatches) {
    if (build.champion_ddragon_id || build.champion_slug) {
      const champion = patch.champions.find(c =>
        entityMatches(c, build.champion_slug, build.champion_ddragon_id)
      )
      if (champion) {
        score += scoreDeltaForEntity(champion, 'champion')
        affected.push({
          entity_type: 'champion',
          slug: champion.slug,
          name_fr: champion.name_fr,
          name_en: champion.name_en,
          ddragon_id: champion.ddragon_id,
          global_type: champion.global_type,
          patch_version: patch.version,
          changes: champion.changes,
        })
      }
    }

    for (let i = 0; i < (build.items?.length ?? 0); i++) {
      const item = build.items![i]
      const patchItem = patch.items.find(it =>
        entityMatches(it, item.slug, item.ddragon_id)
      )
      if (patchItem) {
        score += scoreDeltaForEntity(patchItem, 'item', i)
        affected.push({
          entity_type: 'item',
          slug: patchItem.slug,
          name_fr: patchItem.name_fr,
          name_en: patchItem.name_en,
          ddragon_id: patchItem.ddragon_id,
          global_type: patchItem.global_type,
          patch_version: patch.version,
          changes: patchItem.changes,
        })
      }
    }

    for (const rune of build.runes ?? []) {
      const patchRune = patch.runes.find(r =>
        entityMatches(r, rune.slug, rune.ddragon_id)
      )
      if (patchRune) {
        score += scoreDeltaForEntity(patchRune, 'rune')
        affected.push({
          entity_type: 'rune',
          slug: patchRune.slug,
          name_fr: patchRune.name_fr,
          name_en: patchRune.name_en,
          ddragon_id: patchRune.ddragon_id,
          global_type: patchRune.global_type,
          patch_version: patch.version,
          changes: patchRune.changes,
        })
      }
    }
  }

  score = Math.max(0, Math.min(100, score))

  return {
    score,
    status: statusFromScore(score),
    affected,
    patches_since: relevantPatches.length,
  }
}

export class BuildCheckerService {
  private patchNotesService: PatchNotesService
  private loadedPatches: PatchNotesData[] | null = null

  constructor(patchNotesService = new PatchNotesService()) {
    this.patchNotesService = patchNotesService
  }

  async loadPatches(): Promise<PatchNotesData[]> {
    if (!this.loadedPatches) {
      this.loadedPatches = await this.patchNotesService.loadAllPatches()
    }
    return this.loadedPatches
  }

  async checkBuild(build: BuildCheckInput): Promise<BuildCheckResult> {
    const patches = await this.loadPatches()
    return checkBuildAgainstPatches(build, patches)
  }

  invalidateCache(): void {
    this.loadedPatches = null
    this.patchNotesService.clearCache()
  }
}

export function isNerfType(type: PatchChangeType): boolean {
  return type === 'nerf'
}

export function isBuffType(type: PatchChangeType): boolean {
  return type === 'buff'
}
