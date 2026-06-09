/**
 * Persist patch-notes change counts (nerf / buff / adjust) per entity and game version.
 * Source: scraped patch JSON (`entities[].changes[].type`).
 */

import { sql } from '../db/client.js'
import { isDatabaseConfigured } from '../db/query.js'
import { logger } from '../utils/logger.js'
import type { PatchJson } from '../scraper/types.js'
import {
  buildPatchNotesStats,
  type PatchNotesStatsRow,
} from './patchNotesStatsBuilder.js'

export type { PatchNotesStatsRow, PatchNotesTargetType } from './patchNotesStatsBuilder.js'
export { buildEntityPatchStats, buildPatchNotesStats } from './patchNotesStatsBuilder.js'

export async function upsertPatchNotesStatsRows(rows: PatchNotesStatsRow[]): Promise<number> {
  if (!rows.length) return 0
  if (!isDatabaseConfigured()) {
    logger.warn('patch_notes_stats skipped: DATABASE_URL not configured')
    return 0
  }

  let written = 0
  for (const row of rows) {
    await sql`
      INSERT INTO patch_notes_stats (
        type_cible, id_cible, game_version, count_nerf, count_up, count_ajust, updated_at
      ) VALUES (
        ${row.typeCible},
        ${row.idCible},
        ${row.gameVersion},
        ${row.countNerf},
        ${row.countUp},
        ${row.countAjust},
        NOW()
      )
      ON CONFLICT (type_cible, id_cible, game_version) DO UPDATE SET
        count_nerf = EXCLUDED.count_nerf,
        count_up = EXCLUDED.count_up,
        count_ajust = EXCLUDED.count_ajust,
        updated_at = NOW()
    `
    written++
  }
  return written
}

/** Persist stats from parsed patch JSON (called after scrape write). */
export async function persistPatchNotesStats(
  patch: PatchJson,
  options?: { locale?: string }
): Promise<{ rows: number; written: number }> {
  const locale = options?.locale ?? patch.locale
  if (locale !== 'en-GB') {
    return { rows: 0, written: 0 }
  }

  const rows = buildPatchNotesStats(patch)
  const written = await upsertPatchNotesStatsRows(rows)

  if (written > 0) {
    logger.info(
      {
        gameVersion: patch.patchVersion,
        entities: rows.length,
        written,
      },
      'patch_notes_stats upserted'
    )
  }

  return { rows: rows.length, written }
}
