/**
 * Pause par plateforme pendant le balayage des rangs : le balayage garde le quota de son hôte
 * (euw1, kr…) et les matchs d'une plateforme ne sont ingérés qu'une fois ses rangs du jour connus.
 * Les autres plateformes continuent (quotas Riot séparés par hôte).
 */
export class SweepGate {
  private readonly sweeping = new Map<string, boolean>();

  /** Plateformes balayées : en pause jusqu'au premier tick `idle` de chacune. */
  constructor(platforms: readonly string[]) {
    for (const platform of platforms) this.sweeping.set(platform, true);
  }

  record(platform: string, kind: 'apex' | 'page' | 'idle'): void {
    this.sweeping.set(platform, kind !== 'idle');
  }

  /** Plateformes pollables maintenant (pas en balayage). */
  activePlatforms<T extends string>(platforms: readonly T[]): T[] {
    return platforms.filter((p) => this.sweeping.get(p) !== true);
  }

  /** Toutes en balayage : aucune session ne peut démarrer. */
  allHeld(platforms: readonly string[]): boolean {
    return this.activePlatforms(platforms).length === 0;
  }
}
