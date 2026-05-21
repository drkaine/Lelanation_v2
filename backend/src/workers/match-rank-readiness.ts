import type { ParsedParticipantDto } from "../dto/match.dto.js";

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

export function participantHasResolvedRank(participant: ParsedParticipantDto): boolean {
  return normalizeParticipantRankTier(participant.rankTierValue ?? participant.rankTier) != null;
}

/** Rang connu = tier classé sur le match, ou snapshot League du jour déjà en base (y compris UNRANKED confirmé). */
export function participantRankKnown(
  participant: ParsedParticipantDto,
  todaySnapshotPuuids: Set<string>,
): boolean {
  if (participantHasResolvedRank(participant)) return true;
  const puuid = String(participant.puuid ?? "").trim();
  return puuid.length > 0 && todaySnapshotPuuids.has(puuid);
}

/** Tier moyen du match (participants classés uniquement ; les UNRANKED sont ignorés du calcul). */
export function averageMatchRankTierLabel(participants: ParsedParticipantDto[]): string | null {
  const ordinals: number[] = [];
  for (const participant of participants) {
    const tier = normalizeParticipantRankTier(participant.rankTierValue ?? participant.rankTier);
    if (!tier) continue;
    const idx = SOLO_TIER_INDEX[tier];
    if (idx == null) continue;
    ordinals.push(idx);
  }
  if (ordinals.length === 0) return null;
  const mean = ordinals.reduce((a, b) => a + b, 0) / ordinals.length;
  const rounded = Math.min(SOLO_TIER_ORDER.length, Math.max(1, Math.round(mean)));
  return SOLO_TIER_ORDER[rounded - 1] ?? null;
}

/**
 * Agrégation autorisée si :
 * - chaque joueur a un rang connu (classé ou UNRANKED confirmé via League), et
 * - au moins un joueur classé → rang moyen du match calculable.
 * Les joueurs UNRANKED restent en stats individuelles ; le match n’est jamais agrégé comme « UNRANKED ».
 */
export function matchReadyForAggregation(
  participants: ParsedParticipantDto[],
  todaySnapshotPuuids: Set<string>,
): boolean {
  if (participants.length === 0) return false;
  if (!participants.every((p) => participantRankKnown(p, todaySnapshotPuuids))) return false;
  return averageMatchRankTierLabel(participants) != null;
}

export function todaySnapshotSetFromParticipants(participants: ParsedParticipantDto[]): Set<string> {
  const out = new Set<string>();
  for (const participant of participants) {
    if (participant.needsRankFetch) continue;
    const puuid = String(participant.puuid ?? "").trim();
    if (puuid) out.add(puuid);
  }
  return out;
}
