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

/** Tier « moyen » du match pour processed_matches / agrégats d’équipe. */
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

/** Agrégation autorisée seulement si chaque participant a un rang exploitable (pas UNRANKED). */
export function matchReadyForAggregation(participants: ParsedParticipantDto[]): boolean {
  if (participants.length === 0) return false;
  if (!participants.every(participantHasResolvedRank)) return false;
  return averageMatchRankTierLabel(participants) != null;
}
