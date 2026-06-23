import { sql } from '../client.js'
import type { ParsedParticipantDto } from '../../dto/match.dto.js'
import type { MatchDataJob } from '../../poller/jobTypes.js'

type ParticipantAggregateInput = {
  participant: ParsedParticipantDto
  patch: string
  rankTier: string
  region: string
}

export async function writeParticipantAggregates(input: ParticipantAggregateInput): Promise<void> {
  const { participant, patch, rankTier, region } = input

  await sql`
    INSERT INTO champion_stats (
      patch, role, rank_tier, region, champion_id, team, count_win, count_game
    )
    VALUES (
      ${patch},
      ${participant.role},
      ${rankTier},
      ${region},
      ${participant.championId},
      ${participant.teamId},
      ${participant.win ? 1 : 0},
      1
    )
    ON CONFLICT (patch, role, rank_tier, region, champion_id, team)
    DO UPDATE SET
      count_win = champion_stats.count_win + EXCLUDED.count_win,
      count_game = champion_stats.count_game + EXCLUDED.count_game
  `

  await sql`
    INSERT INTO champion_vs_stats (
      patch, role, rank_tier, region, champion_id, opponent_champion_id, count_win, count_game
    )
    VALUES (
      ${patch},
      ${participant.role},
      ${rankTier},
      ${region},
      ${participant.championId},
      ${participant.opponentChampionId},
      ${participant.win ? 1 : 0},
      1
    )
    ON CONFLICT (patch, role, rank_tier, region, champion_id, opponent_champion_id)
    DO UPDATE SET
      count_win = champion_vs_stats.count_win + EXCLUDED.count_win,
      count_game = champion_vs_stats.count_game + EXCLUDED.count_game
  `
}

export async function writeTeamAggregates(job: MatchDataJob): Promise<void> {
  const team100 = (job.matchData.info.teams ?? []).find((team) => team.teamId === 100)
  const team200 = (job.matchData.info.teams ?? []).find((team) => team.teamId === 200)
  const team100Win = team100?.win === true
  const team200Win = !team100Win
  const participants = job.matchData.info.participants ?? []

  const surrenderedTeam100 = participants.some((p) => p.teamId === 100 && p.gameEndedInSurrender === true)
  const surrenderedTeam200 = participants.some((p) => p.teamId === 200 && p.gameEndedInSurrender === true)
  const earlySurrenderTeam100 = participants.some((p) => p.teamId === 100 && p.gameEndedInEarlySurrender === true)
  const earlySurrenderTeam200 = participants.some((p) => p.teamId === 200 && p.gameEndedInEarlySurrender === true)

  await sql`
    INSERT INTO team_core_stat (
      patch, rank_tier, region, team, count_win, count_game, count_team_early_surrendered, count_team_surrendered
    )
    VALUES
      (${job.patch}, ${job.rankTier}, ${job.region}, 100, ${team100Win ? 1 : 0}, 1, ${earlySurrenderTeam100 ? 1 : 0}, ${surrenderedTeam100 ? 1 : 0}),
      (${job.patch}, ${job.rankTier}, ${job.region}, 200, ${team200Win ? 1 : 0}, 1, ${earlySurrenderTeam200 ? 1 : 0}, ${surrenderedTeam200 ? 1 : 0})
    ON CONFLICT (patch, rank_tier, region, team)
    DO UPDATE SET
      count_win = team_core_stat.count_win + EXCLUDED.count_win,
      count_game = team_core_stat.count_game + EXCLUDED.count_game,
      count_team_early_surrendered = team_core_stat.count_team_early_surrendered + EXCLUDED.count_team_early_surrendered,
      count_team_surrendered = team_core_stat.count_team_surrendered + EXCLUDED.count_team_surrendered
  `

  await sql`
    INSERT INTO match_outcome_stats (patch, rank_tier, region, count_match)
    VALUES (${job.patch}, ${job.rankTier}, ${job.region}, 1)
    ON CONFLICT (patch, rank_tier)
    DO UPDATE SET
      count_match = match_outcome_stats.count_match + 1,
      region = EXCLUDED.region,
      updated_at = NOW()
  `

  const objectiveRows: Array<{
    team: 100 | 200
    objectiveType: string
    outcome: 'win' | 'loss'
    count: number
  }> = []

  for (const team of [team100, team200]) {
    if (!team?.teamId) continue
    const tid = team.teamId === 100 ? 100 : 200
    const outcome: 'win' | 'loss' = team.win ? 'win' : 'loss'
    for (const [objectiveType, value] of Object.entries(team.objectives ?? {})) {
      const count = Number(value.kills ?? 0)
      if (count <= 0) continue
      objectiveRows.push({ team: tid, objectiveType, outcome, count })
    }
  }

  for (const row of objectiveRows) {
    await sql`
      INSERT INTO objective_outcome_histogram (
        patch, rank_tier, region, team, objective_type, type_drake, is_soul, outcome, obj_count, count_games, sum_timestamp_ms
      )
      VALUES (
        ${job.patch}, ${job.rankTier}, ${job.region}, ${row.team}, ${row.objectiveType}, NULL, FALSE, ${row.outcome}, ${row.count}, 1, 0
      )
      ON CONFLICT (patch, rank_tier, region, team, objective_type, type_drake_key, is_soul, outcome, obj_count)
      DO UPDATE SET
        count_games = objective_outcome_histogram.count_games + 1
    `
  }
}

export async function writeBanAggregates(job: MatchDataJob): Promise<void> {
  const teams = job.matchData.info.teams ?? []
  for (const team of teams) {
    const tid = team.teamId === 100 ? 100 : 200
    const isWinner = team.win === true
    for (const ban of team.bans ?? []) {
      const championId = Number(ban.championId ?? 0)
      if (!Number.isFinite(championId) || championId <= 0) continue

      await sql`
        INSERT INTO champion_bans_by_banner (
          patch,
          rank_tier,
          region,
          banned_champion_id,
          count_banner_team_100,
          count_banner_team_200,
          count_ban_when_team_won,
          count_ban_when_team_lost
        )
        VALUES (
          ${job.patch},
          ${job.rankTier},
          ${job.region},
          ${championId},
          ${tid === 100 ? 1 : 0},
          ${tid === 200 ? 1 : 0},
          ${isWinner ? 1 : 0},
          ${isWinner ? 0 : 1}
        )
        ON CONFLICT (patch, rank_tier, region, banned_champion_id)
        DO UPDATE SET
          count_banner_team_100 = champion_bans_by_banner.count_banner_team_100 + EXCLUDED.count_banner_team_100,
          count_banner_team_200 = champion_bans_by_banner.count_banner_team_200 + EXCLUDED.count_banner_team_200,
          count_ban_when_team_won = champion_bans_by_banner.count_ban_when_team_won + EXCLUDED.count_ban_when_team_won,
          count_ban_when_team_lost = champion_bans_by_banner.count_ban_when_team_lost + EXCLUDED.count_ban_when_team_lost
      `
    }
  }
}
