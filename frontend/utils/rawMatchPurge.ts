export type RawMatchPurgePreview = {
  matchesToDelete: number
  matchesKept: number
  rankHistoryToDelete: number
}

export type RawMatchPurgeStatus = {
  state: 'idle' | 'running' | 'done' | 'error'
  cutoffDate?: string
  compact?: boolean
  startedAt?: string
  finishedAt?: string
  progress?: {
    phase: 'matches' | 'rank_history' | 'compact'
    deletedMatches: number
    deletedRankHistory: number
  }
  result?: { deletedMatches: number; deletedRankHistory: number; compactedTables: string[] }
  error?: string
}

const nf = new Intl.NumberFormat('fr-FR')

export function defaultPurgeCutoffDate(now: Date = new Date()): string {
  return `${now.toISOString().slice(0, 7)}-01`
}

export function purgeConfirmMessage(date: string, p: RawMatchPurgePreview): string {
  return (
    `Supprimer définitivement les données brutes avant le ${date} ?\n` +
    `- ${nf.format(p.matchesToDelete)} matchs (et leurs participants / teams)\n` +
    `- ${nf.format(p.rankHistoryToDelete)} lignes d'historique de rang\n` +
    `Conservés : ${nf.format(p.matchesKept)} matchs. Agrégats non touchés.`
  )
}

export function purgeProgressLabel(s: RawMatchPurgeStatus): string {
  if (s.state === 'idle') return 'Aucune purge lancée'
  if (s.state === 'error') return `Erreur : ${s.error ?? 'inconnue'}`
  if (s.state === 'done') {
    const r = s.result
    const compacted = r?.compactedTables.length
      ? ` · compacté : ${r.compactedTables.join(', ')}`
      : ''
    return `Terminé (${s.cutoffDate}) : ${nf.format(r?.deletedMatches ?? 0)} matchs, ${nf.format(r?.deletedRankHistory ?? 0)} rangs supprimés${compacted}`
  }
  const p = s.progress
  const phase =
    p?.phase === 'compact'
      ? 'compactage (VACUUM FULL)'
      : p?.phase === 'rank_history'
        ? 'historique de rang'
        : 'matchs'
  return `En cours — ${phase} : ${nf.format(p?.deletedMatches ?? 0)} matchs, ${nf.format(p?.deletedRankHistory ?? 0)} rangs supprimés`
}
