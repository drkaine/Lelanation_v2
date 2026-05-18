export interface DiscoveryJobData {
  puuid: string;
  region: string;
}

export interface HydrationJobData {
  matchId: string;
  region: string;
  puuid: string;
}

export interface RankJobData {
  puuid: string;
  region: string;
  matchDate: string;
}

export interface ParsedItemDto {
  itemId: number;
  phase: "starter" | "core" | "final";
  timestampMs: number;
  win: boolean;
}

export interface ParsedUnder15Dto {
  goldEarned: number;
  cs: number;
  kills: number;
  deaths: number;
  assists: number;
  visionScore: number;
  physDmgToChampion: number;
  magicDmgToChampion: number;
  trueDmgToChampion: number;
  shieldAndHeal: number;
}

export interface ParsedParticipantDto {
  // Identite
  matchId: string;
  puuid: string;
  patch: string;
  gameDate: string;
  gameEndTimestamp: number;
  region: string;
  rankTier: string;
  /** true → rank worker doit appeler League v4 (pas de snapshot du jour en DB). */
  needsRankFetch: boolean;
  role: string;
  championId: number;
  teamId: 100 | 200;
  win: boolean;

  /** Flags match-v5 (stats champion agrégées / first blood). */
  firstBloodKill: boolean;
  firstBloodAssist: boolean;
  firstTowerKill: boolean;
  firstTowerAssist: boolean;
  gameEndedInEarlySurrender: boolean;
  gameEndedInSurrender: boolean;
  teamEarlySurrendered: boolean;

  // Stats combat
  kills: number;
  deaths: number;
  assists: number;
  goldEarned: number;
  goldSpent: number;
  // ... toutes les colonnes de champion_stats
  [championStatsColumn: string]: unknown;

  // Donnees matchup
  opponentChampionId: number;
  opponentRole: string;

  // Ordre de level up
  spellOrder: string;
  /** Casts Q/W/E/R (champion spells, match-v5 `spell1Casts`…`spell4Casts`). */
  spell1Casts: number;
  spell2Casts: number;
  spell3Casts: number;
  spell4Casts: number;
  /** Somme des `event.timestamp` (ms depuis le début de partie) pour chaque SKILL_LEVEL_UP Q/W/E/R (slots 1–4). */
  spellLevelUpTimestampSumMs: number;

  // Sets d'items
  starterKey: string;
  coreKey: string;
  materialKey: string;
  bootsKey: string;
  finalKey: string;

  // Items individuels avec timestamps
  items: ParsedItemDto[];

  // Runes
  runeList: string;
  shardList: string;
  perks: number[];

  // Sorts d'invocateur
  spellD: number;
  spellF: number;
  spellDCasts: number;
  spellFCasts: number;

  // Rank snapshot
  rankTierValue: string;
  rankDivision: string;
  lp: number;

  // Bans
  bannedChampionId: number;
  pickOrder: number;

  // Donnees timeline
  u15: ParsedUnder15Dto;
}

export interface TeamObjectiveDto {
  type: string;
  count: number;
  team: 100 | 200;
  outcome: "win" | "loss";
  /** Somme des `event.timestamp` (ms depuis le début de partie) pour ce type d’objectif, d’après la timeline. */
  sumTimestampMs: number;
}

export interface TeamStatsDto {
  matchId: string;
  patch: string;
  rankTier: string;
  region: string;
  team100Win: boolean;
  objectives: TeamObjectiveDto[];
  surrendered: boolean;
  earlySurrendered: boolean;
}

export interface IngestionJobData {
  participants: ParsedParticipantDto[];
  teamStats: TeamStatsDto;
}
