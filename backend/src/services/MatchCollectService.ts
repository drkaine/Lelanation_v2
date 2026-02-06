/**
 * Persists Riot Match v5 data into PostgreSQL. Queue 420 only. Region euw1/eun1.
 */
import { prisma } from '../db.js'
import type { MatchSummary } from './RiotApiService.js'

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
  totalDamageDealtToChampions?: number
  totalMinionsKilled?: number
  visionScore?: number
  firstBloodKill?: boolean
  firstBloodAssist?: boolean
  gameEndedInSurrender?: boolean
  riotIdGameName?: string
  riotIdTagline?: string
  spell1Casts?: number
  spell2Casts?: number
  spell3Casts?: number
  spell4Casts?: number
  summoner1Casts?: number
  summoner2Casts?: number
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
  region: 'euw1' | 'eun1',
  data: MatchSummary
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

  const match = await prisma.match.create({
    data: {
      matchId,
      region,
      queueId: QUEUE_ID_420,
      gameVersion: gameVersion ?? null,
      gameDuration,
      platformId: region,
      endOfGameResult: endOfGameResult ?? null,
      teams: teams ?? undefined,
      rank: null,
    },
  })

  // Rank (rankTier, rankDivision, rankLp) is never in Match-v5 payload. It is filled later by
  // backfillParticipantRanks (Riot League API by puuid). Run npm run riot:backfill-ranks or
  // POST /admin/backfill-participant-ranks; the cron can also run a limited backfill after collect.
  const createMany = participants.map((p: RiotParticipant) => {
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
    return {
      matchId: match.id,
      puuid: p.puuid ?? '',
      championId: p.championId ?? 0,
      win: Boolean(p.win),
      role,
      rankTier: null,
      rankDivision: null,
      rankLp: null,
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
      gameEndedInSurrender:
        typeof p.gameEndedInSurrender === 'boolean' ? p.gameEndedInSurrender : undefined,
      spell1Casts: typeof p.spell1Casts === 'number' ? p.spell1Casts : undefined,
      spell2Casts: typeof p.spell2Casts === 'number' ? p.spell2Casts : undefined,
      spell3Casts: typeof p.spell3Casts === 'number' ? p.spell3Casts : undefined,
      spell4Casts: typeof p.spell4Casts === 'number' ? p.spell4Casts : undefined,
      summoner1Casts: typeof p.summoner1Casts === 'number' ? p.summoner1Casts : undefined,
      summoner2Casts: typeof p.summoner2Casts === 'number' ? p.summoner2Casts : undefined,
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
 * totalGames/totalWins restent gérés par refreshPlayersAndChampionStats (agrégation sur tous les participants).
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
        totalGames: 0,
        totalWins: 0,
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
