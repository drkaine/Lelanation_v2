/** Alias Riot → platformId (ex. euw → EUW1). Clé canonique pour DB et rank gate. */
import { normalizeLolRegion } from "../constants/lolEnums.js";

export function normalizePlatformRegion(region: string | null | undefined): string {
  return normalizeLolRegion(region);
}

/** Clés à interroger en DB (canonique + alias brut) pour rétrocompat snapshots. */
export function platformRegionLookupKeys(region: string | null | undefined): string[] {
  const canonical = normalizePlatformRegion(region);
  const raw = String(region ?? "").trim().toLowerCase();
  const keys = new Set<string>([canonical, canonical.toLowerCase()]);
  if (raw && raw !== "unknown") {
    keys.add(raw);
    keys.add(raw.toUpperCase());
  }
  return [...keys];
}
