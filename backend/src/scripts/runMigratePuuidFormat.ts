/**
 * Migrate PUUIDs from old format (dev key / previous encryption) to new format (current API key).
 * Riot encrypts IDs per application; changing keys invalidates old PUUIDs ("Exception decrypting").
 *
 * Strategy: use table players (summoner_name = gameName#tagLine) and
 * GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine} to get current PUUID.
 * Then update Player and all Participants with the same old PUUID; set puuid_key_version.
 *
 * Riot ID: "Khazadream#EUW" => gameName = "Khazadream", tagLine = "EUW".
 * If tagLine is missing or API fails, retry with tagLine = "EUW".
 *
 * Env: RIOT_PUUID_KEY_VERSION=perso (dev|perso|prod), RIOT_MIGRATE_PUUID_BATCH=50, RIOT_MIGRATE_PUUID_DRY_RUN=1
 *
 * Usage: npm run riot:migrate-puuid (from backend/)
 */
import { config } from 'dotenv'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { promises as fs } from 'fs'
import { createScriptLogger } from '../utils/ScriptLogger.js'
import { prisma } from '../db.js'
import { isDatabaseConfigured } from '../db.js'
import { getRiotApiService } from '../services/RiotApiService.js'
import { getPuuidKeyVersion } from '../utils/riotApiKey.js'

const SCRIPT_ID = 'riot:migrate-puuid'
const __dirname = dirname(fileURLToPath(import.meta.url))
const BACKEND_ROOT = join(__dirname, '..', '..')
const MIGRATION_LOCK_FILE = join(BACKEND_ROOT, 'data', 'cron', 'puuid-migration-in-progress.lock')
config({ path: join(__dirname, '..', '..', '.env') })

const log = createScriptLogger(SCRIPT_ID)

const BATCH_SIZE = Math.max(10, parseInt(process.env.RIOT_MIGRATE_PUUID_BATCH ?? '50', 10) || 50)
const DRY_RUN = process.env.RIOT_MIGRATE_PUUID_DRY_RUN === '1' || process.env.RIOT_MIGRATE_PUUID_DRY_RUN === 'true'

function regionToContinent(region: string): 'europe' | 'americas' | 'asia' {
  const r = region.trim().toLowerCase()
  if (['euw1', 'eun1', 'tr1', 'ru', 'me1'].includes(r)) return 'europe'
  if (['na1', 'br1', 'la1', 'la2', 'oc1'].includes(r)) return 'americas'
  return 'asia'
}

function parseRiotId(summonerName: string | null, defaultTag = 'EUW'): { gameName: string; tagLine: string } | null {
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

async function main(): Promise<void> {
  await log.start([])

  await fs.mkdir(dirname(MIGRATION_LOCK_FILE), { recursive: true }).catch(() => {})
  try {
    const fd = await fs.open(MIGRATION_LOCK_FILE, 'wx')
    await fd.write(String(process.pid), 0, 'utf-8')
    await fd.close()
  } catch {
    await log.info('Lock already held (another migrate-puuid running), exiting.')
    await log.end(0)
    return
  }
  const removeLock = () => fs.unlink(MIGRATION_LOCK_FILE).catch(() => {})

  if (!isDatabaseConfigured()) {
    await removeLock()
    await log.error('DATABASE_URL not set')
    await log.end(1)
    return
  }

  const riotApi = getRiotApiService()
  riotApi.setKeyPreference(false)

  const currentKeyVersion = getPuuidKeyVersion()
  await log.info(`Key version: ${currentKeyVersion}. Batch: ${BATCH_SIZE}. Dry run: ${DRY_RUN}`)

  const playerFilter = { puuidKeyVersion: null }

  const totalPlayers = await prisma.player.count({ where: playerFilter })
  const totalAll = await prisma.player.count()
  await log.info(`Players à traiter: ${totalPlayers}/${totalAll} (déjà migrés: ${totalAll - totalPlayers})`)
  if (totalPlayers === 0) {
    await removeLock()
    await log.info('No players to migrate.')
    await log.end(0)
    return
  }

  let processed = 0
  let errors = 0
  let skippedNoRiotId = 0
  let updatedSamePuuid = 0
  let migratedNewPuuid = 0
  let participantsUpdated = 0
  const startTime = Date.now()
  const LOG_INTERVAL = Math.max(10, Math.floor(BATCH_SIZE / 2))

  let lastPuuid: string | undefined

  while (true) {
    const batch = await prisma.player.findMany({
      where: {
        ...playerFilter,
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
        skippedNoRiotId++
        if (skippedNoRiotId <= 3) {
          await log.warn(`Skip player ${player.puuid.slice(0, 12)}…: no valid summoner_name (${String(player.summonerName).slice(0, 30)})`)
        }
        processed++
        continue
      }

      let { gameName, tagLine } = parsed
      let accountRes = await riotApi.getAccountByRiotId(gameName, tagLine, regionToContinent(player.region))
      if (accountRes.isErr() && tagLine !== 'EUW') {
        await log.info(`Retry with tagLine=EUW for ${gameName}#${tagLine}`)
        tagLine = 'EUW'
        accountRes = await riotApi.getAccountByRiotId(gameName, tagLine, regionToContinent(player.region))
      }

      if (accountRes.isErr()) {
        errors++
        if (errors <= 5) {
          await log.warn(`Account by-riot-id failed for ${gameName}#${tagLine}: ${accountRes.unwrapErr().message}`)
        }
        processed++
        continue
      }

      const newPuuid = accountRes.unwrap().puuid
      const oldPuuid = player.puuid

      if (newPuuid === oldPuuid) {
        if (!DRY_RUN) {
          await prisma.player.update({
            where: { puuid: oldPuuid },
            data: { puuidKeyVersion: currentKeyVersion },
          })
        }
        updatedSamePuuid++
        processed++
        if (processed % LOG_INTERVAL === 0 || processed === 1) {
          const elapsedSec = (Date.now() - startTime) / 1000
          const pct = totalPlayers > 0 ? ((processed / totalPlayers) * 100).toFixed(1) : '0'
          await log.info(
            `[${pct}%] Players: ${processed}/${totalPlayers} | migrated: ${migratedNewPuuid} | same: ${updatedSamePuuid} | errors: ${errors} | ${elapsedSec.toFixed(0)}s`
          )
        }
        continue
      }

      if (!DRY_RUN) {
        const partResult = await prisma.participant.updateMany({
          where: { puuid: oldPuuid },
          data: { puuid: newPuuid },
        })
        participantsUpdated += partResult.count

        const existingNew = await prisma.player.findUnique({ where: { puuid: newPuuid } })
        const summonerName = `${gameName}#${tagLine}`
        const lastSeen =
          existingNew?.lastSeen && player.lastSeen
            ? (existingNew.lastSeen > player.lastSeen ? existingNew.lastSeen : player.lastSeen)
            : (existingNew?.lastSeen ?? player.lastSeen ?? null)

        if (existingNew) {
          await prisma.player.update({
            where: { puuid: newPuuid },
            data: {
              summonerName: summonerName ?? undefined,
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
      }

      migratedNewPuuid++
      if (migratedNewPuuid === 1) {
        await log.info(`First migration: ${oldPuuid.slice(0, 16)}… → ${newPuuid.slice(0, 16)}… ${gameName}#${tagLine}`)
      }
      processed++

      if (processed % LOG_INTERVAL === 0 || processed === 1) {
        const elapsedSec = (Date.now() - startTime) / 1000
        const pct = totalPlayers > 0 ? ((processed / totalPlayers) * 100).toFixed(1) : '0'
        await log.info(
          `[${pct}%] Players: ${processed}/${totalPlayers} | migrated: ${migratedNewPuuid} | same: ${updatedSamePuuid} | errors: ${errors} | participants: ${participantsUpdated} | ${elapsedSec.toFixed(0)}s`
        )
      }
    }

    lastPuuid = batch[batch.length - 1].puuid
    if (batch.length < BATCH_SIZE) break
  }

  await log.info(
    `Done. Processed: ${processed} | migrated (new puuid): ${migratedNewPuuid} | same puuid (version only): ${updatedSamePuuid} | participants updated: ${participantsUpdated} | errors: ${errors} | skipped (no Riot ID): ${skippedNoRiotId}`
  )
  await removeLock()
  await log.end(0)
}

main().catch(async (err) => {
  await fs.unlink(MIGRATION_LOCK_FILE).catch(() => {})
  await log.error('Fatal:', err)
  await log.end(1)
  process.exit(1)
})
