export interface RiotTimeline {
  metadata: { matchId: string };
  info: {
    frameInterval: number;
    frames: TimelineFrame[];
  };
}

export interface TimelineFrame {
  timestamp: number;
  participantFrames: Record<string, ParticipantFrame>;
  events: TimelineEvent[];
}

export interface ParticipantFrame {
  participantId: number;
  position: { x: number; y: number };
  currentGold: number;
  level: number;
  xp: number;
  minionsKilled: number;
  jungleMinionsKilled: number;
}

export type TimelineEvent =
  | ChampionKillEvent
  | BuildingKillEvent
  | { type: string; timestamp: number; [key: string]: unknown };

export interface ChampionKillEvent {
  type: "CHAMPION_KILL";
  timestamp: number;
  killerId: number;
  victimId: number;
  assistingParticipantIds: number[];
  position: { x: number; y: number };
}

export interface BuildingKillEvent {
  type: "BUILDING_KILL";
  timestamp: number;
  teamId: number;
  buildingType: "TOWER_BUILDING" | "INHIBITOR_BUILDING";
  laneType: "TOP_LANE" | "MID_LANE" | "BOT_LANE";
  towerType?: "OUTER_TURRET" | "INNER_TURRET" | "BASE_TURRET" | "NEXUS_TURRET";
  position: { x: number; y: number };
}
