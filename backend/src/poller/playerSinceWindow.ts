/** Fenêtre max des ids de match d'un joueur : 48 h. */
export const POLL_WINDOW_MS = 48 * 60 * 60 * 1000;

/**
 * Début de fenêtre d'un joueur (secondes) : depuis son dernier poll s'il date de moins de 48 h,
 * sinon les 48 dernières heures. Jamais avant la fenêtre globale (clé perso 24 h).
 */
export function playerSinceTimestamp(globalSinceSec: number, lastPolledAt: Date | null, nowMs: number): number {
  const floor = nowMs - POLL_WINDOW_MS;
  const last = lastPolledAt?.getTime();
  const fromMs = last !== undefined && Number.isFinite(last) && last > floor ? Math.min(last, nowMs) : floor;
  return Math.max(globalSinceSec, Math.floor(fromMs / 1000));
}

/**
 * Ids déjà requêtés, en deux générations : un id reste connu entre une et deux rotations.
 * Rotation toutes les 48 h → un match vu n'est jamais re-requêté dans la fenêtre de poll.
 */
export class RollingIdSet extends Set<string> {
  private previous = new Set<string>();

  override has(id: string): boolean {
    return super.has(id) || this.previous.has(id);
  }

  rotate(): void {
    this.previous = new Set(this);
    this.clear();
  }

  get previousSize(): number {
    return this.previous.size;
  }
}
