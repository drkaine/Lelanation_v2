/** Stats handlers read partitioned tables in `lelanation_statistiques` via `matchVersionedAggFrom`. */
export type StatsDataSourcePolicy = 'mv_only' | 'snapshot_only' | 'mv_or_snapshot'

export interface StatsEndpointSourceRule {
  path: string
  policy: StatsDataSourcePolicy
  allowedSources: string[]
}

export const STATS_ENDPOINT_SOURCE_POLICY: StatsEndpointSourceRule[] = [
  {
    path: '/overview',
    policy: 'mv_only',
    allowedSources: ['champion_stats', 'match_outcome_stats', 'champion_bans_by_banner'],
  },
  {
    path: '/overview-detail',
    policy: 'mv_only',
    allowedSources: [
      'champion_stats',
      'champion_runes_solo_stats',
      'champion_runes_stats',
      'champion_item_solo_stats',
      'champion_item_set_stats',
      'champion_summoner_spells',
      'champion_shard_solo_stats',
      'champion_summoner_spell_pair_stats',
    ],
  },
  {
    path: '/overview-duration-winrate',
    policy: 'mv_only',
    allowedSources: ['champion_stats', 'champion_bucket'],
  },
  {
    path: '/overview-abandons',
    policy: 'mv_only',
    allowedSources: ['match_outcome_stats', 'team_core_stat'],
  },
  {
    path: '/overview-teams',
    policy: 'mv_only',
    allowedSources: ['team_core_stat', 'champion_bucket', 'champion_bans_by_banner'],
  },
  {
    path: '/overview-sides',
    policy: 'mv_only',
    allowedSources: ['team_core_stat', 'champion_stats', 'champion_bans_by_banner'],
  },
  {
    path: '/overview-sides-progression',
    policy: 'mv_only',
    allowedSources: ['champion_stats', 'champion_bans_by_banner'],
  },
  {
    path: '/overview-progression',
    policy: 'mv_only',
    allowedSources: ['champion_stats'],
  },
  {
    path: '/overview-progression-full',
    policy: 'mv_only',
    allowedSources: ['champion_stats', 'champion_bans_by_banner'],
  },
  {
    path: '/champions',
    policy: 'mv_only',
    allowedSources: ['champion_stats'],
  },
  {
    path: '/champions/global-table',
    policy: 'mv_only',
    allowedSources: ['champion_stats', 'champion_bans_by_banner'],
  },
  {
    path: '/champions/:championId/damage-split',
    policy: 'mv_only',
    allowedSources: ['champion_stats'],
  },
  {
    path: '/champions/:championId/matchups-extended',
    policy: 'mv_only',
    allowedSources: ['champion_stats', 'champion_vs_stats'],
  },
  {
    path: '/champions/:championId/synergy-extended',
    policy: 'mv_only',
    allowedSources: ['champion_stats', 'champion_duo_role_stats'],
  },
  {
    path: '/champions/bans-table',
    policy: 'mv_only',
    allowedSources: ['champion_bans_by_banner', 'match_outcome_stats'],
  },
  {
    path: '/champions/pings-table',
    policy: 'mv_only',
    allowedSources: ['champion_stats'],
  },
  {
    path: '/champions/vision-table',
    policy: 'mv_only',
    allowedSources: ['champion_stats'],
  },
  {
    path: '/items/:itemId/tier-trend-snapshots',
    policy: 'mv_only',
    allowedSources: ['item_tier_daily_snapshots', 'champion_tier_daily_snapshots'],
  },
  {
    path: '/items/:itemId/breakdown',
    policy: 'mv_only',
    allowedSources: ['item_tier_daily_snapshots'],
  },
  {
    path: '/items/:itemId/purchase-order',
    policy: 'mv_only',
    allowedSources: ['item_tier_daily_snapshots'],
  },
  {
    path: '/tier-list',
    policy: 'mv_only',
    allowedSources: ['champion_stats', 'champion_vs_stats', 'match_outcome_stats'],
  },
  {
    path: '/botlane-vs-botlane',
    policy: 'mv_only',
    allowedSources: ['botlane_duo_vs_duo_stats'],
  },
  {
    path: '/botlane-duo-tierlist',
    policy: 'mv_only',
    allowedSources: ['botlane_duo_vs_duo_stats'],
  },
  {
    path: '/champions/:championId/tier-trend-snapshots',
    policy: 'snapshot_only',
    allowedSources: ['champion_tier_daily_snapshots'],
  },
]
