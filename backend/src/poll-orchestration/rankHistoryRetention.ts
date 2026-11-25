/**
 * Rétention des données brutes : player_rank_history et matchs (participants, teams en cascade),
 * on ne garde que les N derniers jours (15 par défaut), jour du balayage compris.
 * Les agrégats ne sont pas touchés.
 */
import { sql } from '../db/client.js';
import { sweepDay } from './leagueSweep.js';

export const DEFAULT_RETENTION_DAYS = 15;

export function retentionDays(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_RETENTION_DAYS;
}

/** Première date gardée : today − (keepDays − 1). Les lignes avant sont supprimées. */
export function rankHistoryCutoffDate(today: string, keepDays: number): string {
  const d = new Date(`${today}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (keepDays - 1));
  return d.toISOString().slice(0, 10);
}

export interface RankHistoryRetentionDeps {
  today(): string;
  deleteBefore(cutoff: string): Promise<number>;
}

export async function purgeRankHistory(deps: RankHistoryRetentionDeps, keepDays: number): Promise<number> {
  return deps.deleteBefore(rankHistoryCutoffDate(deps.today(), keepDays));
}

export interface MatchRetentionDeps {
  today(): string;
  /** Supprime au plus `limit` matchs joués avant `cutoff` ; nombre supprimé. */
  deleteBatch(cutoff: string, limit: number): Promise<number>;
}

/** Par lots pour ne pas verrouiller longtemps participants/teams ; s'arrête au premier lot incomplet. */
export async function purgeMatches(deps: MatchRetentionDeps, keepDays: number, batchSize: number): Promise<number> {
  const cutoff = rankHistoryCutoffDate(deps.today(), keepDays);
  let total = 0;
  for (;;) {
    const deleted = await deps.deleteBatch(cutoff, batchSize);
    total += deleted;
    if (deleted < batchSize) return total;
  }
}

/** poll_targets : seules les cibles du jour du balayage servent, les jours d'avant sont supprimés. */
export async function purgePollTargets(deps: RankHistoryRetentionDeps): Promise<number> {
  return deps.deleteBefore(deps.today());
}

const MATCH_PURGE_BATCH = 500;

/** Purge l'historique de rangs et les matchs (N jours) et les vieilles cibles de poll ; total supprimé. */
export function createRankHistoryPurge(keepDays: number): () => Promise<number> {
  const today = () => sweepDay(new Date());
  return async () => {
    const ranks = await purgeRankHistory(
      {
        today,
        deleteBefore: async (cutoff) => {
          const result = await sql`DELETE FROM player_rank_history WHERE date < ${cutoff}::date`;
          return result.count;
        },
      },
      keepDays,
    );
    const targets = await purgePollTargets({
      today,
      deleteBefore: async (cutoff) => {
        const result = await sql`DELETE FROM poll_targets WHERE day < ${cutoff}::date`;
        return result.count;
      },
    });
    const matches = await purgeMatches(
      {
        today,
        deleteBatch: async (cutoff, limit) => {
          const result = await sql`
            DELETE FROM matchs WHERE riot_match_id IN (
              SELECT riot_match_id FROM matchs WHERE game_date < ${cutoff}::date LIMIT ${limit}
            )
          `;
          return result.count;
        },
      },
      keepDays,
      MATCH_PURGE_BATCH,
    );
    return ranks + targets + matches;
  };
}
