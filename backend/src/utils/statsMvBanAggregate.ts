/**
 * `agg_champion_core_stats.count_ban` is the champion ban total per
 * (champion, rank_tier, game_version, region) — repeated on every **role** row for that slice.
 * Summing `countBan` like `countGame` multiplies bans by the number of roles (and must still
 * sum across regions / version rows correctly).
 */
export type MvBanSliceRow = {
  championId: number
  rankTier: string
  gameVersion: string
  region: string
  countBan: number
}

export function mvBanSliceKey(r: MvBanSliceRow): string {
  return `${r.championId}\t${r.rankTier}\t${r.gameVersion}\t${r.region}`
}

/** One ban count per core slice; then sum slices per champion. */
export function bansPerChampionFromMvRows(rows: MvBanSliceRow[]): Map<number, number> {
  const sliceBans = new Map<string, number>()
  for (const r of rows) {
    const k = mvBanSliceKey(r)
    if (!sliceBans.has(k)) {
      sliceBans.set(k, r.countBan)
    }
  }
  const byChamp = new Map<number, number>()
  for (const [k, b] of sliceBans) {
    const cid = Number(k.split('\t')[0])
    byChamp.set(cid, (byChamp.get(cid) ?? 0) + b)
  }
  return byChamp
}
