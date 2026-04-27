import 'dotenv/config'
import { prisma } from '../db.js'
import { extractIngestTimelineExtras } from '../worker/ingestMatchLean.js'
import type { RiotMatchTimelineDto, RiotParticipantDto } from '../services/RiotHttpClient.js'
import { Prisma } from '../generated/prisma/index.js'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isItemsEmpty(items: unknown): boolean {
  if (!Array.isArray(items)) return true
  return items.length === 0
}

function buildFallbackItemsFromParticipant(participant: Record<string, unknown>): Array<{
  itemId: number
  starter: boolean
  core: boolean
  order: number
  timestampMs: number
}> {
  const toInt = (raw: unknown): number => {
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
    if (typeof raw === 'string') {
      const n = Number(raw)
      return Number.isFinite(n) ? Math.trunc(n) : 0
    }
    return 0
  }
  const TRINKET_IDS = new Set([3340, 3363, 3364])
  const raw = [
    toInt(participant.item0),
    toInt(participant.item1),
    toInt(participant.item2),
    toInt(participant.item3),
    toInt(participant.item4),
    toInt(participant.item5),
  ]
  const seen = new Set<number>()
  const items: number[] = []
  for (const itemId of raw) {
    if (!Number.isFinite(itemId) || itemId <= 0) continue
    if (TRINKET_IDS.has(itemId)) continue
    if (seen.has(itemId)) continue
    seen.add(itemId)
    items.push(itemId)
  }
  return items.slice(0, 6).map((itemId, index) => ({
    itemId,
    starter: false,
    core: false,
    order: index,
    timestampMs: 0,
  }))
}

async function main(): Promise<void> {
  const batchSize = Math.max(
    50,
    Math.min(1000, Number(process.env.BACKFILL_INGEST_PLAYER_EXTRAS_BATCH ?? 200))
  )
  console.log('[backfill-ingest-player-extras] batchSize:', batchSize)

  let lastMatchId = 0n
  let scannedMatches = 0
  let timelineBackfilled = 0
  let playersUpdated = 0

  while (true) {
    const matches = await prisma.$queryRawUnsafe<Array<{ id: bigint; riot_match_id: string }>>(`
      SELECT im.id, im.riot_match_id
      FROM ingest_matchs im
      WHERE im.id > ${lastMatchId.toString()}
        AND EXISTS (
          SELECT 1
          FROM ingest_match_players imp
          WHERE imp.match_id = im.id
            AND (
              imp.skill_order IS NULL
              OR jsonb_typeof(imp.items::jsonb) <> 'array'
              OR jsonb_array_length(imp.items::jsonb) = 0
            )
        )
      ORDER BY im.id
      LIMIT ${batchSize}
    `)
    if (matches.length === 0) break

    for (const m of matches) {
      scannedMatches++
      lastMatchId = m.id

      const raw = await prisma.matchIngestRaw.findFirst({
        where: { riotMatchId: m.riot_match_id },
        select: { payloadJson: true, timelineJson: true },
      })

      let participants: RiotParticipantDto[] = []
      if (isObject(raw?.payloadJson)) {
        const info = raw.payloadJson.info
        if (isObject(info) && Array.isArray(info.participants)) {
          participants = info.participants as RiotParticipantDto[]
        }
      }
      const participantById = new Map<number, Record<string, unknown>>()
      for (let i = 0; i < participants.length; i++) {
        const p = participants[i] as unknown as Record<string, unknown>
        participantById.set(i + 1, p)
      }

      if (raw?.timelineJson && participants.length > 0) {
        await extractIngestTimelineExtras(
          m.id,
          m.riot_match_id,
          raw.timelineJson as RiotMatchTimelineDto,
          participants
        )
        timelineBackfilled++
      }

      const rows = await prisma.ingestMatchPlayer.findMany({
        where: { matchId: m.id },
        select: { id: true, participantId: true, items: true, skillOrder: true },
      })
      for (const row of rows) {
        const updateData: Prisma.IngestMatchPlayerUpdateInput = {}
        if (row.skillOrder == null) {
          updateData.skillOrder = [] as Prisma.InputJsonValue
        }
        if (isItemsEmpty(row.items)) {
          const participant = participantById.get(row.participantId)
          if (participant) {
            const fallbackItems = buildFallbackItemsFromParticipant(participant)
            if (fallbackItems.length > 0) {
              updateData.items = fallbackItems as Prisma.InputJsonValue
            }
          }
        }
        if (Object.keys(updateData).length === 0) continue
        await prisma.ingestMatchPlayer.update({
          where: { id: row.id },
          data: updateData,
        })
        playersUpdated++
      }
    }

    console.log(
      `[backfill-ingest-player-extras] processed=${matches.length} scanned=${scannedMatches} timeline=${timelineBackfilled} playersUpdated=${playersUpdated}`
    )
  }

  await prisma.$executeRawUnsafe(`
    UPDATE ingest_match_players
    SET skill_order = '[]'::jsonb
    WHERE skill_order IS NULL
  `)

  console.log('[backfill-ingest-player-extras] done')
  console.log('[backfill-ingest-player-extras] scannedMatches=', scannedMatches)
  console.log('[backfill-ingest-player-extras] timelineBackfilled=', timelineBackfilled)
  console.log('[backfill-ingest-player-extras] playersUpdated=', playersUpdated)
}

void main()
  .catch((err) => {
    console.error(
      '[backfill-ingest-player-extras] failed:',
      err instanceof Error ? err.message : String(err)
    )
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined)
  })

