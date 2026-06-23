import type { MatchTimelineDto } from "../riot/types.js";
import type { ParticipantMeta, TeamPosition } from "../types/eventClassifier.js";
import type { RiotTimeline, TimelineFrame } from "../types/timeline.js";
import { processTimeline } from "./timelineAnalyzer.js";

const TEAM_POSITIONS = new Set<TeamPosition>(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);

export function normalizeTeamPosition(raw: string): TeamPosition | null {
  const upper = raw.trim().toUpperCase();
  if (upper === "MID") return "MIDDLE";
  if (TEAM_POSITIONS.has(upper as TeamPosition)) return upper as TeamPosition;
  return null;
}

export function toParticipantMeta(input: {
  participantId: number;
  teamId: number;
  teamPosition: string;
  championId: number;
}): ParticipantMeta | null {
  const teamPosition = normalizeTeamPosition(input.teamPosition);
  if (!teamPosition) return null;
  if (input.teamId !== 100 && input.teamId !== 200) return null;
  if (input.participantId <= 0) return null;
  return {
    participantId: input.participantId,
    teamId: input.teamId,
    teamPosition,
    championId: input.championId,
  };
}

export function matchTimelineToRiotTimeline(
  matchId: string,
  timeline: MatchTimelineDto,
): RiotTimeline {
  const frames: TimelineFrame[] = (timeline.info?.frames ?? []).map((frame) => {
    const participantFrames: TimelineFrame["participantFrames"] = {};
    for (const [idStr, pf] of Object.entries(frame.participantFrames ?? {})) {
      participantFrames[idStr] = {
        participantId: pf.participantId,
        position: {
          x: pf.position?.x ?? 0,
          y: pf.position?.y ?? 0,
        },
        currentGold: pf.currentGold,
        level: pf.level,
        xp: pf.xp,
        minionsKilled: pf.minionsKilled,
        jungleMinionsKilled: pf.jungleMinionsKilled,
      };
    }
    return {
      timestamp: frame.timestamp,
      participantFrames,
      events: frame.events.map((ev) => ({
        ...ev,
        type: String(ev.type ?? ""),
        timestamp: ev.timestamp,
      })),
    };
  });

  return {
    metadata: { matchId },
    info: {
      frameInterval: timeline.info?.frameInterval ?? 60_000,
      frames,
    },
  };
}

export function classifyParticipantLaneEvents(
  matchId: string,
  timeline: MatchTimelineDto,
  participants: ParticipantMeta[],
): ReturnType<typeof processTimeline> {
  return processTimeline(matchTimelineToRiotTimeline(matchId, timeline), participants);
}
