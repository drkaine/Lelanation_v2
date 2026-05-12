export interface DiscoveryJobData {
  puuid: string;
  region: string;
}

export interface HydrationJobData {
  matchId: string;
  region: string;
  puuid: string;
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
  role: string;
  championId: number;
  teamId: 100 | 200;
  win: boolean;

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
