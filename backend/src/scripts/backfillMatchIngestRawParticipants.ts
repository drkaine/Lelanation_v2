import 'dotenv/config'
import { prisma } from '../db.js'
import { Prisma } from '../generated/prisma/index.js'
import type { RiotParticipantDto } from '../services/RiotHttpClient.js'

type RawRow = {
  id: bigint
  riot_match_id: string
  payload_json: unknown
}

function parseParticipants(payload: unknown): RiotParticipantDto[] {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
  const info = (payload as Record<string, unknown>).info
  if (!info || typeof info !== 'object' || Array.isArray(info)) return []
  const participants = (info as Record<string, unknown>).participants
  return Array.isArray(participants) ? (participants as RiotParticipantDto[]) : []
}

function participantNames(part: RiotParticipantDto): { gameName: string | null; tagName: string | null } {
  const gameName = (
    (part.riotIdGameName as string | undefined) ??
    (part.riotIdName as string | undefined) ??
    ''
  )
    .trim()
    .toLowerCase()
  const tagName = (
    (part.riotIdTagline as string | undefined) ??
    (part.riotIdTagLine as string | undefined) ??
    ''
  )
    .trim()
    .toLowerCase()
  return {
    gameName: gameName || null,
    tagName: tagName || null,
  }
}

async function main(): Promise<void> {
  const batchSize = Math.max(50, Math.min(5_000, Number(process.env.BACKFILL_RAW_PARTICIPANTS_BATCH ?? 500)))
  const defaultRegion = (process.env.MATCH_REGION ?? 'euw1').toLowerCase()
  console.log('[backfill-raw-participants] batchSize:', batchSize)

  let lastId = 0n
  let scannedRows = 0
  let participantsSeen = 0
  let createdPlayers = 0
  let updatedPlayers = 0

  while (true) {
    const rows = await prisma.$queryRawUnsafe<RawRow[]>(`
      SELECT id, riot_match_id, payload_json
      FROM match_ingest_raw
      WHERE id > ${lastId.toString()}
      ORDER BY id ASC
      LIMIT ${batchSize}
    `)
    if (rows.length === 0) break

    for (const row of rows) {
      scannedRows++
      lastId = row.id
      const participants = parseParticipants(row.payload_json)
      if (participants.length === 0) continue

      const puuids = participants.map((p) => p.puuid).filter((p): p is string => typeof p === 'string' && p.length > 0)
      if (puuids.length === 0) continue

      const existing = await prisma.player.findMany({
        where: { puuid: { in: puuids } },
        select: { id: true, puuid: true, gameName: true, tagName: true },
      })
      const existingByPuuid = new Map(existing.map((p) => [p.puuid, p]))

      for (const part of participants) {
        const puuid = typeof part.puuid === 'string' ? part.puuid : ''
        if (!puuid) continue
        participantsSeen++
        const { gameName, tagName } = participantNames(part)
        const known = existingByPuuid.get(puuid)
        if (!known) {
          try {
            await prisma.player.create({
              data: {
                puuid,
                region: defaultRegion,
                puuidKeyVersion: 'perso',
                gameName,
                tagName,
                lastSeen: null,
              },
            })
            createdPlayers++
          } catch (error) {
            if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
              throw error
            }
          }
          continue
        }

        const patch: { gameName?: string | null; tagName?: string | null } = {}
        if (gameName && gameName !== known.gameName) patch.gameName = gameName
        if (tagName && tagName !== known.tagName) patch.tagName = tagName
        if (Object.keys(patch).length > 0) {
          await prisma.player.update({ where: { id: known.id }, data: patch })
          updatedPlayers++
        }
      }
    }

    console.log(
      `[backfill-raw-participants] scanned=${scannedRows} participants=${participantsSeen} created=${createdPlayers} updated=${updatedPlayers}`
    )
  }

  console.log('[backfill-raw-participants] done')
  console.log('[backfill-raw-participants] scannedRows=', scannedRows)
  console.log('[backfill-raw-participants] participantsSeen=', participantsSeen)
  console.log('[backfill-raw-participants] createdPlayers=', createdPlayers)
  console.log('[backfill-raw-participants] updatedPlayers=', updatedPlayers)
}

void main()
  .catch((err) => {
    console.error(
      '[backfill-raw-participants] failed:',
      err instanceof Error ? err.message : String(err)
    )
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })
