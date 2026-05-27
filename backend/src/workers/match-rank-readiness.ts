import type { ParsedParticipantDto } from "../dto/match.dto.js";
import type { RankSnapshot } from "../db/query.js";

export type { RankSnapshot };

const SOLO_TIER_ORDER = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
] as const;

const SOLO_TIER_INDEX: Record<string, number> = Object.fromEntries(
  SOLO_TIER_ORDER.map((tier, i) => [tier, i + 1]),
) as Record<string, number>;

export function normalizeParticipantRankTier(value: string | null | undefined): string | null {
  const tier = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!tier || tier === "UNRANKED") return null;
  return tier;
}

/** Rang connu = snapshot best-effort player_rank_history (exact, avant, ou après game_date). */
export function participantRankKnown(
  participant: ParsedParticipantDto,
  closestSnapshots: Map<string, RankSnapshot>,
): boolean {
  const puuid = String(participant.puuid ?? "").trim();
  return puuid.length > 0 && closestSnapshots.has(puuid);
}

/** Tier moyen du match (participants classés ; fallback UNRANKED si aucun classé connu). */
export function averageMatchRankTierLabel(
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
): string | null {
  const ordinals: number[] = [];
  for (const participant of participants) {
    const puuid = String(participant.puuid ?? "").trim();
    const tier = normalizeParticipantRankTier(closestSnapshots.get(puuid)?.rankTier);
    if (!tier) continue;
    const idx = SOLO_TIER_INDEX[tier];
    if (idx == null) continue;
    ordinals.push(idx);
  }
  if (ordinals.length === 0) {
    const hasKnownSnapshot = participants.some((participant) => {
      const puuid = String(participant.puuid ?? "").trim();
      return puuid.length > 0 && closestSnapshots.has(puuid);
    });
    return hasKnownSnapshot ? "UNRANKED" : null;
  }
  const mean = ordinals.reduce((a, b) => a + b, 0) / ordinals.length;
  const rounded = Math.min(SOLO_TIER_ORDER.length, Math.max(1, Math.round(mean)));
  return SOLO_TIER_ORDER[rounded - 1] ?? null;
}

/**
 * Agrégation autorisée si :
 * - chaque joueur a un snapshot date >= game_date (classé ou UNRANKED confirmé), et
 * - au moins un joueur classé → rang moyen du match calculable.
 */
export function matchReadyForAggregation(
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
): boolean {
  if (participants.length === 0) return false;
  if (!participants.every((p) => participantRankKnown(p, closestSnapshots))) return false;
  return averageMatchRankTierLabel(participants, closestSnapshots) != null;
}

/** Participants sans snapshot best-effort. */
export function getMissingRankParticipants(
  participants: ParsedParticipantDto[],
  closestSnapshots: Map<string, RankSnapshot>,
): ParsedParticipantDto[] {
  return participants.filter((participant) => !participantRankKnown(participant, closestSnapshots));
}

/** Reconstruction post-hydration pour le garde-fou ingestion (participants déjà enrichis). */
export function closestSnapshotsFromParticipants(
  participants: ParsedParticipantDto[],
): Map<string, RankSnapshot> {
  const out = new Map<string, RankSnapshot>();
  for (const participant of participants) {
    if (participant.needsRankFetch) continue;
    const puuid = String(participant.puuid ?? "").trim();
    if (!puuid) continue;
    const tier = String(participant.rankTierValue ?? participant.rankTier ?? "")
      .trim()
      .toUpperCase();
    out.set(puuid, {
      rankTier: tier.length > 0 ? tier : "UNRANKED",
      rankDivision: String(participant.rankDivision ?? "").trim(),
      rankLp: Number(participant.lp ?? 0),
      date: new Date(participant.gameDate),
    });
  }
  return out;
}
