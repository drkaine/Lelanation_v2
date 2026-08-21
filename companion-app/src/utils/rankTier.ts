/** "Gold II" → "GOLD" for API filters. */
export function rankTierForApi(displayRank: string | null | undefined): string | null {
  if (!displayRank?.trim()) return null;
  const tier = displayRank.trim().split(/\s+/)[0]?.toUpperCase();
  if (!tier || tier === "UNRANKED") return null;
  return tier;
}

export function roleForApi(role: string | null | undefined): string | null {
  if (!role?.trim()) return null;
  const r = role.trim().toUpperCase();
  if (r === "MID" || r === "MIDLANE") return "MIDDLE";
  if (r === "BOT" || r === "ADC") return "BOTTOM";
  if (r === "SUP" || r === "SUPPORT") return "UTILITY";
  if (r === "JGL") return "JUNGLE";
  return r;
}
