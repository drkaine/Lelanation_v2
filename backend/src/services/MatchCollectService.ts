/**
 * Persists Riot Match v5 data into PostgreSQL. Queue 420 only. Region euw1/eun1.
00 * Optionally accepts rankByPuuid (rangs récupérés en parallèle) pour créer match + participants avec rangs en une fois.
 */
import { prisma } from '../db.js'
import type { MatchSummary } from './RiotApiService.js'
import { ingestMatchupTierScoresFromMatch } from './MatchupTierService.js'
import {
  computeMatchRankLabel,
  UNRANKED_TIER,
  type RankEntry,
} from './StatsPlayersRefreshService.js'

const QUEUE_ID_420 = 420

/** Raw participant from Riot (loose type; API returns full Match-v5 payload). */
interface RiotParticipant {
  puuid: string
  championId: number
  teamId?: number
  win: boolean
  teamPosition?: string
  individualPosition?: string
  kills?: number
  deaths?: number
  assists?: number
  champLevel?: number
  goldEarned?: number
  goldSpent?: number
  totalDamageDealtToChampions?: number
  totalMinionsKilled?: number
  visionScore?: number
  firstBloodKill?: boolean
  firstBloodAssist?: boolean
  firstTowerAssist?: boolean
  firstTowerKill?: boolean
  gameEndedInSurrender?: boolean
  gameEndedInEarlySurrender?: boolean
  teamEarlySurrendered?: boolean
  riotIdGameName?: string
  riotIdTagline?: string
  baronKills?: number
  consumablesPurchased?: number
  damageDealtToBuildings?: number
  damageDealtToEpicMonsters?: number
  damageDealtToObjectives?: number
  damageDealtToTurrets?: number
  damageSelfMitigated?: number
  doubleKills?: number
  dragonKills?: number
  inhibitorKills?: number
  inhibitorTakedowns?: number
  inhibitorsLost?: number
  itemsPurchased?: number
  killingSprees?: number
  largestCriticalStrike?: number
  largestKillingSpree?: number
  largestMultiKill?: number
  longestTimeSpentLiving?: number
  magicDamageDealt?: number
  magicDamageDealtToChampions?: number
  magicDamageTaken?: number
  neutralMinionsKilled?: number
  objectivesStolen?: number
  objectivesStolenAssists?: number
  pentaKills?: number
  physicalDamageDealt?: number
  physicalDamageDealtToChampions?: number
  physicalDamageTaken?: number
  placement?: number
  quadraKills?: number
  roleBoundItem?: number
  sightWardsBoughtInGame?: number
  spell1Casts?: number
  spell2Casts?: number
  spell3Casts?: number
  spell4Casts?: number
  summoner1Casts?: number
  summoner2Casts?: number
  timeCCingOthers?: number
  totalAllyJungleMinionsKilled?: number
  totalDamageDealt?: number
  totalDamageShieldedOnTeammates?: number
  totalDamageTaken?: number
  totalEnemyJungleMinionsKilled?: number
  totalHeal?: number
  totalHealsOnTeammates?: number
  totalTimeCCDealt?: number
  totalTimeSpentDead?: number
  totalUnitsHealed?: number
  tripleKills?: number
  trueDamageDealt?: number
  trueDamageDealtToChampions?: number
  trueDamageTaken?: number
  turretKills?: number
  turretTakedowns?: number
  turretsLost?: number
  unrealKills?: number
  visionWardsBoughtInGame?: number
  wardsKilled?: number
  wardsPlaced?: number
  item0?: number
  item1?: number
  item2?: number
  item3?: number
  item4?: number
  item5?: number
  item6?: number
  perks?: { statPerks?: { defense?: number; flex?: number; offense?: number }; styles?: unknown }
  challenges?: unknown
  summoner1Id?: number
  summoner2Id?: number
}

function num(p: RiotParticipant, key: keyof RiotParticipant): number | undefined {
  const v = p[key]
  return typeof v === 'number' ? v : undefined
}
function bool(p: RiotParticipant, key: keyof RiotParticipant): boolean | undefined {
  const v = p[key]
  return typeof v === 'boolean' ? v : undefined
}

function normalizeRole(teamPosition?: string, individualPosition?: string): string | null {
  const pos = teamPosition ?? individualPosition ?? ''
  if (!pos || pos === 'Invalid' || pos === '') return null
  const upper = pos.toUpperCase()
  if (['TOP', 'JUNGLE', 'MIDDLE', 'MID', 'BOTTOM', 'BOT', 'UTILITY'].includes(upper)) {
    if (upper === 'MID') return 'MIDDLE'
    if (upper === 'BOT') return 'BOTTOM'
    return upper
  }
  return null
}

function itemsArray(p: RiotParticipant): number[] {
  const arr: number[] = []
  for (let i = 0; i <= 6; i++) {
    const key = `item${i}` as keyof RiotParticipant
    const v = p[key]
    if (typeof v === 'number' && v !== 0) arr.push(v)
  }
  return arr
}

export async function upsertMatchFromRiot(
  region: string,
  data: MatchSummary,
  rankByPuuid?: Map<string, RankEntry | null>
): Promise<{ matchId: string; inserted: boolean }> {
  const matchId = data.metadata?.matchId
  if (!matchId) throw new Error('Missing metadata.matchId')

  const info = data.info
  if (!info || info.queueId !== QUEUE_ID_420) {
    throw new Error(`Not Ranked Solo/Duo: queueId=${info?.queueId}`)
  }

  const existing = await prisma.match.findUnique({ where: { matchId }, select: { id: true } })
  if (existing) {
    return { matchId, inserted: false }
  }

  const gameVersion =
    typeof info.gameVersion === 'string' ? info.gameVersion : undefined
  const gameDuration = typeof info.gameDuration === 'number' ? info.gameDuration : null
  const infoExt = info as unknown as { endOfGameResult?: string; teams?: unknown }
  const endOfGameResult =
    typeof infoExt.endOfGameResult === 'string' ? infoExt.endOfGameResult : null
  const teams = Array.isArray(infoExt.teams) ? (infoExt.teams as object) : null
  const participants = Array.isArray(info.participants) ? info.participants : []

  const matchRank =
    rankByPuuid != null && rankByPuuid.size > 0 ? computeMatchRankLabel(rankByPuuid) : null

  let match: { id: bigint }
  try {
    match = await prisma.match.create({
      data: {
        matchId,
        region,
        queueId: QUEUE_ID_420,
        gameVersion: gameVersion ?? null,
        gameDuration,
        platformId: region,
        endOfGameResult: endOfGameResult ?? null,
        teams: teams ?? undefined,
        rank: matchRank,
      },
    })
  } catch (e) {
    const err = e as { code?: string }
    if (err?.code === 'P2002') {
      return { matchId, inserted: false }
    }
    throw e
  }

  // POST /admin/backfill-participant-ranks; the cron can also run a limited backfill after collect.
  const createMany = participants.map((p: RiotParticipant) => {
    const puuid = p.puuid ?? ''
    const entry = rankByPuuid?.get(puuid)
    const rankTier = entry ? entry.tier : entry === null ? UNRANKED_TIER : null
    const rankDivision = entry ? entry.rank : undefined
    const rankLp = entry ? entry.leaguePoints : undefined
    const role = normalizeRole(p.teamPosition, p.individualPosition)
    const items = itemsArray(p)
    const perks = p.perks
    const statPerks =
      perks?.statPerks &&
      typeof perks.statPerks === 'object' &&
      Object.keys(perks.statPerks).length > 0
        ? (perks.statPerks as object)
        : undefined
    const runes = perks?.styles != null ? (perks.styles as object) : (p.perks as unknown) ?? undefined
    const teamId = p.teamId === 100 || p.teamId === 200 ? p.teamId : null
    return {
      matchId: match.id,
      teamId,
      puuid,
      championId: p.championId ?? 0,
      win: Boolean(p.win),
      role,
      rankTier,
      rankDivision: rankDivision ?? null,
      rankLp: rankLp ?? null,
      kills: typeof p.kills === 'number' ? p.kills : 0,
      deaths: typeof p.deaths === 'number' ? p.deaths : 0,
      assists: typeof p.assists === 'number' ? p.assists : 0,
      champLevel: typeof p.champLevel === 'number' ? p.champLevel : undefined,
      goldEarned: typeof p.goldEarned === 'number' ? p.goldEarned : undefined,
      totalDamageDealtToChampions:
        typeof p.totalDamageDealtToChampions === 'number'
          ? p.totalDamageDealtToChampions
          : undefined,
      totalMinionsKilled:
        typeof p.totalMinionsKilled === 'number' ? p.totalMinionsKilled : undefined,
      visionScore: typeof p.visionScore === 'number' ? p.visionScore : undefined,
      firstBloodKill:
        typeof p.firstBloodKill === 'boolean' ? p.firstBloodKill : undefined,
      firstBloodAssist:
        typeof p.firstBloodAssist === 'boolean' ? p.firstBloodAssist : undefined,
      gameEndedInSurrender: bool(p, 'gameEndedInSurrender'),
      gameEndedInEarlySurrender: bool(p, 'gameEndedInEarlySurrender'),
      teamEarlySurrendered: bool(p, 'teamEarlySurrendered'),
      firstTowerAssist: bool(p, 'firstTowerAssist'),
      firstTowerKill: bool(p, 'firstTowerKill'),
      baronKills: num(p, 'baronKills'),
      consumablesPurchased: num(p, 'consumablesPurchased'),
      damageDealtToBuildings: num(p, 'damageDealtToBuildings'),
      damageDealtToEpicMonsters: num(p, 'damageDealtToEpicMonsters'),
      damageDealtToObjectives: num(p, 'damageDealtToObjectives'),
      damageDealtToTurrets: num(p, 'damageDealtToTurrets'),
      damageSelfMitigated: num(p, 'damageSelfMitigated'),
      doubleKills: num(p, 'doubleKills'),
      dragonKills: num(p, 'dragonKills'),
      goldSpent: num(p, 'goldSpent'),
      inhibitorKills: num(p, 'inhibitorKills'),
      inhibitorTakedowns: num(p, 'inhibitorTakedowns'),
      inhibitorsLost: num(p, 'inhibitorsLost'),
      itemsPurchased: num(p, 'itemsPurchased'),
      killingSprees: num(p, 'killingSprees'),
      largestCriticalStrike: num(p, 'largestCriticalStrike'),
      largestKillingSpree: num(p, 'largestKillingSpree'),
      largestMultiKill: num(p, 'largestMultiKill'),
      longestTimeSpentLiving: num(p, 'longestTimeSpentLiving'),
      magicDamageDealt: num(p, 'magicDamageDealt'),
      magicDamageDealtToChampions: num(p, 'magicDamageDealtToChampions'),
      magicDamageTaken: num(p, 'magicDamageTaken'),
      neutralMinionsKilled: num(p, 'neutralMinionsKilled'),
      objectivesStolen: num(p, 'objectivesStolen'),
      objectivesStolenAssists: num(p, 'objectivesStolenAssists'),
      pentaKills: num(p, 'pentaKills'),
      physicalDamageDealt: num(p, 'physicalDamageDealt'),
      physicalDamageDealtToChampions: num(p, 'physicalDamageDealtToChampions'),
      physicalDamageTaken: num(p, 'physicalDamageTaken'),
      placement: num(p, 'placement'),
      quadraKills: num(p, 'quadraKills'),
      roleBoundItem: num(p, 'roleBoundItem'),
      sightWardsBoughtInGame: num(p, 'sightWardsBoughtInGame'),
      timeCCingOthers: num(p, 'timeCCingOthers'),
      totalAllyJungleMinionsKilled: num(p, 'totalAllyJungleMinionsKilled'),
      totalDamageDealt: num(p, 'totalDamageDealt'),
      totalDamageShieldedOnTeammates: num(p, 'totalDamageShieldedOnTeammates'),
      totalDamageTaken: num(p, 'totalDamageTaken'),
      totalEnemyJungleMinionsKilled: num(p, 'totalEnemyJungleMinionsKilled'),
      totalHeal: num(p, 'totalHeal'),
      totalHealsOnTeammates: num(p, 'totalHealsOnTeammates'),
      totalTimeCCDealt: num(p, 'totalTimeCCDealt'),
      totalTimeSpentDead: num(p, 'totalTimeSpentDead'),
      totalUnitsHealed: num(p, 'totalUnitsHealed'),
      tripleKills: num(p, 'tripleKills'),
      trueDamageDealt: num(p, 'trueDamageDealt'),
      trueDamageDealtToChampions: num(p, 'trueDamageDealtToChampions'),
      trueDamageTaken: num(p, 'trueDamageTaken'),
      turretKills: num(p, 'turretKills'),
      turretTakedowns: num(p, 'turretTakedowns'),
      turretsLost: num(p, 'turretsLost'),
      unrealKills: num(p, 'unrealKills'),
      visionWardsBoughtInGame: num(p, 'visionWardsBoughtInGame'),
      wardsKilled: num(p, 'wardsKilled'),
      wardsPlaced: num(p, 'wardsPlaced'),
      spell1Casts: num(p, 'spell1Casts'),
      spell2Casts: num(p, 'spell2Casts'),
      spell3Casts: num(p, 'spell3Casts'),
      spell4Casts: num(p, 'spell4Casts'),
      summoner1Casts: num(p, 'summoner1Casts'),
      summoner2Casts: num(p, 'summoner2Casts'),
      statPerks,
      items: items.length ? items : undefined,
      runes,
      summonerSpells:
        p.summoner1Id != null && p.summoner2Id != null
          ? [String(p.summoner1Id), String(p.summoner2Id)]
          : undefined,
      challenges: p.challenges ?? undefined,
    }
  })

  await prisma.participant.createMany({ data: createMany })

  // Non-blocking matchup score aggregation used by admin tier-list analytics.
  void ingestMatchupTierScoresFromMatch({
    gameVersion: gameVersion ?? null,
    matchRank: matchRank,
    participants: participants as RiotParticipant[],
  }).catch((err) => {
    console.warn('[matchup-tier] ingest failed for', matchId, err instanceof Error ? err.message : err)
  })

  // Remplir Player.summoner_name depuis riotIdGameName#riotIdTagline (nouveau player ou summoner_name vide) — évite appel Account-V1.
  await upsertPlayersSummonerNameFromParticipants(region, participants as RiotParticipant[])

  return { matchId, inserted: true }
}

/** Format Riot ID pour affichage (gameName#tagline). */
function formatRiotId(gameName?: string, tagline?: string): string | null {
  if (typeof gameName !== 'string' || gameName === '') return null
  const tag = typeof tagline === 'string' && tagline !== '' ? tagline : ''
  return tag ? `${gameName}#${tag}` : gameName
}

/**
 * Upsert Player: créer si absent, remplir summoner_name depuis riotIdGameName#riotIdTagline quand nouveau ou vide.
 * total_games/total_wins : via vue players_with_stats (agrégation depuis participants).
 */
async function upsertPlayersSummonerNameFromParticipants(
  region: string,
  participants: RiotParticipant[]
): Promise<void> {
  const puuids = [...new Set(participants.map((p) => p.puuid).filter(Boolean))]
  if (puuids.length === 0) return

  const existing = await prisma.player.findMany({
    where: { puuid: { in: puuids } },
    select: { puuid: true, summonerName: true },
  })
  const emptySummonerName = new Set(
    existing.filter((p) => p.summonerName == null || p.summonerName === '').map((p) => p.puuid)
  )
  const seen = new Set<string>()

  for (const p of participants) {
    if (!p.puuid || seen.has(p.puuid)) continue
    seen.add(p.puuid)
    const summonerName = formatRiotId(p.riotIdGameName, p.riotIdTagline)
    const fillName = emptySummonerName.has(p.puuid) && summonerName != null ? summonerName : undefined
    await prisma.player.upsert({
      where: { puuid: p.puuid },
      create: {
        puuid: p.puuid,
        region,
        summonerName: summonerName ?? undefined,
        lastSeen: new Date(),
      },
      update: {
        lastSeen: new Date(),
        ...(fillName != null ? { summonerName: fillName } : {}),
      },
    })
  }
}

export async function hasMatch(matchId: string): Promise<boolean> {
  const m = await prisma.match.findUnique({ where: { matchId }, select: { id: true } })
  return Boolean(m)
}
