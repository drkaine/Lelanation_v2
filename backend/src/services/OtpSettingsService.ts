/**
 * Réglages OTP (page Gestion > OTP) : un joueur est OTP si au moins `thresholdPct` % de ses parties
 * sont sur un même champion, avec au moins `minGames` parties. Lus par le recalcul nocturne des flags.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export interface OtpSettings {
  thresholdPct: number;
  minGames: number;
}

export const DEFAULT_OTP_SETTINGS: OtpSettings = { thresholdPct: 70, minGames: 10 };

export function otpSettingsFile(): string {
  return process.env.OTP_SETTINGS_FILE ?? join(process.cwd(), 'data', 'otp-settings.json');
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseOtpSettings(raw: unknown): OtpSettings | null {
  if (!isRecord(raw)) return null;
  const { thresholdPct, minGames } = raw;
  if (typeof thresholdPct !== 'number' || !Number.isFinite(thresholdPct)) return null;
  if (thresholdPct <= 0 || thresholdPct > 100) return null;
  if (typeof minGames !== 'number' || !Number.isInteger(minGames) || minGames < 1) return null;
  return { thresholdPct, minGames };
}

/** Fichier absent ou invalide : réglages par défaut. */
export function loadOtpSettings(file: string = otpSettingsFile()): OtpSettings {
  try {
    return parseOtpSettings(JSON.parse(readFileSync(file, 'utf8'))) ?? { ...DEFAULT_OTP_SETTINGS };
  } catch {
    return { ...DEFAULT_OTP_SETTINGS };
  }
}

/** PUT /api/admin/otp-settings : écrit si valide ; pris en compte au prochain recalcul nocturne. */
export function updateOtpSettings(
  file: string,
  body: unknown,
): { ok: true; settings: OtpSettings } | { ok: false } {
  const settings = parseOtpSettings(body);
  if (!settings) return { ok: false };
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(settings, null, 2));
  return { ok: true, settings };
}
