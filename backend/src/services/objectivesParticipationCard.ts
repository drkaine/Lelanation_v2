/**
 * Carte « Participation aux objectifs » : uniquement des challenges Riot réellement persistés
 * (`champion_stats`). Les compteurs timeline (kills / assists dragon, héraut, grubs, inhib, tours)
 * ne sont pas remplis : pas de « solo » dérivé d'eux.
 */
export type ParticipationCard = {
  stealPct: number
  stealWithSmitePct: number
  stealWithoutSmitePct: number
  /** Barons tués seul (challenge `soloBaronKills`). */
  soloBaronPct: number
  /** Kills en 1v1 (challenge `soloKills`). */
  soloKillPct: number
}

export type ParticipationRow = Partial<Record<string, bigint | number | null>>

/** Événements pour 100 parties, plafonné à 100 (une ligne agrégée ne dit pas combien de parties en ont eu ≥ 1). */
function perGamePct(events: number, games: number): number {
  if (games <= 0 || events <= 0) return 0
  return Number(((100 * Math.min(games, events)) / games).toFixed(2))
}

export function buildParticipationCard(
  row: ParticipationRow | undefined,
  games: number,
): ParticipationCard {
  const n = (k: string): number => Number(row?.[k] ?? 0)
  const epicSteals = n('sum_epic_monster_steals')
  const steals = epicSteals > 0 ? epicSteals : n('sum_objectives_stolen')
  const noSmite = Math.min(steals, n('sum_epic_monster_stolen_without_smite'))
  return {
    stealPct: perGamePct(steals, games),
    stealWithSmitePct: perGamePct(steals - noSmite, games),
    stealWithoutSmitePct: perGamePct(noSmite, games),
    soloBaronPct: perGamePct(n('sum_solo_baron_kills'), games),
    soloKillPct: perGamePct(n('sum_solo_kills'), games),
  }
}
