export type BotlaneTierRow = {
  rank: number
  adcId: number
  supportId: number
  oppAdcId: number
  oppSupportId: number
  games: number
  wins: number
  winrate: number
  deltaVsPeersPp: number | null
  note: number
  tier: string
}

export type BotlaneTierRowWithPatchDelta = BotlaneTierRow & {
  patchRefRankDelta?: number
  patchRefWinratePp?: number
  patchRefScorePp?: number
  patchRefDeltaVsPeersPp?: number
  patchRefPickratePp?: number
  patchRefGamesDelta?: number
}

export function botlaneRowKey(row: BotlaneTierRow, mode: 'vs' | 'duo'): string {
  if (mode === 'duo') return `${row.adcId}-${row.supportId}`
  return `${row.adcId}-${row.supportId}-${row.oppAdcId}-${row.oppSupportId}`
}

export function enrichBotlaneRowsWithPatchDeltas(
  rows: BotlaneTierRow[],
  refRows: BotlaneTierRow[],
  mode: 'vs' | 'duo'
): BotlaneTierRowWithPatchDelta[] {
  if (!refRows.length) return rows
  const refByKey = new Map<string, BotlaneTierRow>()
  for (const r of refRows) refByKey.set(botlaneRowKey(r, mode), r)
  const curTotalGames = rows.reduce((s, r) => s + Number(r.games || 0), 0)
  const refTotalGames = refRows.reduce((s, r) => s + Number(r.games || 0), 0)
  return rows.map(row => {
    const ref = refByKey.get(botlaneRowKey(row, mode))
    if (!ref) return row
    const curPick = curTotalGames > 0 ? row.games / curTotalGames : 0
    const refPick = refTotalGames > 0 ? ref.games / refTotalGames : 0
    const patchRefDeltaVsPeersPp =
      row.deltaVsPeersPp != null && ref.deltaVsPeersPp != null
        ? row.deltaVsPeersPp - ref.deltaVsPeersPp
        : undefined
    return {
      ...row,
      patchRefRankDelta: ref.rank - row.rank,
      patchRefWinratePp: (row.winrate - ref.winrate) * 100,
      patchRefScorePp: (row.note - ref.note) * 100,
      patchRefDeltaVsPeersPp,
      patchRefPickratePp: (curPick - refPick) * 100,
      patchRefGamesDelta: row.games - ref.games,
    }
  })
}
