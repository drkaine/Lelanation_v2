/** Riot match id prefix (e.g. EUW1_…) from LCU `region-locale.region` / routing region. */

const MAP: Record<string, string> = {
  EUW: "EUW1",
  EUNE: "EUN1",
  NA: "NA1",
  BR: "BR1",
  LAN: "LA1",
  LAS: "LA2",
  OCE: "OC1",
  RU: "RU",
  TR: "TR1",
  JP: "JP1",
  KR: "KR",
  PH: "PH2",
  SG: "SG2",
  TW: "TW2",
  VN: "VN2",
  TH: "TH2",
  PBE: "PBE1",
};

export function regionToPlatformId(region: string | undefined | null): string {
  const r = String(region ?? "")
    .trim()
    .toUpperCase();
  if (!r) return "EUW1";
  if (MAP[r]) return MAP[r];
  if (/^[A-Z0-9]+1$/.test(r)) return r;
  if (r.length >= 2 && r.length <= 5) return `${r}1`;
  return "EUW1";
}
