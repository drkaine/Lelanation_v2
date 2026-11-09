/**
 * Plan de récupération des uploads d'une chaîne YouTube.
 * Tant que la chaîne n'a pas été listée jusqu'au bout (`backfillComplete`),
 * on relit toute la playlist : les anciens fichiers plafonnés à 500 vidéos
 * récupèrent ainsi les vidéos plus anciennes.
 */
export type UploadsFetchPlan = { mode: 'full' | 'incremental'; maxVideos: number }

type Env = Record<string, string | undefined>

export function planUploadsFetch(
  existing: { videoCount: number; backfillComplete?: boolean },
  env: Env = process.env
): UploadsFetchPlan {
  if (existing.videoCount > 0 && existing.backfillComplete === true) {
    return { mode: 'incremental', maxVideos: Number(env.YOUTUBE_INCREMENTAL_MAX_VIDEOS || '200') }
  }
  return { mode: 'full', maxVideos: Number(env.YOUTUBE_FULL_LIST_MAX_VIDEOS || '5000') }
}

export function isBackfillComplete(plan: UploadsFetchPlan, fetchedCount: number): boolean {
  return plan.mode === 'incremental' || fetchedCount < plan.maxVideos
}
