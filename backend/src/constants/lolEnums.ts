/** Valeurs PostgreSQL `lol_role`. */
export const LOL_ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type LolRole = (typeof LOL_ROLES)[number];

/** Valeurs PostgreSQL `lol_rank_tier` (inclut UNRANKED pour agrégats / historique). */
export const LOL_RANK_TIERS = [
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
  "UNRANKED",
] as const;
export type LolRankTier = (typeof LOL_RANK_TIERS)[number];

/** Valeurs PostgreSQL `lol_region` (platformId Riot). */
export const LOL_REGIONS = [
  "EUW1",
  "EUN1",
  "NA1",
  "KR",
  "BR1",
  "LA1",
  "LA2",
  "OC1",
  "TR1",
  "JP1",
  "ME1",
] as const;
export type LolRegion = (typeof LOL_REGIONS)[number];

const LOL_ROLE_SET = new Set<string>(LOL_ROLES);
const LOL_RANK_TIER_SET = new Set<string>(LOL_RANK_TIERS);
const LOL_REGION_SET = new Set<string>(LOL_REGIONS);

export function normalizeLolRole(raw: string | null | undefined): LolRole {
  const position = String(raw ?? "").trim().toUpperCase();
  if (position === "TOP") return "TOP";
  if (position.startsWith("JUNGLE")) return "JUNGLE";
  if (position === "MIDDLE" || position === "MID" || position === "MIDLANE") return "MIDDLE";
  if (position === "BOTTOM" || position === "ADC" || position === "BOT") return "BOTTOM";
  if (position === "UTILITY" || position === "SUPPORT" || position === "SUP") return "UTILITY";
  if (LOL_ROLE_SET.has(position)) return position as LolRole;
  return "UTILITY";
}

export function normalizeLolRankTier(raw: string | null | undefined): LolRankTier {
  const tier = String(raw ?? "").trim().toUpperCase();
  if (LOL_RANK_TIER_SET.has(tier)) return tier as LolRankTier;
  return "UNRANKED";
}

/** Alias platform → `lol_region` (majuscules). */
export function normalizeLolRegion(raw: string | null | undefined): LolRegion {
  const key = String(raw ?? "").trim().toLowerCase();
  if (!key || key === "unknown") return "EUW1";
  const mapped: Record<string, LolRegion> = {
    br: "BR1",
    br1: "BR1",
    eune: "EUN1",
    eun: "EUN1",
    eun1: "EUN1",
    euw: "EUW1",
    euw1: "EUW1",
    jp: "JP1",
    jp1: "JP1",
    kr: "KR",
    lan: "LA1",
    la1: "LA1",
    las: "LA2",
    la2: "LA2",
    na: "NA1",
    na1: "NA1",
    oce: "OC1",
    oc: "OC1",
    oc1: "OC1",
    tr: "TR1",
    tr1: "TR1",
    me: "ME1",
    me1: "ME1",
  };
  const hit = mapped[key];
  if (hit) return hit;
  const upper = key.toUpperCase();
  if (LOL_REGION_SET.has(upper)) return upper as LolRegion;
  return "EUW1";
}

/** Variantes SQL pour filtrer un rôle client (MID → MIDDLE, etc.). */
export function lolRoleSqlValues(clientRole: string): LolRole[] {
  const canonical = normalizeLolRole(clientRole);
  return [canonical];
}
