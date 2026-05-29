import type { LeagueEntryDto } from '../riot-gateway/routes/dto.js';

export class ParticipantRankCache {
  private readonly entries = new Map<string, LeagueEntryDto[]>();
  private readonly reserved = new Set<string>();
  private hits = 0;
  private misses = 0;

  has(puuid: string): boolean {
    const known = this.entries.has(puuid) || this.reserved.has(puuid);
    if (known) this.hits += 1;
    return known;
  }

  reserve(puuid: string): void {
    if (!this.reserved.has(puuid) && !this.entries.has(puuid)) {
      this.misses += 1;
    }
    this.reserved.add(puuid);
  }

  set(puuid: string, entries: LeagueEntryDto[]): void {
    this.entries.set(puuid, entries);
    this.reserved.add(puuid);
  }

  get(puuid: string): LeagueEntryDto[] | null {
    if (!this.entries.has(puuid)) return null;
    return this.entries.get(puuid) ?? null;
  }

  get size(): number {
    return this.entries.size;
  }

  get hitCount(): number {
    return this.hits;
  }

  get missCount(): number {
    return this.misses;
  }
}
