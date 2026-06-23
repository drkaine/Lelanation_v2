export type TeamPosition = "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";

export interface ParticipantMeta {
  participantId: number;
  teamId: 100 | 200;
  teamPosition: TeamPosition;
  championId: number;
}

export interface ParticipantEventCounts {
  participantId: number;
  killByDive: number;
  deathByDive: number;
  killByGank: number;
  deathByGank: number;
  killByRoam: number;
  deathByRoam: number;
}
