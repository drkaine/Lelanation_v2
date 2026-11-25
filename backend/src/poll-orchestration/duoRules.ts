/** Duo : part minimale des parties de CHAQUE joueur passées dans la même équipe. */
export const DUO_MIN_SHARE = 0.1;
/** Duo : nombre minimal de parties ensemble (évite le bruit des petits échantillons). */
export const DUO_MIN_GAMES = 3;
/** Un duo sans partie commune depuis ce délai est oublié. */
export const DUO_RETENTION_DAYS = 90;

export interface DuoCandidateRow {
  puuid: string;
  region: string;
  partners: string[];
}

export function isDuoPair(gamesTogether: number, gamesA: number, gamesB: number): boolean {
  if (gamesTogether < DUO_MIN_GAMES) return false;
  return gamesTogether >= DUO_MIN_SHARE * gamesA && gamesTogether >= DUO_MIN_SHARE * gamesB;
}

export function orderPair(x: string, y: string): [string, string] {
  return x < y ? [x, y] : [y, x];
}

/**
 * Garde l'ordre d'entrée, retire doublons et joueurs dont un partenaire de duo
 * est déjà retenu dans ce lot ou déjà pollé aujourd'hui (`polledToday`).
 */
export function selectDuoSafeBatch<T extends DuoCandidateRow>(
  rows: T[],
  limit: number,
  polledToday: ReadonlySet<string>,
): T[] {
  const taken = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (out.length >= limit) break;
    if (taken.has(row.puuid)) continue;
    if (row.partners.some((p) => taken.has(p) || polledToday.has(p))) continue;
    taken.add(row.puuid);
    out.push(row);
  }
  return out;
}
