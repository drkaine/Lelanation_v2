import { sql } from 'drizzle-orm'
import { bigint, integer, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core'

/** Table initiale du dump SQL agrégé (botlane duo vs duo). Autres tables : uniquement en SQL migration pour l’instant. */
export const botlaneDuoVsDuoStats = pgTable(
  'botlane_duo_vs_duo_stats',
  {
    patch: text('patch').notNull(),
    rankTier: text('rank_tier').notNull(),
    region: text('region').notNull(),
    adcId: integer('adc_id').notNull(),
    supportId: integer('support_id').notNull(),
    oppAdcId: integer('opp_adc_id').notNull(),
    oppSupportId: integer('opp_support_id').notNull(),
    countWin: integer('count_win').notNull().default(0),
    countGame: integer('count_game').notNull().default(0),

    sumAdcGoldEarned: bigint('sum_adc_gold_earned', { mode: 'bigint' }).notNull().default(sql`0`),
    sumAdcGoldSpent: bigint('sum_adc_gold_spent', { mode: 'bigint' }).notNull().default(sql`0`),
    sumAdcMaxLevelLeadLaneOpponent: integer('sum_adc_max_level_lead_lane_opponent').notNull().default(0),
    sumAdcMaxKillDeficit: integer('sum_adc_max_kill_deficit').notNull().default(0),
    sumAdcMaxCsAdvantageOnLaneOpponent: integer('sum_adc_max_cs_advantage_on_lane_opponent').notNull().default(0),
    sumAdcVisionScoreAdvantageLaneOpponent: integer('sum_adc_vision_score_advantage_lane_opponent').notNull().default(0),
    sumAdcLaningPhaseGoldExpAdvantage: integer('sum_adc_laning_phase_gold_exp_advantage').notNull().default(0),
    sumAdcEarlyLaningPhaseGoldExpAdvantage: integer('sum_adc_early_laning_phase_gold_exp_advantage').notNull().default(0),
    sumAdcPhysiqueDamageDoneToChampionU15: bigint('sum_adc_physique_damage_done_to_champion_u15', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    sumAdcMagicDamageDoneToChampionU15: bigint('sum_adc_magic_damage_done_to_champion_u15', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    sumAdcTrueDamageDoneToChampionU15: bigint('sum_adc_true_damage_done_to_champion_u15', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    sumAdcKillU15: integer('sum_adc_kill_u15').notNull().default(0),
    sumAdcAssistU15: integer('sum_adc_assist_u15').notNull().default(0),
    sumAdcDeathU15: integer('sum_adc_death_u15').notNull().default(0),
    sumAdcVisionScoreU15: integer('sum_adc_vision_score_u15').notNull().default(0),
    sumAdcShieldAndHealU15: bigint('sum_adc_shield_and_heal_u15', { mode: 'bigint' }).notNull().default(sql`0`),
    sumAdcMinionsKilledU15: integer('sum_adc_minions_killed_u15').notNull().default(0),

    sumSupportGoldEarned: bigint('sum_support_gold_earned', { mode: 'bigint' }).notNull().default(sql`0`),
    sumSupportGoldSpent: bigint('sum_support_gold_spent', { mode: 'bigint' }).notNull().default(sql`0`),
    sumSupportMaxLevelLeadLaneOpponent: integer('sum_support_max_level_lead_lane_opponent').notNull().default(0),
    sumSupportMaxKillDeficit: integer('sum_support_max_kill_deficit').notNull().default(0),
    sumSupportMaxCsAdvantageOnLaneOpponent: integer('sum_support_max_cs_advantage_on_lane_opponent').notNull().default(0),
    sumSupportVisionScoreAdvantageLaneOpponent: integer('sum_support_vision_score_advantage_lane_opponent')
      .notNull()
      .default(0),
    sumSupportLaningPhaseGoldExpAdvantage: integer('sum_support_laning_phase_gold_exp_advantage').notNull().default(0),
    sumSupportEarlyLaningPhaseGoldExpAdvantage: integer('sum_support_early_laning_phase_gold_exp_advantage')
      .notNull()
      .default(0),
    sumSupportPhysiqueDamageDoneToChampionU15: bigint('sum_support_physique_damage_done_to_champion_u15', {
      mode: 'bigint',
    })
      .notNull()
      .default(sql`0`),
    sumSupportMagicDamageDoneToChampionU15: bigint('sum_support_magic_damage_done_to_champion_u15', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    sumSupportTrueDamageDoneToChampionU15: bigint('sum_support_true_damage_done_to_champion_u15', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    sumSupportKillU15: integer('sum_support_kill_u15').notNull().default(0),
    sumSupportAssistU15: integer('sum_support_assist_u15').notNull().default(0),
    sumSupportDeathU15: integer('sum_support_death_u15').notNull().default(0),
    sumSupportVisionScoreU15: integer('sum_support_vision_score_u15').notNull().default(0),
    sumSupportShieldAndHealU15: bigint('sum_support_shield_and_heal_u15', { mode: 'bigint' }).notNull().default(sql`0`),
    sumSupportMinionsKilledU15: integer('sum_support_minions_killed_u15').notNull().default(0),

    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      columns: [t.patch, t.rankTier, t.region, t.adcId, t.supportId, t.oppAdcId, t.oppSupportId],
    }),
  ],
)

export type BotlaneDuoVsDuoStatRow = typeof botlaneDuoVsDuoStats.$inferSelect
export type BotlaneDuoVsDuoStatInsert = typeof botlaneDuoVsDuoStats.$inferInsert
