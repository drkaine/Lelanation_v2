export type MatchlistDto = string[];

export interface MatchDto {
  metadata: MatchMetadataDto;
  info: MatchInfoDto;
}

export interface MatchMetadataDto {
  dataVersion: string;
  matchId: string;
  participants: string[];
}

export interface MatchInfoDto {
  gameCreation: number;
  gameDuration: number;
  gameEndTimestamp?: number;
  gameId: number;
  gameMode: string;
  gameName: string;
  gameStartTimestamp: number;
  gameType: string;
  gameVersion: string;
  mapId: number;
  participants: ParticipantDto[];
  platformId: string;
  queueId: number;
  teams: TeamDto[];
  tournamentCode?: string;
  endOfGameResult?: string;
}

export interface TeamDto {
  bans: TeamBanDto[];
  objectives: TeamObjectivesDto;
  teamId: number;
  win: boolean;
}

export interface TeamBanDto {
  championId: number;
  pickTurn: number;
}

export interface TeamObjectivesDto {
  baron: TeamObjectiveDto;
  champion: TeamObjectiveDto;
  dragon: TeamObjectiveDto;
  horde?: TeamObjectiveDto;
  inhibitor: TeamObjectiveDto;
  riftHerald: TeamObjectiveDto;
  tower: TeamObjectiveDto;
}

export interface TeamObjectiveDto {
  first: boolean;
  kills: number;
}

export interface ParticipantDto {
  assists: number;
  baronKills: number;
  bountyLevel: number;
  champExperience: number;
  champLevel: number;
  championId: number;
  championName: string;
  championTransform: number;
  consumablesPurchased: number;
  damageDealtToBuildings: number;
  damageDealtToObjectives: number;
  damageDealtToTurrets: number;
  damageSelfMitigated: number;
  deaths: number;
  detectorWardsPlaced: number;
  doubleKills: number;
  dragonKills: number;
  firstBloodAssist: boolean;
  firstBloodKill: boolean;
  firstTowerAssist: boolean;
  firstTowerKill: boolean;
  gameEndedInEarlySurrender: boolean;
  gameEndedInSurrender: boolean;
  goldEarned: number;
  goldSpent: number;
  individualPosition: string;
  inhibitorKills: number;
  inhibitorTakedowns?: number;
  inhibitorsLost: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  itemsPurchased: number;
  killingSprees: number;
  kills: number;
  lane: string;
  largestCriticalStrike: number;
  largestKillingSpree: number;
  largestMultiKill: number;
  longestTimeSpentLiving: number;
  magicDamageDealt: number;
  magicDamageDealtToChampions: number;
  magicDamageTaken: number;
  missions?: Record<string, number | boolean | string>;
  neutralMinionsKilled: number;
  nexusKills: number;
  nexusTakedowns?: number;
  nexusLost: number;
  objectivesStolen: number;
  objectivesStolenAssists: number;
  participantId: number;
  pentaKills: number;
  perks: PerksDto;
  physicalDamageDealt: number;
  physicalDamageDealtToChampions: number;
  physicalDamageTaken: number;
  profileIcon: number;
  puuid: string;
  quadraKills: number;
  riotIdGameName?: string;
  riotIdTagline?: string;
  role: string;
  sightWardsBoughtInGame: number;
  spell1Casts: number;
  spell2Casts: number;
  spell3Casts: number;
  spell4Casts: number;
  summoner1Casts: number;
  summoner1Id: number;
  summoner2Casts: number;
  summoner2Id: number;
  summonerId: string;
  summonerLevel: number;
  summonerName: string;
  teamEarlySurrendered: boolean;
  teamId: number;
  teamPosition: string;
  timeCCingOthers: number;
  timePlayed: number;
  totalDamageDealt: number;
  totalDamageDealtToChampions: number;
  totalDamageShieldedOnTeammates?: number;
  totalDamageTaken: number;
  totalHeal: number;
  totalHealsOnTeammates?: number;
  totalMinionsKilled: number;
  totalAllyJungleMinionsKilled?: number;
  totalEnemyJungleMinionsKilled?: number;
  totalTimeCCDealt: number;
  totalTimeSpentDead: number;
  totalUnitsHealed?: number;
  /** Variantes possibles selon la version de l’API. */
  totalUnitsHealedToChampions?: number;
  totalUnitsHealedToChampion?: number;
  healFromMapSources?: number;
  damageDealtToEpicMonsters?: number;
  allInPings?: number;
  assistMePings?: number;
  basicPings?: number;
  commandPings?: number;
  dangerPings?: number;
  enemyMissingPings?: number;
  enemyVisionPings?: number;
  getBackPings?: number;
  holdPings?: number;
  needVisionPings?: number;
  onMyWayPings?: number;
  pushPings?: number;
  retreatPings?: number;
  visionClearedPings?: number;
  tripleKills: number;
  trueDamageDealt: number;
  trueDamageDealtToChampions: number;
  trueDamageTaken: number;
  turretKills: number;
  turretTakedowns?: number;
  turretsLost: number;
  unrealKills: number;
  visionScore: number;
  visionWardsBoughtInGame: number;
  wardsKilled: number;
  wardsPlaced: number;
  win: boolean;
  challenges?: ChallengesDto;
}

export interface PerksDto {
  statPerks: {
    defense: number;
    flex: number;
    offense: number;
  };
  styles: Array<{
    description: string;
    selections: Array<{
      perk: number;
      var1: number;
      var2: number;
      var3: number;
    }>;
    style: number;
  }>;
}

export interface ChallengesDto {
  abilityUses?: number;
  acesBefore15Minutes?: number;
  alliedJungleMonsterKills?: number;
  baronBuffGoldAdvantageOverThreshold?: number;
  baronKills?: number;
  blastConeOppositeOpponentCount?: number;
  bountyGold?: number;
  buffsStolen?: number;
  completeSupportQuestInTime?: number;
  controlWardsPlaced?: number;
  damagePerMinute?: number;
  damageTakenOnTeamPercentage?: number;
  dancedWithRiftHerald?: number;
  deathsByEnemyChamps?: number;
  dodgeSkillShotsSmallWindow?: number;
  doubleAces?: number;
  dragonKills?: number;
  earliestBaron?: number;
  earlyLaningPhaseGoldExpAdvantage?: number;
  effectiveHealAndShielding?: number;
  elderDragonKillsWithOpposingSoul?: number;
  elderDragonMultikills?: number;
  enemyChampionImmobilizations?: number;
  enemyJungleMonsterKills?: number;
  epicMonsterKillsNearEnemyJungler?: number;
  epicMonsterKillsWithin30SecondsOfSpawn?: number;
  epicMonsterSteals?: number;
  epicMonsterStolenWithoutSmite?: number;
  firstTurretKilledTime?: number;
  flawlessAces?: number;
  fullTeamTakedown?: number;
  gameLength?: number;
  getTakedownsInAllLanesEarlyJungleAsLaner?: number;
  goldPerMinute?: number;
  hadOpenNexus?: number;
  immobilizeAndKillWithAlly?: number;
  initialBuffCount?: number;
  initialCrabCount?: number;
  jungleCsBefore10Minutes?: number;
  junglerKillsEarlyJungle?: number;
  killsNearEnemyTurret?: number;
  kTurretsDestroyedBeforePlatesFall?: number;
  landSkillShotsEarlyGame?: number;
  laneMinionsFirst10Minutes?: number;
  laningPhaseGoldExpAdvantage?: number;
  legendaryCount?: number;
  lostAnInhibitor?: number;
  maxCsAdvantageOnLaneOpponent?: number;
  maxKillDeficit?: number;
  maxLevelLeadLaneOpponent?: number;
  mejaisFullStackInTime?: number;
  moreEnemyJungleThanOpponent?: number;
  multiKillOneSpell?: number;
  multikills?: number;
  multikillsAfterAggressiveFlash?: number;
  outerTurretExecutesBefore10Minutes?: number;
  outnumberedKills?: number;
  outnumberedNexusKill?: number;
  perfectDragonSoulsTaken?: number;
  perfectGame?: number;
  pickKillWithAlly?: number;
  playedChampSelectPosition?: number;
  poroExplosions?: number;
  quickCleanse?: number;
  quickFirstTurret?: number;
  quickSoloKills?: number;
  riftHeraldTakedowns?: number;
  saveAllyFromDeath?: number;
  scuttleCrabKills?: number;
  shortestTimeToAceFromFirstTakedown?: number;
  skillshotsDodged?: number;
  skillshotsHit?: number;
  soloBaronKills?: number;
  soloKills?: number;
  stealthWardsPlaced?: number;
  survivedSingleDigitHpCount?: number;
  survivedThreeImmobilizesInFight?: number;
  takedownOnFirstTurret?: number;
  takedowns?: number;
  takedownsAfterGainingLevelAdvantage?: number;
  takedownsBeforeJungleMinionSpawn?: number;
  takedownsFirstXMinutes?: number;
  takedownsInAlcove?: number;
  takedownsInEnemyFountain?: number;
  teamBaronKills?: number;
  teamDamagePercentage?: number;
  teamElderDragonKills?: number;
  teamRiftHeraldKills?: number;
  twoWardsOneSweeperCount?: number;
  threeWardsOneSweeperCount?: number;
  tookLargeDamageSurvived?: number;
  turretPlatesTaken?: number;
  turretTakedowns?: number;
  turretsTakenWithRiftHerald?: number;
  twentyMinionsIn3SecondsCount?: number;
  unseenRecalls?: number;
  visionScoreAdvantageLaneOpponent?: number;
  visionScorePerMinute?: number;
  wardTakedowns?: number;
  wardTakedownsBefore20M?: number;
  wardsGuarded?: number;
}

export interface MatchTimelineDto {
  metadata?: MatchMetadataDto;
  info: MatchTimelineInfoDto;
}

export interface MatchTimelineInfoDto {
  frameInterval: number;
  frames: MatchTimelineFrameDto[];
  gameId?: number;
  participants?: MatchTimelineParticipantDto[];
}

export interface MatchTimelineParticipantDto {
  participantId: number;
  puuid: string;
}

export interface MatchTimelineFrameDto {
  events: MatchTimelineEventDto[];
  participantFrames: Record<string, MatchTimelineParticipantFrameDto>;
  timestamp: number;
}

export interface MatchTimelineParticipantFrameDto {
  championStats: Record<string, number>;
  currentGold: number;
  damageStats: Record<string, number>;
  goldPerSecond: number;
  jungleMinionsKilled: number;
  level: number;
  minionsKilled: number;
  participantId: number;
  position?: {
    x: number;
    y: number;
  };
  timeEnemySpentControlled?: number;
  totalGold: number;
  xp: number;
}

export interface MatchTimelineEventDto {
  type: string;
  timestamp: number;
  participantId?: number;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  teamId?: number;
  skillSlot?: number;
  levelUpType?: string;
  itemId?: number;
  beforeId?: number;
  afterId?: number;
  goldGain?: number;
  killType?: string;
  laneType?: string;
  towerType?: string;
  buildingType?: string;
  monsterType?: string;
  monsterSubType?: string;
  creatorId?: number;
  wardType?: string;
  bounty?: number;
  realTimestamp?: number;
  winningTeam?: number;
  [key: string]: unknown;
}

/**
 * Riot `GET /lol/league/v4/entries/by-puuid/{encryptedPuuid}` — une entrée par file (solo = RANKED_SOLO_5x5).
 */
export interface RankDto {
  leagueId: string;
  queueType: string;
  tier: string;
  rank: string;
  summonerId: string;
  summonerName: string;
  leaguePoints: number;
  wins: number;
  losses: number;
  veteran: boolean;
  inactive: boolean;
  freshBlood: boolean;
  hotStreak: boolean;
  miniSeries?: {
    losses: number;
    progress: string;
    target: number;
    wins: number;
  };
}
