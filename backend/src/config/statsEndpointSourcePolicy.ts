/** `mv_only` is a legacy label: handlers read `agg_*` ∪ `archive_agg_*` via `matchVersionedAggFrom`, not materialized views. */
export type StatsDataSourcePolicy = 'mv_only' | 'snapshot_only' | 'mv_or_snapshot'

export interface StatsEndpointSourceRule {
  path: string
  policy: StatsDataSourcePolicy
  allowedSources: string[]
}

/**
 * Contract for stats HTTP handlers: UI reads go through `matchVersionedAggFrom` /
 * `sqlAggUnionAllLiveAndArchives`. When both `archive_agg_*` and live `agg_*` exist,
 * single-patch reads prefer **archive only** (no UNION live) to avoid duplicated rows;
 * live is still used if the archive table is missing. `agg_match_outcome_stats` keeps a
 * deduped archive∪live union. Logical names below are the archive physical tables.
 */
export const STATS_ENDPOINT_SOURCE_POLICY: StatsEndpointSourceRule[] = [
  {
    path: '/overview',
    policy: 'mv_only',
    allowedSources: [
      'archive_agg_champion_core_stats',
      'archive_agg_match_outcome_stats',
      'archive_agg_champion_bans_by_banner',
    ],
  },
  {
    path: '/overview-detail',
    policy: 'mv_only',
    allowedSources: [
      'archive_agg_champion_core_stats',
      'archive_agg_champion_runes_solo_stats',
      'archive_agg_champion_runes_stats',
      'archive_agg_champion_item_solo_stats',
      'archive_agg_champion_item_stats',
      'archive_agg_champion_summoner_spells',
      'archive_agg_champion_shard_solo_stats',
      'archive_agg_champion_summoner_spell_pair_stats',
      'archive_agg_champion_item_starter_set_stats',
    ],
  },
  {
    path: '/overview-duration-winrate',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_core_stats', 'archive_agg_champion_bucket'],
  },
  {
    path: '/overview-abandons',
    policy: 'mv_only',
    allowedSources: ['archive_agg_match_outcome_stats'],
  },
  {
    path: '/overview-teams',
    policy: 'mv_only',
    allowedSources: [
      'archive_agg_team_core_stats',
      'archive_agg_team_bucket',
      'archive_agg_champion_bans_by_banner',
    ],
  },
  {
    path: '/overview-sides',
    policy: 'mv_only',
    allowedSources: [
      'archive_agg_team_core_stats',
      'archive_agg_team_bucket',
      'archive_agg_champion_side_stats',
      'archive_agg_champion_bans_by_banner',
    ],
  },
  {
    path: '/overview-sides-progression',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_side_stats', 'archive_agg_champion_bans_by_banner'],
  },
  {
    path: '/overview-progression',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_core_stats'],
  },
  {
    path: '/overview-progression-full',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_core_stats', 'archive_agg_champion_bans_by_banner'],
  },
  {
    path: '/champions',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_core_stats'],
  },
  {
    path: '/champions/global-table',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_side_stats', 'archive_agg_champion_bans_by_banner'],
  },
  {
    path: '/champions/:championId/damage-split',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_core_stats', 'archive_agg_champion_damage_stats'],
  },
  {
    path: '/champions/:championId/matchups-extended',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_core_stats', 'archive_agg_champion_vs_stats'],
  },
  {
    path: '/champions/bans-table',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_bans_by_banner', 'archive_agg_match_outcome_stats'],
  },
  {
    path: '/tier-list',
    policy: 'mv_only',
    allowedSources: ['archive_agg_champion_core_stats', 'archive_agg_champion_vs_stats', 'active_patches'],
  },
  {
    path: '/botlane-vs-botlane',
    policy: 'mv_only',
    allowedSources: ['archive_agg_botlane_duo_vs_duo_stats'],
  },
  {
    path: '/botlane-duo-tierlist',
    policy: 'mv_only',
    allowedSources: ['archive_agg_botlane_duo_vs_duo_stats'],
  },
  {
    path: '/champions/:championId/tier-trend-snapshots',
    policy: 'snapshot_only',
    allowedSources: ['champion_tier_daily_snapshots', 'champion_tier_daily_snapshots_archive'],
  },
]
