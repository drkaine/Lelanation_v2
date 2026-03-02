/**
 * Migrate PUUIDs from old format (dev key / previous encryption) to new format (current API key).
 * Riot encrypts IDs per application; changing keys invalidates old PUUIDs ("Exception decrypting").
 *
 * Strategy: re-fetch matchs depuis Riot API → Match v5 retourne participants avec PUUID actuel.
 * Corrélation par (championId, teamId, kills, deaths, assists, goldEarned) pour construire old→new.
 * Puis UPDATE participants et players.
 *
 * Skip: matchs déjà migrés (puuid_key_version = clé courante) pour éviter appels API inutiles.
 * Env: RIOT_PUUID_KEY_VERSION=prod (dev|perso|prod), RIOT_MIGRATE_PUUID_BATCH=50, RIOT_MIGRATE_PUUID_DRY_RUN=1
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
const MIGRATION_LOCK_FILE = join(process.cwd(), 'data', 'cron', 'puuid-migration-in-progress.lock')
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '..', '..', '.env') })

const log = createScriptLogger(SCRIPT_ID)

const BATCH_SIZE = Math.max(10, parseInt(process.env.RIOT_MIGRATE_PUUID_BATCH ?? '50', 10) || 50)
const DRY_RUN = process.env.RIOT_MIGRATE_PUUID_DRY_RUN === '1' || process.env.RIOT_MIGRATE_PUUID_DRY_RUN === 'true'
const FORCE_REPROCESS = process.env.RIOT_MIGRATE_PUUID_FORCE === '1' || process.env.RIOT_MIGRATE_PUUID_FORCE === 'true'

function formatRiotId(gameName?: string, tagLine?: string): string | null {
  if (!gameName || typeof gameName !== 'string') return null
  const tag = typeof tagLine === 'string' && tagLine.trim() ? tagLine.trim() : ''
  return tag ? `${gameName.trim()}#${tag}` : gameName.trim()
}

function participantKey(p: {
  championId: number
  teamId?: number
  kills: number
  deaths: number
  assists: number
  goldEarned?: number | null
  champLevel?: number | null
}): string {
  const teamId = p.teamId ?? 0
  const gold = p.goldEarned ?? 0
  const level = p.champLevel ?? 0
  return `${p.championId}:${teamId}:${p.kills}:${p.deaths}:${p.assists}:${gold}:${level}`
}

async function main(): Promise<void> {
  await log.start([])

  await fs.mkdir(dirname(MIGRATION_LOCK_FILE), { recursive: true }).catch(() => {})
  await fs.writeFile(MIGRATION_LOCK_FILE, String(process.pid), 'utf-8').catch(() => {})
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
  await log.info(`Key version: ${currentKeyVersion}. Batch: ${BATCH_SIZE}. Dry run: ${DRY_RUN}. Force: ${FORCE_REPROCESS}`)

  const matchFilter = FORCE_REPROCESS
    ? {}
    : { OR: [{ puuidKeyVersion: null }, { puuidKeyVersion: { not: currentKeyVersion } }] }

  const totalMatches = await prisma.match.count({ where: matchFilter })
  const totalAll = await prisma.match.count()
  await log.info(`Matchs à traiter: ${totalMatches}/${totalAll} (déjà migrés: ${totalAll - totalMatches})`)
  await log.info(`Phase 1: fetch matchs, build mapping old→new PUUID + summonerName (dernière game)`)

  const mapping = new Map<string, string>()
  const newPuuidToSummonerName = new Map<string, string>()
  let processed = 0
  let errors = 0
  let unmatched = 0
  let cursor: { id: bigint } | undefined
  const startTime = Date.now()
  const LOG_INTERVAL = Math.max(10, Math.floor(BATCH_SIZE / 2))

  while (true) {
    const batch = await prisma.match.findMany({
      where: matchFilter,
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor.id } } : {}),
      orderBy: { id: 'desc' },
      select: { id: true, matchId: true },
    })
    if (batch.length === 0) break

    for (const m of batch) {
      const matchRes = await riotApi.getMatch(m.matchId)
      if (matchRes.isErr()) {
        errors++
        const err = matchRes.unwrapErr()
        const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause?: unknown }).cause : undefined
        const status = cause && typeof cause === 'object' && 'response' in cause
          ? (cause as { response?: { status?: number } }).response?.status
          : undefined
        if (errors <= 5) {
          await log.warn(`getMatch failed for ${m.matchId}: status=${status} ${err.message}`)
        }
        continue
      }

      const apiParticipants = matchRes.unwrap().info?.participants ?? []
      const dbParticipants = await prisma.participant.findMany({
        where: { matchId: m.id },
        select: {
          id: true,
          puuid: true,
          championId: true,
          teamId: true,
          kills: true,
          deaths: true,
          assists: true,
          goldEarned: true,
          champLevel: true,
        },
      })

      const apiByKey = new Map<string, (typeof apiParticipants)[number]>()
      for (const p of apiParticipants) {
        const ap = p as {
          championId: number
          teamId?: number
          kills?: number
          deaths?: number
          assists?: number
          goldEarned?: number
          champLevel?: number
          riotIdGameName?: string
          riotIdTagline?: string
        }
        const k = participantKey({
          championId: ap.championId,
          teamId: ap.teamId,
          kills: ap.kills ?? 0,
          deaths: ap.deaths ?? 0,
          assists: ap.assists ?? 0,
          goldEarned: ap.goldEarned,
          champLevel: ap.champLevel,
        })
        if (!apiByKey.has(k)) apiByKey.set(k, p)
      }

      for (const db of dbParticipants) {
        const k = participantKey({
          championId: db.championId,
          teamId: db.teamId ?? undefined,
          kills: db.kills,
          deaths: db.deaths,
          assists: db.assists,
          goldEarned: db.goldEarned,
          champLevel: db.champLevel,
        })
        const api = apiByKey.get(k)
        if (api?.puuid && api.puuid !== db.puuid) {
          mapping.set(db.puuid, api.puuid)
          const apExt = api as { riotIdGameName?: string; riotIdTagline?: string }
          const riotId = formatRiotId(apExt.riotIdGameName, apExt.riotIdTagline)
          if (riotId && !newPuuidToSummonerName.has(api.puuid)) {
            newPuuidToSummonerName.set(api.puuid, riotId)
          }
          if (mapping.size === 1) {
            await log.info(`First mapping: ${m.matchId} ${db.puuid.slice(0, 16)}…→${api.puuid.slice(0, 16)}… ${riotId ?? '(no tag)'}`)
          }
        } else if (!api) {
          unmatched++
        }
      }

      if (!DRY_RUN) {
        await prisma.match.update({
          where: { id: m.id },
          data: { puuidKeyVersion: currentKeyVersion },
        })
      }
      processed++

      if (processed % LOG_INTERVAL === 0 || processed === 1) {
        const elapsedSec = (Date.now() - startTime) / 1000
        const pct = totalMatches > 0 ? ((processed / totalMatches) * 100).toFixed(1) : '0'
        const rateMin = elapsedSec > 0 ? (processed / elapsedSec) * 60 : 0
        const etaMin = rateMin > 0 ? Math.ceil((totalMatches - processed) / rateMin) : null
        await log.info(
          `[${pct}%] Matchs: ${processed}/${totalMatches} | mappings: ${mapping.size} | errors: ${errors} | ${elapsedSec.toFixed(0)}s elapsed | ~${rateMin.toFixed(1)} match/min` +
            (etaMin != null ? ` | ETA ~${etaMin} min` : '')
        )
      }
    }

    cursor = batch[batch.length - 1]
    if (batch.length < BATCH_SIZE) break
  }

  await log.info(`Phase 1 done. Mappings: ${mapping.size}. SummonerNames: ${newPuuidToSummonerName.size}. Errors: ${errors}. Unmatched: ${unmatched}`)
  if (mapping.size > 0) {
    const sample = [...mapping.entries()].slice(0, 3).map(([o, n]) => `${o.slice(0, 12)}…→${n.slice(0, 12)}…`)
    await log.info(`Sample mappings: ${sample.join(' | ')}`)
  }

  if (mapping.size === 0) {
    await removeLock()
    await log.info('No PUUID migrations needed.')
    await log.end(0)
    return
  }

  if (DRY_RUN) {
    await removeLock()
    const sample = [...mapping.entries()].slice(0, 5)
    await log.info(`Dry run: would update ${mapping.size} old→new. Sample: ${JSON.stringify(sample)}`)
    await log.end(0)
    return
  }

  await log.info(`Phase 2: update participants (${mapping.size} mappings)`)
  let participantsUpdated = 0
  for (const [oldPuuid, newPuuid] of mapping) {
    const r = await prisma.participant.updateMany({ where: { puuid: oldPuuid }, data: { puuid: newPuuid } })
    participantsUpdated += r.count
  }
  await log.info(`Phase 2 done. Participants updated: ${participantsUpdated}`)

  await log.info(`Phase 3: update players (${mapping.size} old puuids)`)
  const playersToMigrate = await prisma.player.findMany({
    where: { puuid: { in: [...mapping.keys()] } },
    select: { puuid: true, summonerName: true, region: true, lastSeen: true },
  })

  let playersCreated = 0
  let playersDeleted = 0
  let playersTagUpdated = 0
  for (const player of playersToMigrate) {
    const newPuuid = mapping.get(player.puuid)
    if (!newPuuid || newPuuid === player.puuid) continue

    const existingNew = await prisma.player.findUnique({ where: { puuid: newPuuid } })
    const tagFromMatch = newPuuidToSummonerName.get(newPuuid)
    const summonerName = tagFromMatch ?? existingNew?.summonerName ?? player.summonerName
    if (tagFromMatch) playersTagUpdated++
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
          summonerName: summonerName ?? undefined,
          lastSeen,
          puuidKeyVersion: currentKeyVersion,
        },
      })
      playersCreated++
    }
    await prisma.player.delete({ where: { puuid: player.puuid } })
    playersDeleted++

    if ((playersCreated + playersDeleted) % 500 === 0) {
      await log.info(`Players: ${playersCreated} created, ${playersDeleted} deleted (progress)`)
    }
  }
  await log.info(`Phase 3 done. Players: ${playersCreated} created, ${playersDeleted} deleted, ${playersTagUpdated} tag mis à jour (dernière game)`)
  await log.info(`Migration complete. Total: ${participantsUpdated} participants, ${playersCreated + playersDeleted} players`)

  await removeLock()
  await log.end(0)
}

main().catch(async (err) => {
  await fs.unlink(MIGRATION_LOCK_FILE).catch(() => {})
  await log.error('Fatal:', err)
  await log.end(1)
  process.exit(1)
})
