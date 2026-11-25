import { spawn } from 'child_process';
import { readFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import {
  loadPollerSettings,
  parsePollerSettings,
  platformChoices,
  POLL_TIERS,
  savePollerSettings,
  type PollerSettings,
} from '../poller/pollerSettings.js';
import type { Platform } from '../poller/types.js';

/** Réglages enregistrés depuis la page Gestion, appliqués au prochain 00 h. */
export function pendingSettingsFile(file: string): string {
  return file.replace(/\.json$/, '') + '.pending.json';
}

function readPending(file: string): PollerSettings | null {
  try {
    return parsePollerSettings(JSON.parse(readFileSync(pendingSettingsFile(file), 'utf8')));
  } catch {
    return null;
  }
}

/** GET /api/admin/poller-settings : actifs + en attente (null si aucun). */
export function pollerSettingsView(file: string, fallbackPlatforms: readonly Platform[]) {
  return {
    settings: loadPollerSettings(file, fallbackPlatforms),
    pending: readPending(file),
    choices: platformChoices(),
    tiers: [...POLL_TIERS],
  };
}

/** PUT : si valide (plateformes connues, total ≤ 100), mis en attente jusqu'à 00 h. */
export function updatePollerSettings(
  file: string,
  body: unknown,
): { ok: true; settings: PollerSettings } | { ok: false } {
  const settings = parsePollerSettings(body);
  if (!settings) return { ok: false };
  savePollerSettings(pendingSettingsFile(file), settings);
  return { ok: true, settings };
}

/** Cron 00 h : réglages en attente → actifs, puis redémarrage du poller (lus au démarrage). */
export function applyPendingPollerSettings(file: string, restartPoller: () => void): boolean {
  const pending = readPending(file);
  if (!pending) return false;
  savePollerSettings(file, pending);
  rmSync(pendingSettingsFile(file), { force: true });
  restartPoller();
  return true;
}

/** `make pm2-restart-poller` détaché ; le backend relit le fichier à chaque requête. */
export function restartPollerDetached(): void {
  const root = process.env.REPO_ROOT ?? resolve(process.cwd(), '..');
  spawn('setsid', ['bash', '-c', 'nohup make pm2-restart-poller > logs/poller-settings-restart.log 2>&1 &'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
  }).unref();
}
