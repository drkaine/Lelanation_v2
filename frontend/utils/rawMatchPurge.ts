export type RawMatchPurgePreview = {
  matchesToDelete: number
  matchesKept: number
  rankHistoryToDelete: number
}

export type RawMatchPurgeStatus = {
  state: 'idle' | 'running' | 'done' | 'error'
  cutoffDate?: string
  startedAt?: string
  finishedAt?: string
  progress?: {
    phase: 'stop_poller' | 'rank_history' | 'matches' | 'start_poller'
    deletedMatches: number
    deletedRankHistory: number
  }
  result?: { deletedMatches: number; deletedRankHistory: number }
  error?: string
}

const nf = new Intl.NumberFormat('fr-FR')

const PHASE_LABELS: Record<NonNullable<RawMatchPurgeStatus['progress']>['phase'], string> = {
  stop_poller: 'arrêt du poller',
  rank_history: 'historique de rang (export, vidage, réimport)',
  matches: 'matchs, participants, teams (export, vidage, réimport)',
  start_poller: 'relance du poller',
}

export function defaultPurgeCutoffDate(now: Date = new Date()): string {
  return `${now.toISOString().slice(0, 7)}-01`
}

export function purgeConfirmMessage(date: string, p: RawMatchPurgePreview): string {
  return (
    `Supprimer définitivement les données brutes avant le ${date} ?\n` +
    `- ${nf.format(p.matchesToDelete)} matchs (et leurs participants / teams)\n` +
    `- ${nf.format(p.rankHistoryToDelete)} lignes d'historique de rang\n` +
    `Conservés : ${nf.format(p.matchesKept)} matchs. Agrégats non touchés.\n` +
    `Le poller est arrêté pendant la purge puis relancé.`
  )
}

export function purgeProgressLabel(s: RawMatchPurgeStatus): string {
  if (s.state === 'idle') return 'Aucune purge lancée'
  if (s.state === 'error') return `Erreur : ${s.error ?? 'inconnue'}`
  if (s.state === 'done') {
    const r = s.result
    return `Terminé (${s.cutoffDate}) : ${nf.format(r?.deletedMatches ?? 0)} matchs, ${nf.format(r?.deletedRankHistory ?? 0)} rangs supprimés`
  }
  return `En cours — ${PHASE_LABELS[s.progress?.phase ?? 'stop_poller']}`
}
