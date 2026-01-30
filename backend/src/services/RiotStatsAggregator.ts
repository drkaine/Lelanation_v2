/**
 * Service pour agréger les statistiques LoL depuis les données Riot API.
 * TODO: Implémenter la collecte et l'agrégation des données de matchs.
 */
export interface ChampionStats {
  championId: number
  games: number
  wins: number
  winrate: number
  pickrate: number
  byRole?: Record<string, {
    games: number
    wins: number
    winrate: number
  }>
}

export interface AggregatedStats {
  totalGames: number
  champions: ChampionStats[]
  generatedAt: string | null
}

export class RiotStatsAggregator {
  /**
   * Charge les statistiques agrégées depuis le stockage.
   * TODO: Implémenter le chargement depuis un fichier JSON ou base de données.
   */
  async load(): Promise<AggregatedStats | null> {
    // Stub: retourne null pour l'instant
    // TODO: Charger depuis data/stats.json ou base de données
    return null
  }

  /**
   * Calcule et sauvegarde les agrégats depuis les données brutes.
   * TODO: Implémenter l'agrégation depuis les matchs collectés.
   */
  async computeAndSave(): Promise<AggregatedStats> {
    // Stub: retourne des données vides pour l'instant
    // TODO: Implémenter l'agrégation réelle
    return {
      totalGames: 0,
      champions: [],
      generatedAt: new Date().toISOString(),
    }
  }
}
