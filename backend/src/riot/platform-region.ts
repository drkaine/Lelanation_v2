/** Alias Riot → platformId (ex. euw → euw1). Clé canonique pour DB et rank gate. */
const PLATFORM_BY_REGION: Record<string, string> = {
  br: "br1",
  br1: "br1",
  eune: "eun1",
  eun: "eun1",
  eun1: "eun1",
  euw: "euw1",
  euw1: "euw1",
  jp: "jp1",
  jp1: "jp1",
  kr: "kr",
  lan: "la1",
  la1: "la1",
  las: "la2",
  la2: "la2",
  na: "na1",
  na1: "na1",
  oce: "oc1",
  oc: "oc1",
  oc1: "oc1",
  ph: "ph2",
  ph2: "ph2",
  ru: "ru",
  sg: "sg2",
  sg2: "sg2",
  th: "th2",
  th2: "th2",
  tr: "tr1",
  tr1: "tr1",
  tw: "tw2",
  tw2: "tw2",
  vn: "vn2",
  vn2: "vn2",
};

export function normalizePlatformRegion(region: string | null | undefined): string {
  const key = String(region ?? "")
    .trim()
    .toLowerCase();
  if (!key || key === "unknown") {
    return "euw1";
  }
  return PLATFORM_BY_REGION[key] ?? key;
}

/** Clés à interroger en DB (canonique + alias brut) pour rétrocompat snapshots. */
export function platformRegionLookupKeys(region: string | null | undefined): string[] {
  const raw = String(region ?? "")
    .trim()
    .toLowerCase();
  const canonical = normalizePlatformRegion(raw);
  const keys = new Set<string>([canonical]);
  if (raw && raw !== "unknown") {
    keys.add(raw);
  }
  return [...keys];
}
