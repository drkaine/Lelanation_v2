/**
 * Logique d'agrégation pure (sans I/O) partagée par l'ingestion worker.
 *
 * Extraite de `ingestion.worker.ts` pour être testable sans déclencher les
 * effets de bord du module worker (création du Worker BullMQ, connexions Redis/DB
 * au chargement). Toutes les fonctions ici sont déterministes et sans I/O.
 */
import type { ParsedParticipantDto } from "../dto/match.dto.js";
import { normalizeChampionTransform } from "../parsers/championTransform.js";

export function participantWinCount(participant: ParsedParticipantDto): number {
  return participant.win ? 1 : 0;
}

export function championTransformFields(participant: ParsedParticipantDto): {
  championTransform: number;
  transformTimestampMs: number;
} {
  return {
    championTransform: normalizeChampionTransform(participant.championTransform),
    transformTimestampMs: Math.max(0, Math.trunc(Number(participant.transformTimestampMs ?? 0))),
  };
}

/** Métriques lane / challenges : colonnes SQL passées en double precision (0008) — pas de troncature. */
export function laneEconomyNumber(participant: ParsedParticipantDto, sumKey: string): number {
  const raw = (participant as Record<string, unknown>)[sumKey];
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Métriques agrégées côté champion principal (aligné agg_champion_duo_role_stats / vs). */
export function championDuoRoleEconomyFromParticipant(p: ParsedParticipantDto) {
  return {
    goldEarned: Math.trunc(Number(p.goldEarned) || 0),
    goldSpent: Math.trunc(Number(p.goldSpent) || 0),
    maxLevelLeadLaneOpponent: laneEconomyNumber(p, "sum_max_level_lead_lane_opponent"),
    maxKillDeficit: laneEconomyNumber(p, "sum_max_kill_deficit"),
    moreEnemyJungleThanOpponent: laneEconomyNumber(p, "sum_more_enemy_jungle_than_opponent"),
    maxCsAdvantageOnLaneOpponent: laneEconomyNumber(p, "sum_max_cs_advantage_on_lane_opponent"),
    visionScoreAdvantageLaneOpponent: laneEconomyNumber(p, "sum_vision_score_advantage_lane_opponent"),
    laningPhaseGoldExpAdvantage: laneEconomyNumber(p, "sum_laning_phase_gold_exp_advantage"),
    earlyLaningPhaseGoldExpAdvantage: laneEconomyNumber(p, "sum_early_laning_phase_gold_exp_advantage"),
  };
}

export type DuoRoleAggRow = {
  patch: string;
  rankTier: string;
  region: string;
  championId: number;
  championTransform: number;
  role: string;
  allyChampionId: number;
  allyRole: string;
  countGame: number;
  countWin: number;
  sumGoldEarned: number;
  sumGoldSpent: number;
  sumMaxLevelLeadLaneOpponent: number;
  sumMaxKillDeficit: number;
  sumMoreEnemyJungleThanOpponent: number;
  sumMaxCsAdvantageOnLaneOpponent: number;
  sumVisionScoreAdvantageLaneOpponent: number;
  sumLaningPhaseGoldExpAdvantage: number;
  sumEarlyLaningPhaseGoldExpAdvantage: number;
};

/**
 * Pré-agrège en mémoire toutes les paires (champion, allié) d'un même match/équipe.
 *
 * Équivalent aux upserts séquentiels précédents (chaque paire = +1 partie), mais
 * les doublons de clé de conflit sont sommés en amont pour permettre un unique
 * INSERT multi-lignes `ON CONFLICT DO UPDATE` (sinon Postgres refuse d'affecter
 * deux fois la même ligne dans un même statement).
 */
export function buildDuoRoleAggregationRows(participants: ParsedParticipantDto[]): DuoRoleAggRow[] {
  const teamMatesByKey = new Map<string, ParsedParticipantDto[]>();
  for (const p of participants) {
    const teamKey = `${p.matchId}\u0001${p.teamId}`;
    const arr = teamMatesByKey.get(teamKey);
    if (arr) arr.push(p);
    else teamMatesByKey.set(teamKey, [p]);
  }

  const rows = new Map<string, DuoRoleAggRow>();
  for (const p of participants) {
    const teamMates = teamMatesByKey.get(`${p.matchId}\u0001${p.teamId}`) ?? [];
    const allies = teamMates.filter((ally) => ally.puuid !== p.puuid);
    if (allies.length === 0) continue;

    const m = championDuoRoleEconomyFromParticipant(p);
    const { championTransform } = championTransformFields(p);
    const win = participantWinCount(p);

    for (const ally of allies) {
      const key = [
        p.patch,
        p.role,
        p.rankTier,
        p.region,
        p.championId,
        championTransform,
        ally.championId,
        ally.role,
      ].join("\u0001");
      const existing = rows.get(key);
      if (existing) {
        existing.countGame += 1;
        existing.countWin += win;
        existing.sumGoldEarned += m.goldEarned;
        existing.sumGoldSpent += m.goldSpent;
        existing.sumMaxLevelLeadLaneOpponent += m.maxLevelLeadLaneOpponent;
        existing.sumMaxKillDeficit += m.maxKillDeficit;
        existing.sumMoreEnemyJungleThanOpponent += m.moreEnemyJungleThanOpponent;
        existing.sumMaxCsAdvantageOnLaneOpponent += m.maxCsAdvantageOnLaneOpponent;
        existing.sumVisionScoreAdvantageLaneOpponent += m.visionScoreAdvantageLaneOpponent;
        existing.sumLaningPhaseGoldExpAdvantage += m.laningPhaseGoldExpAdvantage;
        existing.sumEarlyLaningPhaseGoldExpAdvantage += m.earlyLaningPhaseGoldExpAdvantage;
      } else {
        rows.set(key, {
          patch: p.patch,
          rankTier: p.rankTier,
          region: p.region,
          championId: p.championId,
          championTransform,
          role: p.role,
          allyChampionId: ally.championId,
          allyRole: ally.role,
          countGame: 1,
          countWin: win,
          sumGoldEarned: m.goldEarned,
          sumGoldSpent: m.goldSpent,
          sumMaxLevelLeadLaneOpponent: m.maxLevelLeadLaneOpponent,
          sumMaxKillDeficit: m.maxKillDeficit,
          sumMoreEnemyJungleThanOpponent: m.moreEnemyJungleThanOpponent,
          sumMaxCsAdvantageOnLaneOpponent: m.maxCsAdvantageOnLaneOpponent,
          sumVisionScoreAdvantageLaneOpponent: m.visionScoreAdvantageLaneOpponent,
          sumLaningPhaseGoldExpAdvantage: m.laningPhaseGoldExpAdvantage,
          sumEarlyLaningPhaseGoldExpAdvantage: m.earlyLaningPhaseGoldExpAdvantage,
        });
      }
    }
  }
  return [...rows.values()];
}
