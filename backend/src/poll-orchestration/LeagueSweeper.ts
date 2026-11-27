import { sql } from '../db/client.js';
import { fetchApexLeague, fetchLeagueEntriesPage } from '../poller/gatewayRoutes.js';
import type { Platform } from '../poller/types.js';
import { toDbRegions } from '../poller/utils/pollerScope.js';
import {
  APEX_TIER,
  type ApexLeague,
  type RankRow,
  type SweepState,
  apexTargets,
  extendSweep,
  parseSweepState,
  planSweep,
  previousSweepDay,
  pushPolledHistory,
  recordSweep,
  sizedPagesPerDivision,
  sweepDay,
  sweepDayStart,
  tierQuota,
  toRankRows,
} from './leagueSweep.js';

export interface LeagueSweeperDeps {
  today(): string;
  loadState(): Promise<unknown>;
  saveState(state: SweepState): Promise<void>;
  /** Pages lues par division et par jour (quota de cibles par tier). */
  pagesPerDivision: number;
  /** Plafond des pages dimensionnées. */
  maxPagesPerDivision?: number;
  /** Joueurs pollés entre le début de `day` et celui de `nextDay` ; absent = pas de dimensionnement. */
  countPolled?(day: string, nextDay: string): Promise<number>;
  /** Stocke les rangs ; `targets` (sous-ensemble) devient les cibles de poll du jour. */
  storeRanks(rows: RankRow[], day: string, targets: RankRow[]): Promise<StoreRanksResult>;
  fetchApex(league: ApexLeague): Promise<{ tier?: string; entries?: ReadonlyArray<Record<string, unknown>> }>;
  fetchPage(tier: string, division: string, page: number): Promise<ReadonlyArray<Record<string, unknown>>>;
}

export interface StoreRanksResult {
  stored: number;
  newPlayers: number;
}

export interface SweepTickResult {
  kind: 'apex' | 'page' | 'idle';
  entries: number;
  stored: number;
  newPlayers: number;
}

/** Une requête league par tick ; l'état n'avance qu'après un stockage réussi. */
export class LeagueSweeper {
  constructor(private readonly deps: LeagueSweeperDeps) {}

  async tick(): Promise<SweepTickResult> {
    const today = this.deps.today();
    const loaded = parseSweepState(await this.deps.loadState(), today);
    const planned = planSweep(await this.sized(loaded, today), today);
    const { step, state } = planned;
    const pages = state.pages ?? this.deps.pagesPerDivision;
    if (step.kind === 'idle') {
      if (state.done && !loaded.done) await this.deps.saveState(state);
      return { kind: 'idle', entries: 0, stored: 0, newPlayers: 0 };
    }

    let entries: ReadonlyArray<Record<string, unknown>>;
    let fallbackTier: string | undefined;
    if (step.kind === 'apex') {
      const league = await this.deps.fetchApex(step.league);
      entries = league.entries ?? [];
      fallbackTier = league.tier ?? APEX_TIER[step.league];
    } else {
      entries = await this.deps.fetchPage(step.tier, step.division, step.page);
    }

    const rows = toRankRows(entries, fallbackTier);
    const targets = step.kind === 'apex' ? apexTargets(rows, tierQuota(pages), today) : rows;
    const { stored, newPlayers } =
      rows.length > 0 ? await this.deps.storeRanks(rows, today, targets) : { stored: 0, newPlayers: 0 };
    const next = recordSweep(state, step, entries.length, pages);
    await this.deps.saveState(
      step.kind === 'apex' ? { ...next, apexTargets: next.apexTargets + targets.length } : next,
    );
    return { kind: step.kind, entries: entries.length, stored, newPlayers };
  }

  /** Premier tick d'un nouveau jour : pollés de la veille ajoutés à l'historique, pages du jour recalculées. */
  private async sized(state: SweepState, today: string): Promise<SweepState> {
    if (state.day === today || !this.deps.countPolled) return state;
    const yesterday = previousSweepDay(today);
    const polledHistory = pushPolledHistory(state.polledHistory, await this.deps.countPolled(yesterday, today));
    const max = this.deps.maxPagesPerDivision ?? this.deps.pagesPerDivision;
    return { ...state, polledHistory, pages: sizedPagesPerDivision(polledHistory, this.deps.pagesPerDivision, max, state.apexTargets) };
  }

  /** Cibles du jour épuisées : relance un tour de pages si permis (voir extendSweep). */
  async extend(maxRounds: number): Promise<boolean> {
    const today = this.deps.today();
    const { state } = planSweep(parseSweepState(await this.deps.loadState(), today), today);
    const next = extendSweep(state, maxRounds);
    if (!next) return false;
    await this.deps.saveState(next);
    return true;
  }
}

/**
 * Rangs du jour du balayage dans player_rank_history, joueurs inconnus ajoutés à players, cibles du jour
 * dans poll_targets. Les trois écritures dans une transaction.
 */
async function storeRanks(rows: RankRow[], day: string, targets: RankRow[], platform: Platform): Promise<StoreRanksResult> {
  const [region] = toDbRegions([platform]);
  const puuids = rows.map((r) => r.puuid);
  return sql.begin(async (tx) => {
    const added = await tx<{ puuid: string }[]>`
      INSERT INTO players (puuid, region)
      SELECT puuid, ${region}::lol_region FROM unnest(${puuids}::text[]) AS t(puuid)
      ON CONFLICT (puuid) DO NOTHING
      RETURNING puuid
    `;
    const inserted = await tx<{ puuid: string }[]>`
      INSERT INTO player_rank_history (puuid, date, region, rank_tier, rank_division, rank_lp)
      SELECT r.puuid, ${day}::date, ${region}::lol_region, r.tier::lol_rank_tier, r.division, r.lp
      FROM unnest(
        ${puuids}::text[],
        ${rows.map((r) => r.tier)}::text[],
        ${rows.map((r) => r.division)}::text[],
        ${rows.map((r) => r.lp)}::int[]
      ) AS r(puuid, tier, division, lp)
      ON CONFLICT (puuid, date, region) DO UPDATE SET
        rank_tier = EXCLUDED.rank_tier,
        rank_division = EXCLUDED.rank_division,
        rank_lp = EXCLUDED.rank_lp
      RETURNING puuid
    `;
    if (targets.length > 0) {
      await tx`
        INSERT INTO poll_targets (day, region, puuid, rank_tier)
        SELECT ${day}::date, ${region}::lol_region, t.puuid, t.tier::lol_rank_tier
        FROM unnest(${targets.map((t) => t.puuid)}::text[], ${targets.map((t) => t.tier)}::text[]) AS t(puuid, tier)
        ON CONFLICT (day, region, puuid) DO NOTHING
      `;
    }
    return { stored: inserted.length, newPlayers: added.length };
  });
}

/** État de chaque plateforme sous sa clé dans la ligne unique de league_sweep_state. */
export function createLeagueSweeper(
  platform: Platform,
  pagesPerDivision: number,
  maxPagesPerDivision?: number,
): LeagueSweeper {
  const [region] = toDbRegions([platform]);
  return new LeagueSweeper({
    pagesPerDivision,
    maxPagesPerDivision,
    countPolled:
      maxPagesPerDivision === undefined
        ? undefined
        : async (day, nextDay) => {
            const [row] = await sql<{ n: number }[]>`
              SELECT COUNT(*)::int AS n FROM players
              WHERE region = ${region}::lol_region
                AND last_polled_at >= ${sweepDayStart(day)} AND last_polled_at < ${sweepDayStart(nextDay)}
            `;
            return row?.n ?? 0;
          },
    today: () => sweepDay(new Date()),
    loadState: async () => {
      const [row] = await sql<{ state: unknown }[]>`SELECT state -> ${platform} AS state FROM league_sweep_state WHERE id = 1`;
      return row?.state ?? null;
    },
    saveState: async (state) => {
      const entry = sql.json({ [platform]: { ...state } });
      await sql`
        INSERT INTO league_sweep_state (id, state, updated_at) VALUES (1, ${entry}, NOW())
        ON CONFLICT (id) DO UPDATE SET
          state = CASE WHEN jsonb_typeof(league_sweep_state.state) = 'object'
                       THEN league_sweep_state.state ELSE '{}'::jsonb END || EXCLUDED.state,
          updated_at = NOW()
      `;
    },
    storeRanks: (rows, day, targets) => storeRanks(rows, day, targets, platform),
    fetchApex: (league) => fetchApexLeague(league, platform),
    fetchPage: (tier, division, page) => fetchLeagueEntriesPage(tier, division, page, platform),
  });
}
