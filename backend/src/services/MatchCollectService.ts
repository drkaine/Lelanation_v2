/**
 * Persists Riot Match v5 data into PostgreSQL. Queue 420 only. Region euw1/eun1.
 */
import { prisma } from '../db.js'
import type { MatchSummary } from './RiotApiService.js'

const QUEUE_ID_420 = 420

/** Raw participant from Riot (loose type for item0..item6, perks) */
interface RiotParticipant {
  puuid: string
  summonerId?: string
  championId: number
  teamId: number
  win: boolean
  teamPosition?: string
  individualPosition?: string
  kills?: number
  deaths?: number
  assists?: number
  item0?: number
  item1?: number
  item2?: number
  item3?: number
  item4?: number
  item5?: number
  item6?: number
  perks?: unknown
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
  const gameCreation =
    typeof info.gameCreation === 'number' ? BigInt(info.gameCreation) : null
  const gameDuration = typeof info.gameDuration === 'number' ? info.gameDuration : null
  const participants = Array.isArray(info.participants) ? info.participants : []

  const match = await prisma.match.create({
    data: {
      matchId,
      region,
      queueId: QUEUE_ID_420,
      gameVersion: gameVersion ?? null,
      gameCreation,
      gameDuration,
      platformId: region,
    },
  })

  const createMany = participants.map((p: RiotParticipant) => {
    const role = normalizeRole(p.teamPosition, p.individualPosition)
    const items = itemsArray(p)
    return {
      matchId: match.id,
      puuid: p.puuid ?? '',
      summonerId: p.summonerId ?? null,
      championId: p.championId ?? 0,
      win: Boolean(p.win),
      role,
      lane: null,
      teamPosition: p.teamPosition ?? p.individualPosition ?? null,
      rankTier: null,
      rankDivision: null,
      rankLp: null,
      items: items.length ? items : undefined,
      runes: p.perks ?? undefined,
      summonerSpells:
        p.summoner1Id != null && p.summoner2Id != null
          ? [String(p.summoner1Id), String(p.summoner2Id)]
          : undefined,
      kills: typeof p.kills === 'number' ? p.kills : 0,
      deaths: typeof p.deaths === 'number' ? p.deaths : 0,
      assists: typeof p.assists === 'number' ? p.assists : 0,
    }
  })

  await prisma.participant.createMany({ data: createMany })
  return { matchId, inserted: true }
}

export async function hasMatch(matchId: string): Promise<boolean> {
  const m = await prisma.match.findUnique({ where: { matchId }, select: { id: true } })
  return Boolean(m)
}
