import { prisma, isDatabaseConfigured } from '../db.js'
import { getRiotApiService } from './RiotApiService.js'
import { getPuuidKeyVersion } from '../utils/riotApiKey.js'

function regionToContinent(region: string): 'europe' | 'americas' | 'asia' {
  const r = region.trim().toLowerCase()
  if (['euw1', 'eun1', 'tr1', 'ru', 'me1'].includes(r)) return 'europe'
  if (['na1', 'br1', 'la1', 'la2', 'oc1'].includes(r)) return 'americas'
  return 'asia'
}

function parseRiotId(
  summonerName: string | null,
  defaultTag = 'EUW'
): { gameName: string; tagLine: string } | null {
  if (!summonerName || typeof summonerName !== 'string') return null
  const s = summonerName.trim()
  if (!s) return null
  const hash = s.indexOf('#')
  if (hash === -1) return { gameName: s, tagLine: defaultTag }
  const gameName = s.slice(0, hash).trim()
  const tagLine = s.slice(hash + 1).trim() || defaultTag
  if (!gameName) return null
  return { gameName, tagLine }
}

export type PuuidMigrationScope = 'nullOnly' | 'all'

async function detectMigrationScope(): Promise<PuuidMigrationScope> {
  const sample = await prisma.player.findMany({
    where: {
      puuidKeyVersion: { not: null },
      summonerName: { not: null },
    },
    take: 10,
    orderBy: { createdAt: 'asc' },
    select: { summonerName: true, region: true },
  })
  if (sample.length === 0) return 'nullOnly'

  const riotApi = getRiotApiService()
  for (const player of sample) {
    const parsed = parseRiotId(player.summonerName)
    if (!parsed) continue
    const { gameName, tagLine } = parsed
    const res = await riotApi.getAccountByRiotId(
      gameName,
      tagLine,
      regionToContinent(player.region),
      { fast: true }
    )
    if (res.isErr()) {
      return 'all'
    }
  }
  return 'nullOnly'
}

export async function migratePuuidsAuto(): Promise<{
  processed: number
  migratedNewPuuid: number
  updatedSamePuuid: number
  errors: number
  markedError: number
}> {
  if (!isDatabaseConfigured()) {
    return { processed: 0, migratedNewPuuid: 0, updatedSamePuuid: 0, errors: 0, markedError: 0 }
  }

  const riotApi = getRiotApiService()
  riotApi.setKeyPreference(false)

  const currentKeyVersion = getPuuidKeyVersion()
  const scope = await detectMigrationScope()

  const playerFilter =
    scope === 'all'
      ? {}
      : {
          puuidKeyVersion: null as string | null,
        }

  const BATCH_SIZE = Math.max(
    10,
    parseInt(process.env.RIOT_MIGRATE_PUUID_BATCH ?? '50', 10) || 50
  )

  let processed = 0
  let errors = 0
  let updatedSamePuuid = 0
  let migratedNewPuuid = 0
  let markedError = 0

  let lastPuuid: string | undefined

  while (true) {
    const batch = await prisma.player.findMany({
      where: {
        ...(playerFilter as Record<string, unknown>),
        ...(lastPuuid != null ? { puuid: { gt: lastPuuid } } : {}),
      },
      take: BATCH_SIZE,
      orderBy: { puuid: 'asc' },
      select: { puuid: true, summonerName: true, region: true, lastSeen: true },
    })
    if (batch.length === 0) break

    for (const player of batch) {
      const parsed = parseRiotId(player.summonerName)
      if (!parsed) {
        await prisma.player.update({
          where: { puuid: player.puuid },
          data: { puuidKeyVersion: 'error' },
        })
        markedError++
        processed++
        continue
      }

      let { gameName, tagLine } = parsed
      let accountRes = await riotApi.getAccountByRiotId(
        gameName,
        tagLine,
        regionToContinent(player.region)
      )
      if (accountRes.isErr() && tagLine !== 'EUW') {
        tagLine = 'EUW'
        accountRes = await riotApi.getAccountByRiotId(
          gameName,
          tagLine,
          regionToContinent(player.region)
        )
      }

      if (accountRes.isErr()) {
        errors++
        await prisma.player.update({
          where: { puuid: player.puuid },
          data: { puuidKeyVersion: 'error' },
        })
        markedError++
        processed++
        continue
      }

      const newPuuid = accountRes.unwrap().puuid
      const oldPuuid = player.puuid

      if (newPuuid === oldPuuid) {
        await prisma.player.update({
          where: { puuid: oldPuuid },
          data: { puuidKeyVersion: currentKeyVersion },
        })
        updatedSamePuuid++
        processed++
        continue
      }

      const partResult = await prisma.participant.updateMany({
        where: { puuid: oldPuuid },
        data: { puuid: newPuuid },
      })
      void partResult // participantsUpdated is not used by the poller, but kept for completeness

      const existingNew = await prisma.player.findUnique({
        where: { puuid: newPuuid },
        select: { lastSeen: true },
      })
      const summonerName = `${gameName}#${tagLine}`
      const lastSeen =
        existingNew?.lastSeen && player.lastSeen
          ? existingNew.lastSeen > player.lastSeen
            ? existingNew.lastSeen
            : player.lastSeen
          : existingNew?.lastSeen ?? player.lastSeen ?? null

      if (existingNew) {
        await prisma.player.update({
          where: { puuid: newPuuid },
          data: {
            summonerName,
            lastSeen,
            puuidKeyVersion: currentKeyVersion,
          },
        })
      } else {
        await prisma.player.create({
          data: {
            puuid: newPuuid,
            region: player.region,
            summonerName,
            lastSeen,
            puuidKeyVersion: currentKeyVersion,
          },
        })
      }

      await prisma.player.delete({ where: { puuid: oldPuuid } })

      migratedNewPuuid++
      processed++
    }

    lastPuuid = batch[batch.length - 1]?.puuid
    if (batch.length < BATCH_SIZE) break
  }

  return { processed, migratedNewPuuid, updatedSamePuuid, errors, markedError }
}

