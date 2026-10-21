/**
 * Every transaction that writes several `players` rows must lock them in the same order,
 * or two of them (ingestion worker vs participant discovery on the same match) deadlock.
 * Plain code point order, the same in every process (no locale).
 */
export function sortByPuuid<T extends { puuid: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (a.puuid < b.puuid ? -1 : a.puuid > b.puuid ? 1 : 0));
}
