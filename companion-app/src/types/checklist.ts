export type CheckResultKind = "checked" | "partial" | "failed" | "unmeasurable";

export interface ChecklistItem {
  id: string;
  kind: CheckResultKind;
  detail?: string | null;
  userKind?: CheckResultKind | null;
  manualChecked?: boolean;
}

export interface PostGameStats {
  gameId?: number | null;
  gameDurationSeconds: number;
  csAt5?: number | null;
  csAt10?: number | null;
  csTotal: number;
  goldEarned: number;
  kills: number;
  deaths: number;
  assists: number;
  wardsPlaced: number;
  visionWardsBought: number;
  wardsKilled: number;
  championId: number;
  win: boolean;
  teamDragonKills: number;
  teamBaronKills: number;
  queueId?: number | null;
  queueType?: string;
  gameMode?: string;
  gameType?: string;
  ranked?: boolean;
  playerRank?: string;
  playerLp?: number | null;
  lpChange?: number | null;
  playerElo?: number | null;
  allyTeamAvgElo?: number | null;
  enemyTeamAvgElo?: number | null;
  gameAvgElo?: number | null;
}

export interface SavedChecklist {
  id: string;
  savedAtMs: number;
  autoSaved: boolean;
  items: ChecklistItem[];
  score: number;
  measuredCount: number;
  checkedCount: number;
  stats: PostGameStats;
  notes?: string;
}
