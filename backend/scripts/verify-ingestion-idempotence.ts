import { readFile } from "node:fs/promises";
import { sql } from "../src/db/client.js";
import { parseMatch } from "../src/parsers/match.parser.js";
import type { IngestionJobData, ParsedParticipantDto } from "../src/dto/match.dto.js";
import type { MatchDto, MatchTimelineDto } from "../src/riot/types.js";

const ROLLBACK_MARKER = "__ROLLBACK_FOR_VERIFICATION__";

function extractPatch(gameVersion: string): string {
  const [major, minor] = (gameVersion ?? "").split(".");
  if (!major || !minor) return "unknown";
  return `${major}.${minor}`;
}

function buildTeamStats(match: MatchDto, patch: string, matchId: string): IngestionJobData["teamStats"] {
  const region = String(match.info.platformId ?? "unknown").toLowerCase();
  const team100 = (match.info.teams ?? []).find((team) => team.teamId === 100);
  const team100Win = team100?.win === true;
  const objectives: IngestionJobData["teamStats"]["objectives"] = [];
  for (const team of match.info.teams ?? []) {
    for (const [type, value] of Object.entries(team.objectives ?? {})) {
      objectives.push({
        type,
        count: Number(value.kills ?? 0),
        team: team.teamId as 100 | 200,
        outcome: (team.teamId === 100 ? team100Win : !team100Win) ? "win" : "loss",
      });
    }
  }

  return {
    matchId,
    patch,
    rankTier: "UNKNOWN",
    region,
    team100Win,
    objectives,
    surrendered: (match.info.participants ?? []).some((p) => p.gameEndedInSurrender === true),
    earlySurrendered: (match.info.participants ?? []).some((p) => p.gameEndedInEarlySurrender === true),
  };
}

async function upsertChampionStats(tx: any, participants: ParsedParticipantDto[]): Promise<void> {
  for (const participant of participants) {
    await tx`
      INSERT INTO champion_stats (
        patch, role, rank_tier, region, champion_id, team,
        count_game, count_win, sum_gold_earned, sum_gold_spent, sum_kills, sum_assists
      )
      VALUES (
        ${participant.patch}, ${participant.role}, ${participant.rankTier}, ${participant.region}, ${participant.championId}, ${participant.teamId},
        1, ${participant.win ? 1 : 0}, ${participant.goldEarned}, ${participant.goldSpent}, ${participant.kills}, ${participant.assists}
      )
      ON CONFLICT (patch, role, rank_tier, region, champion_id, team)
      DO UPDATE SET
        count_game = champion_stats.count_game + EXCLUDED.count_game,
        count_win = champion_stats.count_win + EXCLUDED.count_win,
        sum_gold_earned = champion_stats.sum_gold_earned + EXCLUDED.sum_gold_earned,
        sum_gold_spent = champion_stats.sum_gold_spent + EXCLUDED.sum_gold_spent,
        sum_kills = champion_stats.sum_kills + EXCLUDED.sum_kills,
        sum_assists = champion_stats.sum_assists + EXCLUDED.sum_assists
    `;
  }
}

async function applyIngestionStep(tx: any, payload: IngestionJobData): Promise<boolean> {
  const first = payload.participants[0];
  if (!first) return false;

  const inserted = await tx<{ riot_match_id: string }[]>`
    INSERT INTO processed_matches (patch, game_date, riot_match_id, status, rank)
    VALUES (${payload.teamStats.patch}, ${first.gameDate}, ${payload.teamStats.matchId}, 'DONE', NULL)
    ON CONFLICT (patch, riot_match_id) DO NOTHING
    RETURNING riot_match_id
  `;

  if (inserted.length === 0) return false;
  await upsertChampionStats(tx, payload.participants);
  return true;
}

async function main(): Promise<void> {
  const match = JSON.parse(await readFile("./data/api-riot/match-id.json", "utf8")) as MatchDto;
  const timeline = JSON.parse(await readFile("./data/api-riot/timeline.json", "utf8")) as MatchTimelineDto;
  const patch = extractPatch(match.info.gameVersion);
  const uniqueMatchId = `${match.metadata.matchId}_IDEMPOTENCE_TEST`;
  const participants = parseMatch(match, timeline, patch).filter(
    (value): value is ParsedParticipantDto => value !== null,
  );
  for (const participant of participants) participant.matchId = uniqueMatchId;

  const payload: IngestionJobData = {
    participants,
    teamStats: buildTeamStats(match, patch, uniqueMatchId),
  };

  const probe = participants[0];
  if (!probe) throw new Error("no_participants_for_probe");

  let report:
    | {
        firstApplied: boolean;
        secondApplied: boolean;
        beforeCountGame: number;
        afterFirstCountGame: number;
        afterSecondCountGame: number;
      }
    | null = null;

  try {
    await sql.begin(async (tx) => {
      const beforeRows = await tx<{ count_game: number }[]>`
        SELECT count_game
        FROM champion_stats
        WHERE patch = ${probe.patch}
          AND role = ${probe.role}
          AND rank_tier = ${probe.rankTier}
          AND region = ${probe.region}
          AND champion_id = ${probe.championId}
          AND team = ${probe.teamId}
      `;
      const beforeCountGame = Number(beforeRows[0]?.count_game ?? 0);

      const firstApplied = await applyIngestionStep(tx, payload);

      const afterFirstRows = await tx<{ count_game: number }[]>`
        SELECT count_game
        FROM champion_stats
        WHERE patch = ${probe.patch}
          AND role = ${probe.role}
          AND rank_tier = ${probe.rankTier}
          AND region = ${probe.region}
          AND champion_id = ${probe.championId}
          AND team = ${probe.teamId}
      `;
      const afterFirstCountGame = Number(afterFirstRows[0]?.count_game ?? 0);

      const secondApplied = await applyIngestionStep(tx, payload);

      const afterSecondRows = await tx<{ count_game: number }[]>`
        SELECT count_game
        FROM champion_stats
        WHERE patch = ${probe.patch}
          AND role = ${probe.role}
          AND rank_tier = ${probe.rankTier}
          AND region = ${probe.region}
          AND champion_id = ${probe.championId}
          AND team = ${probe.teamId}
      `;
      const afterSecondCountGame = Number(afterSecondRows[0]?.count_game ?? 0);

      report = {
        firstApplied,
        secondApplied,
        beforeCountGame,
        afterFirstCountGame,
        afterSecondCountGame,
      };

      throw new Error(ROLLBACK_MARKER);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== ROLLBACK_MARKER) {
      throw error;
    }
  }

  if (!report) throw new Error("no_report_generated");

  console.log("verification_scope=transaction_rollback");
  console.log(`first_send_applied=${report.firstApplied}`);
  console.log(`second_send_applied=${report.secondApplied}`);
  console.log(`count_game_before=${report.beforeCountGame}`);
  console.log(`count_game_after_first_send=${report.afterFirstCountGame}`);
  console.log(`count_game_after_second_send=${report.afterSecondCountGame}`);
  console.log(
    `delta_first=${report.afterFirstCountGame - report.beforeCountGame}, delta_second=${report.afterSecondCountGame - report.afterFirstCountGame}`,
  );
}

main().catch((error) => {
  console.error("verification_failed", error);
  process.exitCode = 1;
});
