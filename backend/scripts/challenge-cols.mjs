const ALLOWLIST = [
  'soloKills', 'takedowns', 'bountyGold', 'doubleAces', 'buffsStolen',
  'flawlessAces', 'hadOpenNexus', 'quickCleanse', 'snowballsHit', 'wardsGuarded',
  'earliestBaron', 'skillshotsHit', 'unseenRecalls', 'maxKillDeficit',
  'quickSoloKills', 'soloBaronKills', 'voidMonsterKill', 'fullTeamTakedown',
  'initialBuffCount', 'initialCrabCount', 'outnumberedKills', 'pickKillWithAlly',
  'quickFirstTurret', 'scuttleCrabKills', 'skillshotsDodged', 'multiKillOneSpell',
  'saveAllyFromDeath', 'takedownsInAlcove', 'turretPlatesTaken', 'HealFromMapSources',
  '12AssistStreakCount', 'InfernalScalePickup', 'acesBefore15Minutes',
  'deathsByEnemyChamps', 'killsUnderOwnTurret', 'riftHeraldTakedowns',
  'teamRiftHeraldKills', 'killsNearEnemyTurret', 'teamElderDragonKills',
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
]

function toSnake (s) {
  return s
    .replace(/([a-zA-Z])(\d)/g, '$1_$2')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '')
}

function toPrismaField (key) {
  return 'challenge' + key.charAt(0).toUpperCase() + key.slice(1)
}

// Prisma schema lines
const prismaLines = ALLOWLIST.map(k => `  ${toPrismaField(k)} Float? @map("ch_${toSnake(k)}")`)
console.log('--- PRISMA ---')
console.log(prismaLines.join('\n'))

// Migration ADD COLUMN lines
const addCols = ALLOWLIST.map(k => `ALTER TABLE participants ADD COLUMN IF NOT EXISTS ch_${toSnake(k)} DOUBLE PRECISION NULL;`)
console.log('\n--- MIGRATION ADD ---')
console.log(addCols.join('\n'))

// Backfill UPDATE lines: one per key
const backfill = ALLOWLIST.map(k => {
  const col = 'ch_' + toSnake(k)
  const qkey = k.replace(/'/g, "''")
  return `UPDATE participants p SET ${col} = pc.value FROM participant_challenges pc WHERE pc.participant_id = p.id AND pc.key = '${qkey}';`
})
console.log('\n--- BACKFILL ---')
console.log(backfill.join('\n'))
