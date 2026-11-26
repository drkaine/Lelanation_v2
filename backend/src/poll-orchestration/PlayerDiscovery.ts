import { sql } from '../db/client.js';
import { timedDbOp } from '../observability/poller-metrics/timedDbOp.js';
import type { DiscoveryPlayer, LastSeenStats } from './types.js';
import { orchestrationLogger } from './logger.js';
import { POLLER_PLATFORMS, toDbRegions } from '../poller/utils/pollerScope.js';
import type { Platform } from '../poller/types.js';
import { selectDuoSafeBatch } from './duoRules.js';
import { pollDelayDays } from './pollYield.js';
import { sweepDay } from './leagueSweep.js';
import { defaultTierWeights } from '../poller/pollerSettings.js';

interface DiscoveryRow {
  puuid: string;
  region: string;
  partners: string[] | null;
  last_polled_at: Date | null;
}

/** Partenaires de duo de `p` (player_duos stocke la paire triée). */
function partnersColumn() {
  return sql`ARRAY(
    SELECT CASE WHEN d.puuid_a = p.puuid THEN d.puuid_b ELSE d.puuid_a END
    FROM player_duos d WHERE d.puuid_a = p.puuid OR d.puuid_b = p.puuid
  )`;
}

/** Exclut `p` si un de ses partenaires de duo a déjà été pollé aujourd'hui. */
function duoPolledTodayFilter() {
  return sql`NOT EXISTS (
    SELECT 1 FROM player_duos d
    JOIN players q ON q.puuid = d.puuid_b
    WHERE d.puuid_a = p.puuid AND q.last_polled_at >= CURRENT_DATE
  ) AND NOT EXISTS (
    SELECT 1 FROM player_duos d
    JOIN players q ON q.puuid = d.puuid_a
    WHERE d.puuid_b = p.puuid AND q.last_polled_at >= CURRENT_DATE
  )`;
}

export class PlayerDiscovery {
  /** Joueurs retenus aujourd'hui : leurs partenaires de duo attendent demain. */
  private queuedToday = new Set<string>();
  private queuedDay = '';
  /** En file mais pas encore pollés : last_polled_at pas encore écrit, exclus des lots suivants. */
  private pending = new Set<string>();
  /** Plateformes sans cible du jour restante : le balayage peut être rallongé (voir extendSweep). */
  private exhausted = new Set<Platform>();

  /** `activePlatforms` : plateformes hors balayage des rangs (défaut : toutes) ; `today` : jour du balayage. */
  constructor(
    private readonly activePlatforms: () => readonly Platform[] = () => POLLER_PLATFORMS,
    private readonly today: () => string = () => sweepDay(new Date()),
    /** Part des joueurs par tier (%) pour une plateforme ; tour divisé par le poids, tier à 0 ignoré. */
    private readonly tierWeights: (platform: Platform) => Readonly<Record<string, number>> = defaultTierWeights,
  ) {}

  async fetchNextBatch(limit: number): Promise<DiscoveryPlayer[]> {
    const safeLimit = Math.max(1, limit);
    const active = this.activePlatforms();
    if (active.length === 0) return [];
    const regions = sql.array(toDbRegions([...active]));

    const day = this.today();
    if (day !== this.queuedDay) {
      this.queuedDay = day;
      this.queuedToday = new Set();
      this.pending = new Set();
      this.exhausted = new Set();
    }
    // Cibles du balayage du jour pas encore pollées, tour à tour sur les tiers, au prorata des poids.
    const weights = active.flatMap((platform) => {
      const [region = ''] = toDbRegions([platform]);
      return Object.entries(this.tierWeights(platform)).map(([tier, w]) => ({ region, tier, w }));
    });
    const weightRegions = sql.array(weights.map((x) => x.region));
    const weightTiers = sql.array(weights.map((x) => x.tier));
    const weightValues = sql.array(weights.map((x) => x.w));
    const targets = await timedDbOp('player_discovery_fetch', () =>
      sql<DiscoveryRow[]>`
        SELECT puuid, region, partners, last_polled_at FROM (
          SELECT p.puuid, p.region, p.last_polled_at, ${partnersColumn()} AS partners,
                 ROW_NUMBER() OVER (PARTITION BY t.region, t.rank_tier ORDER BY t.puuid) / w.weight AS turn
          FROM poll_targets t
          JOIN players p ON p.puuid = t.puuid
          JOIN unnest(${weightRegions}::text[], ${weightTiers}::text[], ${weightValues}::float8[]) AS w(region, tier, weight)
            ON w.region = t.region::text AND w.tier = t.rank_tier::text AND w.weight > 0
          WHERE t.day = ${day}::date
            AND t.region::text = ANY(${regions}::text[])
            AND (p.last_polled_at IS NULL OR p.last_polled_at < ${day}::date)
            AND ${duoPolledTodayFilter()}
            AND NOT (p.puuid = ANY(${sql.array([...this.pending])}::text[]))
        ) c
        ORDER BY turn, region
        LIMIT ${safeLimit * 2}
      `,
    );

    // Requête non pleine : une plateforme absente n'a plus de cible aujourd'hui.
    const queryLimit = safeLimit * 2;
    for (const platform of active) {
      const present = targets.some((r) => String(r.region).toUpperCase() === platform.toUpperCase());
      if (present) this.exhausted.delete(platform);
      else if (targets.length < queryLimit) this.exhausted.add(platform);
    }

    const rows = this.select(targets, safeLimit);
    // Sécu : jamais sans poll. Plateformes épuisées → joueurs les moins récemment pollés.
    const dry = active.filter((p) => this.exhausted.has(p));
    if (rows.length < safeLimit && dry.length > 0) {
      const missing = safeLimit - rows.length;
      const fallback = await timedDbOp('player_discovery_fallback', () =>
        sql<DiscoveryRow[]>`
          SELECT p.puuid, p.region, p.last_polled_at, ${partnersColumn()} AS partners
          FROM players p
          WHERE p.region::text = ANY(${sql.array(toDbRegions(dry))}::text[])
            AND (p.last_polled_at IS NULL OR p.last_polled_at < ${day}::date)
            AND ${duoPolledTodayFilter()}
            AND NOT (p.puuid = ANY(${sql.array([...this.pending])}::text[]))
          ORDER BY p.last_seen ASC NULLS FIRST
          LIMIT ${missing}
        `,
      );
      rows.push(...this.select(fallback, missing));
    }

    orchestrationLogger.debug(
      {
        component: 'PlayerDiscovery',
        count: rows.length,
        limit: safeLimit,
      },
      'discovery batch fetched',
    );

    if (rows.length === 0) {
      orchestrationLogger.warn({ component: 'PlayerDiscovery' }, 'discovery batch empty — no eligible players');
    }

    return rows.map((row) => ({
      puuid: row.puuid,
      region: String(row.region ?? '').trim().toLowerCase(),
      lastPolledAt: row.last_polled_at ?? null,
    }));
  }

  /** Duo-safe, puis marqués en file (jour et en attente de poll). */
  private select(candidates: DiscoveryRow[], limit: number) {
    const rows = selectDuoSafeBatch(
      candidates.map((r) => ({ ...r, partners: r.partners ?? [] })),
      limit,
      this.queuedToday,
    );
    for (const r of rows) {
      this.queuedToday.add(r.puuid);
      this.pending.add(r.puuid);
    }
    return rows;
  }

  exhaustedPlatforms(): Platform[] {
    return [...this.exhausted];
  }

  /** Balayage rallongé : nouvelles cibles attendues. */
  clearExhausted(platform: Platform): void {
    this.exhausted.delete(platform);
  }

  async getOldestLastSeenStats(): Promise<LastSeenStats> {
    const rows = await timedDbOp('get_oldest_last_seen', () =>
      sql<Array<{ oldest_last_seen: Date | string | null; never_seen_count: number | string }>>`
        SELECT
          MIN(last_seen) AS oldest_last_seen,
          COUNT(*) FILTER (WHERE last_seen IS NULL)::int AS never_seen_count
        FROM players
        WHERE region IS NOT NULL
      `,
    );

    const row = rows[0];
    const raw = row?.oldest_last_seen;
    return {
      oldestLastSeen: raw != null ? new Date(raw) : null,
      neverSeenCount: Number(row?.never_seen_count ?? 0),
    };
  }

  /** Fin de poll ; avec le rythme observé, fixe la date du prochain poll (priorité par rendement). */
  async updateLastSeen(puuid: string, gamesPerDay?: number): Promise<void> {
    this.pending.delete(puuid);
    await timedDbOp('update_last_seen', () =>
      gamesPerDay === undefined
        ? sql`
            UPDATE players
            SET last_seen = NOW(), last_polled_at = NOW(), updated_at = NOW()
            WHERE puuid = ${puuid}
          `
        : sql`
            UPDATE players
            SET last_seen = NOW(), last_polled_at = NOW(), updated_at = NOW(),
                games_per_day = ${gamesPerDay},
                next_poll_at = NOW() + ${pollDelayDays(gamesPerDay)} * interval '1 day'
            WHERE puuid = ${puuid}
          `,
    );
    orchestrationLogger.info({ component: 'PlayerDiscovery', puuid }, 'player last_seen updated');
  }
}
