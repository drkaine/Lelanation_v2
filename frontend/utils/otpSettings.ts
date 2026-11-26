/** Réglages OTP (Gestion > OTP) : seuil de parties sur un même champion et minimum de parties. */
export interface OtpSettings {
  thresholdPct: number
  minGames: number
}

export const DEFAULT_OTP_SETTINGS: OtpSettings = { thresholdPct: 70, minGames: 10 }

export function otpSettingsValid(s: OtpSettings): boolean {
  return (
    Number.isFinite(s.thresholdPct) &&
    s.thresholdPct > 0 &&
    s.thresholdPct <= 100 &&
    Number.isInteger(s.minGames) &&
    s.minGames >= 1
  )
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Réponse `GET /api/admin/otp-settings` ; invalide → défauts. */
export function parseOtpSettings(body: unknown): OtpSettings {
  const s = isRecord(body) && isRecord(body.settings) ? body.settings : null
  if (!s || typeof s.thresholdPct !== 'number' || typeof s.minGames !== 'number') {
    return { ...DEFAULT_OTP_SETTINGS }
  }
  const parsed = { thresholdPct: s.thresholdPct, minGames: s.minGames }
  return otpSettingsValid(parsed) ? parsed : { ...DEFAULT_OTP_SETTINGS }
}
