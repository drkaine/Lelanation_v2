/**
 * Purge optionnelle de `player_rank_history` (désactivée dans le poller — pas de purge automatique).
 * Déclencher manuellement via `backend/scripts/purge-patch-retention.ts` si besoin.
 *
 * Env `POLLER_PATCH_RETENTION_DAYS` : absent / `false` / `0` = pas de purge.
 */
import { sql } from "../db/client.js";
import {
  getPollerPatchRetentionConfig,
  loadCurrentGameVersion,
  patchRetentionCutoffDateIso,
} from "./RiotConfigService.js";

export type PatchRetentionPurgeResult = {
  cutoffDate: string | null;
  retentionDays: number;
  deletedRankHistory: number;
  skipped: boolean;
  skipReason?: string;
};

export async function resolvePatchRetentionCutoffDateIso(): Promise<{
  cutoffDate: string | null;
  retentionDays: number;
  skipReason?: string;
}> {
  const retentionConfig = getPollerPatchRetentionConfig();
  if (!retentionConfig.enabled) {
    return { cutoffDate: null, retentionDays: 0, skipReason: "retention_disabled" };
  }
  const retentionDays = retentionConfig.days;
  const currentRes = await loadCurrentGameVersion();
  if (currentRes.isErr()) {
    return { cutoffDate: null, retentionDays, skipReason: "version_load_failed" };
  }
  const current = currentRes.unwrap();
  const releaseDate = String(current?.releaseDate ?? "").trim();
  if (!releaseDate) {
    return { cutoffDate: null, retentionDays, skipReason: "missing_release_date" };
  }
  const cutoffDate = patchRetentionCutoffDateIso(releaseDate, retentionDays);
  if (!cutoffDate) {
    return { cutoffDate: null, retentionDays, skipReason: "invalid_release_date" };
  }
  return { cutoffDate, retentionDays };
}

export async function purgeStaleRankHistory(): Promise<PatchRetentionPurgeResult> {
  const { cutoffDate, retentionDays, skipReason } = await resolvePatchRetentionCutoffDateIso();
  if (!cutoffDate) {
    return {
      cutoffDate: null,
      retentionDays,
      deletedRankHistory: 0,
      skipped: true,
      skipReason,
    };
  }

  const rankResult = await sql`
    DELETE FROM player_rank_history
    WHERE date < ${cutoffDate}::date
  `;

  return {
    cutoffDate,
    retentionDays,
    deletedRankHistory: rankResult.count,
    skipped: false,
  };
}

/** @deprecated Utiliser `purgeStaleRankHistory`. */
export const purgeStaleProcessedMatchesAndRankHistory = purgeStaleRankHistory;
