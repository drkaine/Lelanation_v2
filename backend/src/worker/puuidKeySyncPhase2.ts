/**
 * PUUID key sync (“phase 2”) — logic formerly in the in-process riot poller.
 * Used only by {@link ./puuidMigrationScript.ts}.
 */
import { prisma, isDatabaseConfigured } from '../db.js'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { loadMatchFilters, loadCurrentGameVersion } from '../services/RiotConfigService.js'
import { RiotRateLimiter } from '../services/RiotRateLimiter.js'
import { RiotHttpClient, type RiotParticipantDto } from '../services/RiotHttpClient.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'
import { ingestLeanTablesExist } from './ingestMatchLean.js'
import { Prisma } from '../generated/prisma/index.js'

const SUMMARY_30M_MS = 30 * 60 * 1000

function participantNames(part: RiotParticipantDto): { gn: string; tl: string } {
  const gn = (
    (part.riotIdGameName as string | undefined) ??
    (part.riotIdName as string | undefined) ??
    ''
  )
    .trim()
    .toLowerCase()
  const tl = (
    (part.riotIdTagline as string | undefined) ??
    (part.riotIdTagLine as string | undefined) ??
    ''
  )
    .trim()
    .toLowerCase()
  return { gn, tl }
}

export type PuuidMigrationRiotInit =
  | { ok: true; client: RiotHttpClient; clefType: string | null; requestCountRef: { n: number } }
  | { ok: false }

/** Minimal Riot client init for PUUID migration (API key + match-filters + game version). */
export async function initRiotClientForPuuidMigration(): Promise<PuuidMigrationRiotInit> {
  if (!isDatabaseConfigured()) return { ok: false }
  const logger = createRiotPollerLogger('puuid_migration')
  const rateLimiter = new RiotRateLimiter()
  const client = new RiotHttpClient(rateLimiter, logger, 'puuid-migration')
  const requestCountRef = { n: 0 }

  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) {
    await logger.error('Failed to load match-filters', filtersRes.unwrapErr())
    return { ok: false }
  }
  void filtersRes.unwrap()

  await loadCurrentGameVersion()

  const activeKeyInfo = client.getActiveKeyInfo()
  if (!activeKeyInfo) {
    await logger.error('No API key configured', 'No RIOT_API_KEY in env')
    return { ok: false }
  }

  client.setOnHttpResponse(() => {
    requestCountRef.n += 1
  })

  client.setOnInvalidKey(() => {
    void logger.error('API key invalid or expired', {})
  })

  return { ok: true, client, clefType: activeKeyInfo.clefType ?? null, requestCountRef }
}

/**
 * Sync players whose `puuidKeyVersion` ≠ current key via positional match against stored ingest rows.
 */
export async function runPuuidKeySyncPhase2(
  client: RiotHttpClient,
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null,
  shouldStop: () => boolean,
  requestCountRef: { n: number }
): Promise<void> {
  if (!clefType) return
  if (!(await ingestLeanTablesExist())) {
    await logger.step('Phase 2 skipped: ingest_matchs / ingest_match_players absent (lean tables decommissioned)', {
      clefType,
    })
    return
  }
  await logger.step('Phase 2 start: sync players to current key (positional match-based)', { clefType })
  let totalSynced = 0
  let totalPlaceholder = 0
  let lastPulseMs = Date.now()
  let lastTotalSynced = 0
  let lastReqCount = requestCountRef.n

  while (!shouldStop()) {
    if (Date.now() - lastPulseMs >= SUMMARY_30M_MS) {
      await appendUnifiedLog({
        section: 'back',
        type: 'info',
        script: 'puuid_migration',
        message: 'Resume migration PUUID (30 min)',
        json: {
          windowMs: SUMMARY_30M_MS,
          migratedDelta: totalSynced - lastTotalSynced,
          requestCountDelta: requestCountRef.n - lastReqCount,
          totalSynced,
          totalPlaceholder,
        },
      })
      lastPulseMs = Date.now()
      lastTotalSynced = totalSynced
      lastReqCount = requestCountRef.n
    }

    const batch: { id: bigint; puuidKeyVersion: string | null }[] = await prisma.player.findMany({
      where: {
        OR: [
          { puuidKeyVersion: null },
          { puuidKeyVersion: { notIn: ['perdu', clefType] } },
          { gameName: null, puuidKeyVersion: clefType },
        ],
      },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: { id: true, puuidKeyVersion: true },
    })
    if (batch.length === 0) break

    const playerIds: bigint[] = batch.map((p) => p.id)
    const pendingIds = new Set(playerIds)

    const partRows = await prisma.ingestMatchPlayer.findMany({
      where: { playerId: { in: playerIds } },
      select: { matchId: true },
    })
    const matchCoverage = new Map<bigint, number>()
    for (const r of partRows) {
      matchCoverage.set(r.matchId, (matchCoverage.get(r.matchId) ?? 0) + 1)
    }
    const sortedInternalIds = [...matchCoverage.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id)

    if (sortedInternalIds.length > 0) {
      const matchRows = await prisma.ingestMatch.findMany({
        where: { id: { in: sortedInternalIds } },
        select: { id: true, riotMatchId: true },
      })
      const internalToRiot = new Map(matchRows.map((m) => [m.id, m.riotMatchId]))

      for (const internalId of sortedInternalIds) {
        if (shouldStop() || pendingIds.size === 0) break
        const riotMatchId = internalToRiot.get(internalId)
        if (!riotMatchId) continue

        const matchRes = await client.getMatch(riotMatchId)
        if (!matchRes.ok) {
          continue
        }

        const dbMatchPlayers = await prisma.ingestMatchPlayer.findMany({
          where: { matchId: internalId },
          select: { id: true, playerId: true },
          orderBy: { id: 'asc' },
        })
        const riotParticipants = (matchRes.data.info?.participants ?? []) as RiotParticipantDto[]
        if (dbMatchPlayers.length !== riotParticipants.length) continue

        for (let i = 0; i < dbMatchPlayers.length; i++) {
          const dbPart = dbMatchPlayers[i]
          const riotPart = riotParticipants[i]
          const playerId = dbPart.playerId
          if (!pendingIds.has(playerId) || !riotPart.puuid) continue

          const { gn, tl } = participantNames(riotPart)
          try {
            await prisma.player.update({
              where: { id: playerId },
              data: {
                puuid: riotPart.puuid,
                puuidKeyVersion: clefType,
                ...(gn ? { gameName: gn } : {}),
                ...(tl ? { tagName: tl } : {}),
              },
            })
            pendingIds.delete(playerId)
            totalSynced++
          } catch (e) {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
              await prisma.player.update({
                where: { id: playerId },
                data: { puuidKeyVersion: 'perdu' },
              })
              pendingIds.delete(playerId)
              totalPlaceholder++
            } else {
              throw e
            }
          }
        }
      }
    }

    for (const playerId of pendingIds) {
      const player = batch.find((b) => b.id === playerId)!
      if (player.puuidKeyVersion !== clefType) {
        await prisma.player.update({
          where: { id: playerId },
          data: { puuidKeyVersion: 'perdu' },
        })
        totalPlaceholder++
      }
    }
  }

  await appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: 'puuid_migration',
    message: 'Resume migration PUUID (final)',
    json: { totalSynced, totalPlaceholder, requestCount: requestCountRef.n },
  })
  await logger.step('Phase 2 end', { totalSynced, totalPlaceholder })
}
