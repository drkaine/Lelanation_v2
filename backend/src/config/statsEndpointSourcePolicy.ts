export type StatsDataSourcePolicy = 'mv_only' | 'snapshot_only' | 'mv_or_snapshot'

export interface StatsEndpointSourceRule {
  path: string
  policy: StatsDataSourcePolicy
  allowedSources: string[]
}

/**
 * Contract used by the stats runtime: endpoints consumed by statistics page must
 * read only materialized views and/or champion tier daily snapshots.
 */
export const STATS_ENDPOINT_SOURCE_POLICY: StatsEndpointSourceRule[] = [
  {
    path: '/overview',
    policy: 'mv_only',
    allowedSources: ['agg_champion_core_stats', 'agg_match_outcome_stats', 'agg_champion_bans_by_banner'],
  },
  {
    path: '/overview-detail',
    policy: 'mv_only',
    allowedSources: [
      'mv_champion_core_stats',
      'mv_champion_runes_solo_stats',
      'mv_champion_runes_stats',
      'mv_champion_item_solo_stats',
      'mv_champion_item_stats',
      'mv_champion_summoner_spells',
      'mv_champion_shard_solo_stats',
      'mv_champion_summoner_spell_pair_stats',
      'mv_champion_item_starter_set_stats',
    ],
  },
  {
    path: '/overview-duration-winrate',
    policy: 'mv_only',
    allowedSources: ['mv_champion_core_stats', 'mv_champion_bucket'],
  },
  {
    path: '/overview-abandons',
    policy: 'mv_only',
    allowedSources: ['agg_match_outcome_stats'],
  },
  {
    path: '/overview-teams',
    policy: 'mv_only',
    allowedSources: ['agg_team_core_stats', 'agg_team_bucket', 'agg_champion_bans_by_banner'],
  },
  {
    path: '/overview-sides',
    policy: 'mv_only',
    allowedSources: ['agg_team_core_stats', 'agg_team_bucket', 'agg_champion_side_stats', 'agg_champion_bans_by_banner'],
  },
  {
    path: '/overview-sides-progression',
    policy: 'mv_only',
    allowedSources: ['agg_champion_side_stats', 'agg_champion_bans_by_banner'],
  },
  {
    path: '/overview-progression',
    policy: 'mv_only',
    allowedSources: ['agg_champion_core_stats'],
  },
  {
    path: '/overview-progression-full',
    policy: 'mv_only',
    allowedSources: ['agg_champion_core_stats', 'agg_champion_bans_by_banner'],
  },
  {
    path: '/champions',
    policy: 'mv_only',
    allowedSources: ['agg_champion_core_stats'],
  },
  {
    path: '/champions/global-table',
    policy: 'mv_only',
    allowedSources: ['agg_champion_side_stats', 'agg_champion_bans_by_banner'],
  },
  {
    path: '/champions/bans-table',
    policy: 'mv_only',
    allowedSources: ['agg_champion_bans_by_banner', 'agg_match_outcome_stats'],
  },
  {
    path: '/tier-list',
    policy: 'mv_only',
    allowedSources: ['agg_champion_core_stats', 'agg_champion_vs_stats', 'active_patches'],
  },
  {
    path: '/champions/:championId/tier-trend-snapshots',
    policy: 'snapshot_only',
    allowedSources: ['champion_tier_daily_snapshots', 'champion_tier_daily_snapshots_archive'],
  },
]
