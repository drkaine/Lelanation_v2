import type { PostGameStats } from "./checklist";

export interface MatchJournalEntry {
  id: string;
  savedAtMs: number;
  playedAtMs: number;
  gameId?: number | null;
  region: string;
  queueId?: number | null;
  queueType: string;
  gameMode: string;
  gameType: string;
  ranked: boolean;
  championId: number;
  opponentChampionId?: number | null;
  role: string;
  patch: string;
  rankTier: string;
  setItem: string;
  win: boolean;
  stats: PostGameStats;
  metrics: Record<string, number | null | undefined>;
  notes?: string;
  /** Full LCU payloads (dev). */
  lcuRaw?: Record<string, unknown> | null;
}
