/**
 * Purge `processed_matches` et `player_rank_history` plus vieux que
 * release(patch courant) − POLLER_PATCH_RETENTION_DAYS (si activé).
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
  deletedProcessedMatches: number;
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

export async function purgeStaleProcessedMatchesAndRankHistory(): Promise<PatchRetentionPurgeResult> {
  const { cutoffDate, retentionDays, skipReason } = await resolvePatchRetentionCutoffDateIso();
  if (!cutoffDate) {
    return {
      cutoffDate: null,
      retentionDays,
      deletedProcessedMatches: 0,
      deletedRankHistory: 0,
      skipped: true,
      skipReason,
    };
  }

  const [processedResult, rankResult] = await sql.begin(async (tx) => {
    const processed = await tx`
      DELETE FROM processed_matches
      WHERE game_date < ${cutoffDate}::date
    `;
    const rank = await tx`
      DELETE FROM player_rank_history
      WHERE date < ${cutoffDate}::date
    `;
    return [processed, rank] as const;
  });

  return {
    cutoffDate,
    retentionDays,
    deletedProcessedMatches: processedResult.count,
    deletedRankHistory: rankResult.count,
    skipped: false,
  };
}
