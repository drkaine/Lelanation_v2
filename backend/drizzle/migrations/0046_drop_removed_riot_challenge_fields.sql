-- Rapport changements API Riot (2026-10) : champs match-v5 supprimés.
-- challenges.baronBuffGoldAdvantageOverThreshold / earliestBaron / shortestTimeToAceFromFirstTakedown
-- (colonnes dédiées), controlWardTimeCoverageInRiverOrEnemyHalf / earliestDragonTakedown
-- (stockés dans participants.challenges_extra). teams[].objectives.atakhan n'a jamais été persisté.

ALTER TABLE participants
  DROP COLUMN IF EXISTS baron_buff_gold_advantage_over_threshold,
  DROP COLUMN IF EXISTS earliest_baron,
  DROP COLUMN IF EXISTS shortest_time_to_ace_from_first_takedown;

ALTER TABLE champion_stats
  DROP COLUMN IF EXISTS sum_baron_buff_gold_advantage_over_threshold,
  DROP COLUMN IF EXISTS sum_earliest_baron,
  DROP COLUMN IF EXISTS sum_shortest_time_to_ace_from_first_takedown;

UPDATE participants
SET challenges_extra = challenges_extra
  - 'controlWardTimeCoverageInRiverOrEnemyHalf'
  - 'earliestDragonTakedown'
  - 'baronBuffGoldAdvantageOverThreshold'
  - 'earliestBaron'
  - 'shortestTimeToAceFromFirstTakedown'
WHERE challenges_extra ?| ARRAY[
  'controlWardTimeCoverageInRiverOrEnemyHalf',
  'earliestDragonTakedown',
  'baronBuffGoldAdvantageOverThreshold',
  'earliestBaron',
  'shortestTimeToAceFromFirstTakedown'
];
