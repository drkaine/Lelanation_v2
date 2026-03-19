/**
 * ChallengeNormalisationService
 *
 * - Filters Riot challenge data against the allowlist.
 * - Detects unknown keys and stores them in challenge_keys_registry.
 * - Sends a Discord notification exactly once per new unknown key.
 */
import { DiscordService } from './DiscordService.js'

// ─── Allowlist ────────────────────────────────────────────────────────────────
// Keys kept from challenges (Untitled-2 "ce que je veux").
export const CHALLENGE_ALLOWLIST = new Set<string>([
  'soloKills', 'takedowns', 'bountyGold', 'doubleAces', 'buffsStolen',
  'flawlessAces', 'hadOpenNexus', 'quickCleanse', 'snowballsHit', 'wardsGuarded',
  'earliestBaron', 'skillshotsHit', 'unseenRecalls', 'maxKillDeficit',
  'quickSoloKills', 'soloBaronKills', 'voidMonsterKill', 'fullTeamTakedown',
  'initialBuffCount', 'initialCrabCount', 'outnumberedKills', 'pickKillWithAlly',
  'quickFirstTurret', 'scuttleCrabKills', 'skillshotsDodged', 'multiKillOneSpell',
  'saveAllyFromDeath', 'takedownsInAlcove', 'turretPlatesTaken', 'HealFromMapSources',
  '12AssistStreakCount', 'InfernalScalePickup', 'acesBefore15Minutes',
  'deathsByEnemyChamps', 'killsUnderOwnTurret', 'riftHeraldTakedowns',
  'teamRiftHeraldKills', 'killsNearEnemyTurret',
  'elderDragonMultikills', 'firstTurretKilledTime', 'fistBumpParticipation',
  'mejaisFullStackInTime', 'takedownOnFirstTurret', 'takedownsFirstXMinutes',
  'wardTakedownsBefore20M', 'jungleCsBefore10Minutes', 'killAfterHiddenWithAlly',
  'landSkillShotsEarlyGame', 'perfectDragonSoulsTaken', 'tookLargeDamageSurvived',
  'twoWardsOneSweeperCount', 'maxLevelLeadLaneOpponent', 'takedownsInEnemyFountain',
  'immobilizeAndKillWithAlly', 'knockEnemyIntoTeamAndKill', 'laneMinionsFirst10Minutes',
  'playedChampSelectPosition', 'completeSupportQuestInTime', 'dodgeSkillShotsSmallWindow',
  'multiTurretRiftHeraldCount', 'survivedSingleDigitHpCount', 'turretsTakenWithRiftHerald',
  'laningPhaseGoldExpAdvantage', 'moreEnemyJungleThanOpponent', 'enemyChampionImmobilizations',
  'killsWithHelpFromEpicMonster', 'maxCsAdvantageOnLaneOpponent', 'twentyMinionsIn3SecondsCount',
  'epicMonsterStolenWithoutSmite', 'blastConeOppositeOpponentCount',
  'multikillsAfterAggressiveFlash', 'survivedThreeImmobilizesInFight',
  'earlyLaningPhaseGoldExpAdvantage', 'elderDragonKillsWithOpposingSoul',
  'epicMonsterKillsNearEnemyJungler', 'takedownsBeforeJungleMinionSpawn',
  'visionScoreAdvantageLaneOpponent', 'outerTurretExecutesBefore10Minutes',
  'baronBuffGoldAdvantageOverThreshold', 'killsOnOtherLanesEarlyJungleAsLaner',
  'takedownsAfterGainingLevelAdvantage', 'killedChampTookFullTeamDamageSurvived',
  'epicMonsterKillsWithin30SecondsOfSpawn', 'junglerTakedownsNearDamagedEpicMonster',
  'getTakedownsInAllLanesEarlyJungleAsLaner', 'controlWardTimeCoverageInRiverOrEnemyHalf',
])

export interface AllowedChallenge {
  key: string
  value: number
}

/**
 * Converts allowlisted challenge key/value pairs into the Participant update shape:
 * Prisma field names (challenge + PascalCase(key)) -> value.
 * Used to write challenge columns on participants instead of participant_challenges.
 */
export function allowedToParticipantChallengeData(allowed: AllowedChallenge[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const { key, value } of allowed) {
    const field = 'challenge' + key.charAt(0).toUpperCase() + key.slice(1)
    out[field] = value
  }
  return out
}

/**
 * Splits a raw challenges object into:
 *   - allowed: key/value pairs to store on participant challenge columns
 *   - unknown: keys not in the allowlist (to log in registry)
 *
 * Non-numeric values are silently skipped (e.g. legendaryItemUsed array).
 */
export function partitionChallenges(raw: Record<string, unknown>): {
  allowed: AllowedChallenge[]
  unknown: Record<string, unknown>
} {
  const allowed: AllowedChallenge[] = []
  const unknown: Record<string, unknown> = {}

  for (const [key, val] of Object.entries(raw)) {
    const isNumeric = typeof val === 'number' && Number.isFinite(val)
    if (CHALLENGE_ALLOWLIST.has(key)) {
      if (isNumeric) allowed.push({ key, value: val as number })
    } else {
      unknown[key] = val
    }
  }
  return { allowed, unknown }
}

const discord = new DiscordService()

/** In-memory set to avoid sending duplicate Discord alerts for unknown challenge keys in the same process lifetime. */
const notifiedUnknownKeys = new Set<string>()

/**
 * Sends a Discord notification for unknown challenge keys (fire-and-forget).
 * No DB persistence — uses an in-memory set to avoid duplicate notifications.
 */
export async function handleUnknownChallengeKeys(
  unknownKeys: Record<string, unknown>
): Promise<void> {
  if (Object.keys(unknownKeys).length === 0) return

  const newKeyEntries = Object.keys(unknownKeys).filter((k) => !notifiedUnknownKeys.has(k))
  if (newKeyEntries.length === 0) return

  for (const k of newKeyEntries) notifiedUnknownKeys.add(k)

  const fieldLines = newKeyEntries.map((k) => {
    const v = unknownKeys[k]
    return `\`${k}\`: \`${JSON.stringify(v)}\``
  })
  const context: Record<string, unknown> = {
    count: newKeyEntries.length,
    keys: fieldLines.slice(0, 20).join('\n'),
  }

  await discord.sendAlert(
    '🆕 Nouvelles clés challenges détectées',
    `${newKeyEntries.length} clé(s) inconnue(s) hors allowlist trouvée(s) dans les données Riot.`,
    undefined,
    context
  )
}
