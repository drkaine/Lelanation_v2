import axios from 'axios'
import { promises as fs } from 'fs'
import { join } from 'path'
import { getRiotApiService } from '../services/RiotApiService.js'
import { runRiotMatchCollectOnce } from '../cron/riotMatchCollect.js'
import { DiscordService } from '../services/DiscordService.js'
import { getRiotApiStats } from '../services/RiotApiStatsService.js'
import { RiotPollerStatusService } from '../services/RiotPollerStatusService.js'

const LOG_PREFIX = '[riot-poller]'
const HEARTBEAT_FILE = join(process.cwd(), 'data', 'cron', 'riot-worker-heartbeat.json')
const PUUID_MIGRATION_REQUEST_FILE = join(process.cwd(), 'data', 'cron', 'puuid-migration-requested.json')

let started = false

function isAuthError(err: unknown): boolean {
  const cause = err && typeof err === 'object' && 'cause' in err ? (err as { cause: unknown }).cause : err
  return axios.isAxiosError(cause) && (cause.response?.status === 401 || cause.response?.status === 403)
}

async function testKey(preferEnv: boolean): Promise<boolean> {
  const riotApi = getRiotApiService()
  riotApi.setKeyPreference(preferEnv)
  try {
    const result = await riotApi.getMatchIdsByPuuid('test-puuid', {
      count: 1,
      queue: null,
      continent: 'europe',
    })
    if (result.isErr()) {
      const err = result.unwrapErr()
      if (isAuthError(err)) return false
    }
    return true
  } catch (err) {
    if (isAuthError(err)) return false
    return true
  }
}

async function writeHeartbeat(): Promise<void> {
  try {
    await fs.mkdir(join(process.cwd(), 'data', 'cron'), { recursive: true })
    await fs.writeFile(
      HEARTBEAT_FILE,
      JSON.stringify({ lastBeat: new Date().toISOString() }, null, 0),
      'utf-8'
    )
  } catch {
    // ignore
  }
}

async function riotPollerLoop(): Promise<void> {
  const discord = new DiscordService()
  const status = new RiotPollerStatusService()

  // 1) Test clé env puis fichier
  let keySource: 'env' | 'file' | null = null
  let ok = await testKey(true)
  if (ok) {
    keySource = 'env'
  } else {
    ok = await testKey(false)
    if (ok) keySource = 'file'
  }

  if (!ok || !keySource) {
    const message = 'Aucune clé Riot valide (env ni fichier admin). Poller arrêté.'
    // eslint-disable-next-line no-console
    console.warn(`${LOG_PREFIX} ${message}`)
    await status.update({
      status: 'error',
      lastErrorAt: new Date().toISOString(),
      lastErrorMessage: message,
    })
    await discord.sendAlert(
      '🔑 Poller Riot – Clé API invalide',
      'Impossible de démarrer le poller Riot : aucune clé API valide (env ni admin).',
      new Error(message),
      { timestamp: new Date().toISOString() }
    )
    return
  }

  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} Starting with key from ${keySource}`)

  for (;;) {
    try {
      // Si une migration PUUID a été demandée, on arrête le poller et on alerte.
      try {
        await fs.access(PUUID_MIGRATION_REQUEST_FILE)
        const msg =
          'PUUID migration requested (\"Exception decrypting\" détecté). Arrêt du poller, exécutez npm run riot:migrate-puuid puis redémarrez le backend.'
        // eslint-disable-next-line no-console
        console.warn(`${LOG_PREFIX} ${msg}`)
        await status.update({
          status: 'error',
          lastErrorAt: new Date().toISOString(),
          lastErrorMessage: msg,
        })
        await discord.sendAlert(
          '⚠️ Poller Riot – PUUID migration requise',
          'Une migration des PUUID est requise (\"Exception decrypting\" détecté par Riot). Exécutez npm run riot:migrate-puuid puis redémarrez le backend.',
          new Error(msg),
          { timestamp: new Date().toISOString() }
        )
        return
      } catch {
        // pas de fichier → pas de migration demandée
      }

      await writeHeartbeat()

      const runResult = await runRiotMatchCollectOnce()

      const apiStats = await getRiotApiStats()
      await status.update({
        status: 'running',
        lastLoopAt: new Date().toISOString(),
        requestsPerSecond: apiStats.requestsLastSecond,
        requestsPerMinute: apiStats.requestsLastMinute,
        requestsPerHour: apiStats.requestsLastHour,
        count429LastHour: apiStats.count429LastHour,
        count429Total: apiStats.count429Total,
      })

      if (runResult.authError) {
        const msg = 'Riot a renvoyé 401/403 pendant la collecte. Poller en erreur, vérifiez la clé API.'
        // eslint-disable-next-line no-console
        console.warn(`${LOG_PREFIX} ${msg}`)
        await status.update({
          status: 'error',
          lastErrorAt: new Date().toISOString(),
          lastErrorMessage: msg,
        })
        await discord.sendAlert(
          '🔑 Poller Riot – Clé API invalide pendant la collecte',
          'Le poller Riot a rencontré une erreur 401/403. Vérifiez / mettez à jour la clé API Riot.',
          new Error(msg),
          { timestamp: new Date().toISOString() }
        )
        // Sortir de la boucle; nécessitera un restart backend après mise à jour de la clé
        return
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      // eslint-disable-next-line no-console
      console.error(`${LOG_PREFIX} Loop error:`, err)
      await status.update({
        status: 'error',
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: message,
      })
      await discord.sendAlert(
        '❌ Poller Riot – Erreur',
        'Erreur inattendue dans la boucle du poller Riot.',
        err instanceof Error ? err : new Error(message),
        { timestamp: new Date().toISOString() }
      )
    }

    // Petite pause pour éviter de spammer en cas de backlog faible
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}

export function startRiotPoller(): void {
  if (started) return
  started = true
  void riotPollerLoop()
}

