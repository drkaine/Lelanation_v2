import type { RiotMatchDto, RiotMatchTimelineDto, RiotParticipantDto } from './riotIngestTypes.js'

export function buildMatchTeamData(
  matchId: bigint,
  info: RiotMatchDto['info'],
  participantDtos: RiotParticipantDto[],
  timelineDto?: RiotMatchTimelineDto | null
): Array<{
  teamRow: {
    matchId: bigint
    team: number
    win: boolean
    teamEarlySurrendered: boolean
    baronKills: number
    baronFirst: boolean
    dragonKills: number
    dragonFirst: boolean
    towerKills: number
    towerFirst: boolean
    hordeKills: number
    hordeFirst: boolean
    riftHeraldKills: number
    riftHeraldFirst: boolean
    inhibitorKills: number
    inhibitorFirst: boolean
    championKills: number
    firstBlood: boolean
    elderKills: number
  }
  bans: Array<{ championId: number; pickOrder: number }>
}> {
  if (!info?.teams || info.teams.length === 0) return []
  const toFirst = (value: unknown): boolean => value === true
  const toKills = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
  const participantTeamById = new Map<number, number>()
  for (const p of participantDtos) {
    const participantId = (p as { participantId?: unknown }).participantId
    const teamId = p.teamId
    if (typeof participantId === 'number' && Number.isFinite(participantId) && (teamId === 100 || teamId === 200)) {
      participantTeamById.set(participantId, teamId)
    }
  }

  const resolveFirstInhibitorTeam = (): number | null => {
    const frames = timelineDto?.info?.frames
    if (!Array.isArray(frames) || frames.length === 0) return null
    for (const frame of frames) {
      const events = frame?.events
      if (!Array.isArray(events) || events.length === 0) continue
      for (const evt of events) {
        const e = evt as Record<string, unknown>
        if (e.type !== 'BUILDING_KILL') continue
        if (e.buildingType !== 'INHIBITOR_BUILDING') continue
        const killerTeamId = e.killerTeamId
        if (killerTeamId === 100 || killerTeamId === 200) return killerTeamId
        const killerId = e.killerId
        if (typeof killerId === 'number' && Number.isFinite(killerId)) {
          const team = participantTeamById.get(killerId)
          if (team === 100 || team === 200) return team
        }
        const destroyedTeamId = e.teamId
        if (destroyedTeamId === 100) return 200
        if (destroyedTeamId === 200) return 100
      }
    }
    return null
  }
  const firstInhibitorTeamId = resolveFirstInhibitorTeam()

  const teamEarlySurrendered = new Map<number, boolean>()
  for (const p of participantDtos) {
    const tid = p.teamId ?? 0
    if (!tid) continue
    if ((p as { teamEarlySurrendered?: boolean }).teamEarlySurrendered === true) {
      teamEarlySurrendered.set(tid, true)
    }
  }

  return info.teams
    .filter((t) => t.teamId === 100 || t.teamId === 200)
    .map((t) => {
      const obj = t.objectives ?? {}
      const championObj = (obj['champion'] ?? {}) as { first?: unknown; kills?: unknown }
      const baronObj = (obj['baron'] ?? {}) as { first?: unknown; kills?: unknown }
      const dragonObj = (obj['dragon'] ?? {}) as { first?: unknown; kills?: unknown }
      const towerObj = (obj['tower'] ?? {}) as { first?: unknown; kills?: unknown }
      const hordeObj = (obj['horde'] ?? {}) as { first?: unknown; kills?: unknown }
      const riftHeraldObj = (obj['riftHerald'] ?? {}) as { first?: unknown; kills?: unknown }
      const inhibitorObj = (obj['inhibitor'] ?? {}) as { first?: unknown; kills?: unknown }
      const elderObj = (obj['elder'] ?? {}) as { first?: unknown; kills?: unknown }

      const teamBans = (t.bans ?? [])
        .filter((b, idx) => {
          const champId = b?.championId
          return typeof champId === 'number' && champId > 0 && idx < 5
        })
        .map((b, idx) => ({ championId: b.championId as number, pickOrder: idx + 1 }))

      return {
        teamRow: {
          matchId,
          team: t.teamId ?? 0,
          win: t.win === true,
          teamEarlySurrendered: teamEarlySurrendered.get(t.teamId ?? 0) === true,
          baronKills: toKills(baronObj.kills),
          baronFirst: toFirst(baronObj.first),
          dragonKills: toKills(dragonObj.kills),
          dragonFirst: toFirst(dragonObj.first),
          towerKills: toKills(towerObj.kills),
          towerFirst: toFirst(towerObj.first),
          hordeKills: toKills(hordeObj.kills),
          hordeFirst: toFirst(hordeObj.first),
          riftHeraldKills: toKills(riftHeraldObj.kills),
          riftHeraldFirst: toFirst(riftHeraldObj.first),
          inhibitorKills: toKills(inhibitorObj.kills),
          inhibitorFirst: toFirst(inhibitorObj.first) || firstInhibitorTeamId === (t.teamId ?? 0),
          championKills: toKills(championObj.kills),
          firstBlood: toFirst(championObj.first),
          elderKills: toKills(elderObj.kills),
        },
        bans: teamBans,
      }
    })
}
