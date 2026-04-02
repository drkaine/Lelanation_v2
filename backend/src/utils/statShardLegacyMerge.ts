/**
 * Riot a renommé certains perk « StatMods » ; les matchs plus anciens gardent les anciens IDs.
 * @see https://darkintaqt.com/blog/perk-ids (section Statmodifiers)
 */
export function mergeLegacyStatShardAggregates(
  shardMap: Map<string, { wins: number; games: number }>
): void {
  const mergeInto = (toShardId: number, toSlot: number, fromShardId: number, fromSlot: number) => {
    const kf = `${fromShardId}:${fromSlot}`
    const from = shardMap.get(kf)
    if (!from || (from.games === 0 && from.wins === 0)) return
    shardMap.delete(kf)
    const kt = `${toShardId}:${toSlot}`
    const to = shardMap.get(kt) ?? { wins: 0, games: 0 }
    to.wins += from.wins
    to.games += from.games
    shardMap.set(kt, to)
  }

  mergeInto(5010, 1, 5006, 1)
  mergeInto(5001, 1, 5002, 1)
  mergeInto(5013, 2, 5003, 2)
  mergeInto(5001, 2, 5002, 2)
}
