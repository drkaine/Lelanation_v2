import cron from 'node-cron'
import { sql } from '../db/client.js'
import { recomputeOtpFlags } from '../services/OtpFlagService.js'
import { loadOtpSettings, type OtpSettings } from '../services/OtpSettingsService.js'
import { reaggregateAllMatches } from '../services/reaggregateAll.js'
import { createCronLogger } from '../utils/cronLogger.js'

export interface OtpRecomputeDeps {
  loadSettings: () => OtpSettings
  /** Empreinte de l'ensemble des joueurs OTP (détecte un changement). */
  fingerprint: () => Promise<string>
  recompute: (settings: OtpSettings) => Promise<number>
  /** Lourd : vide les agrégats puis ré-agrège tous les matchs. */
  reaggregate: () => Promise<number>
  log: {
    info: (msg: string, meta?: Record<string, unknown>) => Promise<void>
    error: (msg: string, meta?: Record<string, unknown>) => Promise<void>
  }
}

async function otpFingerprint(): Promise<string> {
  const rows = await sql<{ fp: string | null }[]>`
    SELECT md5(string_agg(puuid, ',' ORDER BY puuid)) AS fp FROM otp_players`
  return rows[0]?.fp ?? ''
}

const defaultDeps = (): OtpRecomputeDeps => ({
  loadSettings: () => loadOtpSettings(),
  fingerprint: otpFingerprint,
  recompute: recomputeOtpFlags,
  reaggregate: () => reaggregateAllMatches(),
  log: createCronLogger('otpRecompute'),
})

/** Recalcule les flags OTP ; ré-agrège seulement si l'ensemble des OTP a changé. */
export async function runOtpRecomputeOnce(
  deps: OtpRecomputeDeps = defaultDeps(),
): Promise<{ otpPlayers: number; reaggregated: number } | null> {
  try {
    const before = await deps.fingerprint()
    const otpPlayers = await deps.recompute(deps.loadSettings())
    const changed = (await deps.fingerprint()) !== before
    const reaggregated = changed ? await deps.reaggregate() : 0
    await deps.log.info('OTP flags recomputed', { otpPlayers, changed, reaggregated })
    return { otpPlayers, reaggregated }
  } catch (error) {
    await deps.log.error('OTP recompute failed', { error: String(error) })
    return null
  }
}

/** 03:30 heure serveur : trafic faible, après le basculement des réglages poller (00 h). */
export function setupOtpRecompute(): void {
  cron.schedule('30 3 * * *', () => void runOtpRecomputeOnce())
}
