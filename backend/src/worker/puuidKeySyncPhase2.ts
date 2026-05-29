/**
 * PUUID key sync — updates `players` in `lelanation_statistiques` (no ingest tables).
 */
import { sql } from '../db/client.js'
import { isDatabaseConfigured } from '../db/query.js'
import { appendUnifiedLog } from '../logging/unifiedAppLog.js'
import { loadMatchFilters, loadCurrentGameVersion } from '../services/RiotConfigService.js'
import { riotGateway, type RiotGatewayError } from '../services/RiotGateway.js'
import { createRiotPollerLogger } from '../utils/riotPollerLogger.js'

const SUMMARY_30M_MS = 30 * 60 * 1000

export type PuuidMigrationRiotInit =
  | { ok: true; clefType: string | null; requestCountRef: { n: number } }
  | { ok: false }

export async function initRiotClientForPuuidMigration(): Promise<PuuidMigrationRiotInit> {
  if (!isDatabaseConfigured()) return { ok: false }
  const logger = createRiotPollerLogger('puuid_migration')
  const requestCountRef = { n: 0 }

  const filtersRes = await loadMatchFilters()
  if (filtersRes.isErr()) {
    await logger.error('Failed to load match-filters', filtersRes.unwrapErr())
    return { ok: false }
  }
  void filtersRes.unwrap()
  await loadCurrentGameVersion()

  const activeKeyInfo = riotGateway.getActiveKeyInfo()
  if (!activeKeyInfo || !process.env.RIOT_API_KEY?.trim()) {
    await logger.error('No API key configured', 'No RIOT_API_KEY in env')
    return { ok: false }
  }

  return { ok: true, clefType: activeKeyInfo.clefType ?? null, requestCountRef }
}

/**
 * Sync players whose `puuid_key_version` ≠ current key via Riot account-v1 when game_name/tag_name exist.
 */
export async function runPuuidKeySyncPhase2(
  logger: ReturnType<typeof createRiotPollerLogger>,
  clefType: string | null,
  shouldStop: () => boolean,
  requestCountRef: { n: number },
): Promise<void> {
  if (!clefType) return
  await logger.step('Phase 2 start: sync players via account-v1 (statistiques DB)', { clefType })
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

    const batch = await sql<
      Array<{ puuid: string; game_name: string | null; tag_name: string | null; region: string }>
    >`
      SELECT puuid, game_name, tag_name, region
      FROM players
      WHERE puuid_key_version IS DISTINCT FROM ${clefType}
        AND puuid_key_version IS DISTINCT FROM 'perdu'
        AND game_name IS NOT NULL
        AND tag_name IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 100
    `
    if (batch.length === 0) break

    for (const row of batch) {
      if (shouldStop()) break
      const gn = String(row.game_name ?? '').trim()
      const tag = String(row.tag_name ?? '').trim()
      if (!gn || !tag) continue

      let accountPuuid: string | undefined
      try {
        const accountRes = await riotGateway.getAccountByRiotId(gn, tag, 'europe')
        requestCountRef.n += 1
        accountPuuid = accountRes.data?.puuid
      } catch (err) {
        requestCountRef.n += 1
        const status = (err as RiotGatewayError).status
        if (status === 403 || status === 401) {
          await logger.error('API key invalid or expired', {})
        }
        accountPuuid = undefined
      }

      if (!accountPuuid) {
        await sql`
          UPDATE players SET puuid_key_version = 'perdu', updated_at = NOW()
          WHERE puuid = ${row.puuid}
        `
        totalPlaceholder++
        continue
      }

      try {
        await sql`
          UPDATE players SET
            puuid = ${accountPuuid},
            puuid_key_version = ${clefType},
            updated_at = NOW()
          WHERE puuid = ${row.puuid}
        `
        totalSynced++
      } catch {
        await sql`
          UPDATE players SET puuid_key_version = 'perdu', updated_at = NOW()
          WHERE puuid = ${row.puuid}
        `
        totalPlaceholder++
      }
    }
  }

  await appendUnifiedLog({
    section: 'back',
    type: 'info',
    script: 'puuid_migration',
    message: 'Phase 2 complete',
    json: { totalSynced, totalPlaceholder, clefType },
  })
}
