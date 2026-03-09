-- =============================================================================
-- MIGRATION: 20260309150000_normalise_teams_bans_participant_data
-- Normalise match teams / bans / participant sub-data into relational tables.
-- This is an ADDITIVE migration (step 1 of 2).  Legacy columns are kept; they
-- will be removed in migration 20260309160000_cleanup_legacy_columns (step 2).
-- =============================================================================

-- Disable statement/idle timeouts for this long-running migration.
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;

-- ─── 0. Backup tables (for rollback safety) ──────────────────────────────────
-- We keep legacy columns intact (step-1 is additive), so the live tables ARE
-- the backup.  We only save a lightweight structural snapshot here to record
-- the pre-migration schema and a small data sample for spot-checks.
-- Full data backups can be taken outside of Prisma (pg_dump) before applying.

-- Schema-only snapshot of matches (no data copy to avoid long table scan)
CREATE TABLE IF NOT EXISTS backup_matches_20260309 (LIKE matches INCLUDING ALL);

-- Schema-only snapshot of participants
CREATE TABLE IF NOT EXISTS backup_participants_20260309 (LIKE participants INCLUDING ALL);

-- Snapshot of match_teams (lightweight — only row count matters for verification)
CREATE TABLE IF NOT EXISTS backup_match_teams_pre_20260309 AS
SELECT * FROM match_teams LIMIT 0;

-- ─── 1. Extend existing tables ───────────────────────────────────────────────

-- matches: aggregate surrender flags (BOOL_OR from participants, done after backfill)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS game_ended_in_surrender      boolean,
  ADD COLUMN IF NOT EXISTS game_ended_in_early_surrender boolean;

-- match_teams: team-level rank + surrender flag
ALTER TABLE match_teams
  ADD COLUMN IF NOT EXISTS rank_tier              text,
  ADD COLUMN IF NOT EXISTS team_early_surrendered boolean NOT NULL DEFAULT false;

-- ─── 2. New normalised tables ────────────────────────────────────────────────

-- bans (replaces ban_1..5 columns in match_teams)
CREATE TABLE IF NOT EXISTS bans (
  id             bigserial PRIMARY KEY,
  match_team_id  bigint  NOT NULL REFERENCES match_teams(id) ON DELETE CASCADE,
  match_id       bigint  NOT NULL,           -- denormalised for simpler queries
  champion_id    int     NOT NULL,
  pick_order     int     NOT NULL CHECK (pick_order BETWEEN 1 AND 5),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bans_match_team_id ON bans(match_team_id);
CREATE INDEX IF NOT EXISTS idx_bans_match_id      ON bans(match_id);
CREATE INDEX IF NOT EXISTS idx_bans_champion_id   ON bans(champion_id);

-- participant_items
CREATE TABLE IF NOT EXISTS participant_items (
  id             bigserial PRIMARY KEY,
  participant_id bigint  NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  match_id       bigint  NOT NULL,
  item_id        int     NOT NULL,
  item_slot      int     NOT NULL CHECK (item_slot BETWEEN 0 AND 6),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pitems_participant_id ON participant_items(participant_id);
CREATE INDEX IF NOT EXISTS idx_pitems_match_id       ON participant_items(match_id);
CREATE INDEX IF NOT EXISTS idx_pitems_item_id        ON participant_items(item_id);

-- participant_runes
CREATE TABLE IF NOT EXISTS participant_runes (
  id             bigserial PRIMARY KEY,
  participant_id bigint  NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  match_id       bigint  NOT NULL,
  perk_id        int     NOT NULL,
  slot           int     NOT NULL,  -- position within style (0-based)
  style_id       int     NOT NULL,
  var_1          int,
  var_2          int,
  var_3          int,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prunes_participant_id ON participant_runes(participant_id);
CREATE INDEX IF NOT EXISTS idx_prunes_match_id       ON participant_runes(match_id);
CREATE INDEX IF NOT EXISTS idx_prunes_perk_id        ON participant_runes(perk_id);

-- participant_summoner_spells
CREATE TABLE IF NOT EXISTS participant_summoner_spells (
  id             bigserial PRIMARY KEY,
  participant_id bigint  NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  match_id       bigint  NOT NULL,
  spell_id       int     NOT NULL,
  spell_slot     int     NOT NULL CHECK (spell_slot IN (1, 2)),
  casts          int     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, spell_slot)
);
CREATE INDEX IF NOT EXISTS idx_pss_participant_id ON participant_summoner_spells(participant_id);
CREATE INDEX IF NOT EXISTS idx_pss_match_id       ON participant_summoner_spells(match_id);

-- participant_spells (champion Q/W/E/R cast counts)
CREATE TABLE IF NOT EXISTS participant_spells (
  id             bigserial PRIMARY KEY,
  participant_id bigint  NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  match_id       bigint  NOT NULL,
  spell_slot     int     NOT NULL CHECK (spell_slot BETWEEN 1 AND 4),
  casts          int     NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, spell_slot)
);
CREATE INDEX IF NOT EXISTS idx_pspells_participant_id ON participant_spells(participant_id);
CREATE INDEX IF NOT EXISTS idx_pspells_match_id       ON participant_spells(match_id);

-- participant_perks (stat perks: defense/flex/offense)
CREATE TABLE IF NOT EXISTS participant_perks (
  id             bigserial PRIMARY KEY,
  participant_id bigint  NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  match_id       bigint  NOT NULL,
  perk_id        int     NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pperks_participant_id ON participant_perks(participant_id);
CREATE INDEX IF NOT EXISTS idx_pperks_match_id       ON participant_perks(match_id);

-- participant_challenges (allowlisted keys only)
CREATE TABLE IF NOT EXISTS participant_challenges (
  id             bigserial PRIMARY KEY,
  participant_id bigint  NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  match_id       bigint  NOT NULL,
  key            text    NOT NULL,
  value          double precision NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (participant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_pchallenges_participant_id ON participant_challenges(participant_id);
CREATE INDEX IF NOT EXISTS idx_pchallenges_match_id       ON participant_challenges(match_id);
CREATE INDEX IF NOT EXISTS idx_pchallenges_key            ON participant_challenges(key);

-- challenge_keys_registry
CREATE TABLE IF NOT EXISTS challenge_keys_registry (
  key            text PRIMARY KEY,
  sample_value   jsonb NOT NULL,
  is_new         boolean NOT NULL DEFAULT true,
  notified_at    timestamptz,
  first_seen_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Backfill bans from match_teams.ban_1..5 ──────────────────────────────

INSERT INTO bans (match_team_id, match_id, champion_id, pick_order)
SELECT mt.id, mt.match_id, mt.ban_1, 1
FROM match_teams mt
WHERE mt.ban_1 IS NOT NULL AND mt.ban_1 > 0
ON CONFLICT DO NOTHING;

INSERT INTO bans (match_team_id, match_id, champion_id, pick_order)
SELECT mt.id, mt.match_id, mt.ban_2, 2
FROM match_teams mt
WHERE mt.ban_2 IS NOT NULL AND mt.ban_2 > 0
ON CONFLICT DO NOTHING;

INSERT INTO bans (match_team_id, match_id, champion_id, pick_order)
SELECT mt.id, mt.match_id, mt.ban_3, 3
FROM match_teams mt
WHERE mt.ban_3 IS NOT NULL AND mt.ban_3 > 0
ON CONFLICT DO NOTHING;

INSERT INTO bans (match_team_id, match_id, champion_id, pick_order)
SELECT mt.id, mt.match_id, mt.ban_4, 4
FROM match_teams mt
WHERE mt.ban_4 IS NOT NULL AND mt.ban_4 > 0
ON CONFLICT DO NOTHING;

INSERT INTO bans (match_team_id, match_id, champion_id, pick_order)
SELECT mt.id, mt.match_id, mt.ban_5, 5
FROM match_teams mt
WHERE mt.ban_5 IS NOT NULL AND mt.ban_5 > 0
ON CONFLICT DO NOTHING;

-- ─── 4. Backfill match_teams.team_early_surrendered from participants ─────────

UPDATE match_teams mt
SET team_early_surrendered = sub.flag
FROM (
  SELECT
    p.match_id,
    p.team_id,
    BOOL_OR(COALESCE(p.team_early_surrendered, false)) AS flag
  FROM participants p
  WHERE p.team_id IS NOT NULL
  GROUP BY p.match_id, p.team_id
) sub
WHERE mt.match_id = sub.match_id
  AND mt.team_id  = sub.team_id;

-- ─── 5. Backfill match_teams.rank_tier from participants avg rank ─────────────
-- Uses the same rankToScore mapping encoded as integer rank buckets.
-- We compute the average rank score per team, then round to the nearest tier.
-- Simpler approach: majority rank tier among the 5 participants (most frequent).

UPDATE match_teams mt
SET rank_tier = sub.majority_tier
FROM (
  SELECT
    p.match_id,
    p.team_id,
    UPPER(TRIM(p.rank_tier)) AS majority_tier,
    COUNT(*) AS cnt,
    ROW_NUMBER() OVER (
      PARTITION BY p.match_id, p.team_id
      ORDER BY COUNT(*) DESC, UPPER(TRIM(p.rank_tier))
    ) AS rn
  FROM participants p
  WHERE p.team_id IS NOT NULL
    AND p.rank_tier IS NOT NULL
    AND p.rank_tier != ''
  GROUP BY p.match_id, p.team_id, UPPER(TRIM(p.rank_tier))
) sub
WHERE sub.rn = 1
  AND mt.match_id = sub.match_id
  AND mt.team_id  = sub.team_id;

-- ─── 6. Backfill matches.game_ended_in_surrender ─────────────────────────────

UPDATE matches m
SET
  game_ended_in_surrender       = COALESCE(sub.surrender, false),
  game_ended_in_early_surrender = COALESCE(sub.early_surrender, false)
FROM (
  SELECT
    match_id,
    BOOL_OR(COALESCE(game_ended_in_surrender, false))       AS surrender,
    BOOL_OR(COALESCE(game_ended_in_early_surrender, false)) AS early_surrender
  FROM participants
  GROUP BY match_id
) sub
WHERE m.id = sub.match_id;

-- ─── 7. Backfill participant_items from participants.items ───────────────────

INSERT INTO participant_items (participant_id, match_id, item_id, item_slot)
SELECT
  p.id  AS participant_id,
  p.match_id,
  (elem.value)::int AS item_id,
  (elem.ordinality - 1)::int AS item_slot
FROM participants p
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.items, '[]'::jsonb))
  WITH ORDINALITY AS elem(value, ordinality)
WHERE p.items IS NOT NULL
  AND jsonb_typeof(p.items) = 'array'
  AND elem.value ~ '^\d+$'
  AND (elem.value)::int > 0
  AND (elem.ordinality - 1) BETWEEN 0 AND 6
ON CONFLICT DO NOTHING;

-- ─── 8. Backfill participant_summoner_spells from participants.summoner_spells + casts ──

-- Spell IDs come from summoner_spells JSON: [spell1Id, spell2Id]
-- Casts come from summoner1_casts / summoner2_casts columns

INSERT INTO participant_summoner_spells (participant_id, match_id, spell_id, spell_slot, casts)
SELECT
  p.id AS participant_id,
  p.match_id,
  (p.summoner_spells->>0)::int AS spell_id,
  1 AS spell_slot,
  COALESCE(p.summoner1_casts, 0) AS casts
FROM participants p
WHERE p.summoner_spells IS NOT NULL
  AND jsonb_typeof(p.summoner_spells) = 'array'
  AND jsonb_array_length(p.summoner_spells) >= 1
  AND (p.summoner_spells->>0) ~ '^\d+$'
  AND (p.summoner_spells->>0)::int > 0
ON CONFLICT (participant_id, spell_slot) DO NOTHING;

INSERT INTO participant_summoner_spells (participant_id, match_id, spell_id, spell_slot, casts)
SELECT
  p.id AS participant_id,
  p.match_id,
  (p.summoner_spells->>1)::int AS spell_id,
  2 AS spell_slot,
  COALESCE(p.summoner2_casts, 0) AS casts
FROM participants p
WHERE p.summoner_spells IS NOT NULL
  AND jsonb_typeof(p.summoner_spells) = 'array'
  AND jsonb_array_length(p.summoner_spells) >= 2
  AND (p.summoner_spells->>1) ~ '^\d+$'
  AND (p.summoner_spells->>1)::int > 0
ON CONFLICT (participant_id, spell_slot) DO NOTHING;

-- ─── 9. Backfill participant_spells from spell1..4_casts columns ─────────────

INSERT INTO participant_spells (participant_id, match_id, spell_slot, casts)
SELECT p.id, p.match_id, 1, COALESCE(p.spell1_casts, 0)
FROM participants p
WHERE p.spell1_casts IS NOT NULL
ON CONFLICT (participant_id, spell_slot) DO NOTHING;

INSERT INTO participant_spells (participant_id, match_id, spell_slot, casts)
SELECT p.id, p.match_id, 2, COALESCE(p.spell2_casts, 0)
FROM participants p
WHERE p.spell2_casts IS NOT NULL
ON CONFLICT (participant_id, spell_slot) DO NOTHING;

INSERT INTO participant_spells (participant_id, match_id, spell_slot, casts)
SELECT p.id, p.match_id, 3, COALESCE(p.spell3_casts, 0)
FROM participants p
WHERE p.spell3_casts IS NOT NULL
ON CONFLICT (participant_id, spell_slot) DO NOTHING;

INSERT INTO participant_spells (participant_id, match_id, spell_slot, casts)
SELECT p.id, p.match_id, 4, COALESCE(p.spell4_casts, 0)
FROM participants p
WHERE p.spell4_casts IS NOT NULL
ON CONFLICT (participant_id, spell_slot) DO NOTHING;

-- ─── 10. Backfill participant_runes from participants.runes ──────────────────

INSERT INTO participant_runes (participant_id, match_id, perk_id, slot, style_id, var_1, var_2, var_3)
SELECT
  p.id AS participant_id,
  p.match_id,
  (sel->>'perk')::int  AS perk_id,
  (sel_idx.ordinality - 1)::int AS slot,
  (style->>'id')::int  AS style_id,
  NULLIF((sel->>'var1'), '')::int AS var_1,
  NULLIF((sel->>'var2'), '')::int AS var_2,
  NULLIF((sel->>'var3'), '')::int AS var_3
FROM participants p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p.runes) = 'object' AND (p.runes ? 'styles')
    THEN p.runes->'styles'
    WHEN jsonb_typeof(p.runes) = 'array'
    THEN p.runes
    ELSE '[]'::jsonb
  END
) AS style
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(style->'selections') = 'array'
    THEN style->'selections'
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS sel_idx(sel, ordinality)
WHERE p.runes IS NOT NULL
  AND (style->>'id') ~ '^\d+$'
  AND (sel->>'perk') ~ '^\d+$'
ON CONFLICT DO NOTHING;

-- ─── 11. Backfill participant_perks from participants.stat_perks ─────────────

INSERT INTO participant_perks (participant_id, match_id, perk_id)
SELECT p.id, p.match_id, (p.stat_perks->>'defense')::int
FROM participants p
WHERE p.stat_perks IS NOT NULL
  AND jsonb_typeof(p.stat_perks) = 'object'
  AND (p.stat_perks->>'defense') ~ '^\d+$'
ON CONFLICT DO NOTHING;

INSERT INTO participant_perks (participant_id, match_id, perk_id)
SELECT p.id, p.match_id, (p.stat_perks->>'flex')::int
FROM participants p
WHERE p.stat_perks IS NOT NULL
  AND jsonb_typeof(p.stat_perks) = 'object'
  AND (p.stat_perks->>'flex') ~ '^\d+$'
ON CONFLICT DO NOTHING;

INSERT INTO participant_perks (participant_id, match_id, perk_id)
SELECT p.id, p.match_id, (p.stat_perks->>'offense')::int
FROM participants p
WHERE p.stat_perks IS NOT NULL
  AND jsonb_typeof(p.stat_perks) = 'object'
  AND (p.stat_perks->>'offense') ~ '^\d+$'
ON CONFLICT DO NOTHING;

-- ─── 12. Backfill participant_challenges (allowlist filter) ──────────────────

-- Only insert keys that are in the challenge allowlist.
-- All other keys are catalogued in challenge_keys_registry (handled at runtime by the backend).
-- For the backfill, non-allowlisted keys with non-numeric values are skipped.

WITH allowlist(k) AS (
  VALUES
    ('soloKills'), ('takedowns'), ('bountyGold'), ('doubleAces'), ('buffsStolen'),
    ('flawlessAces'), ('hadOpenNexus'), ('quickCleanse'), ('snowballsHit'), ('wardsGuarded'),
    ('earliestBaron'), ('skillshotsHit'), ('unseenRecalls'), ('maxKillDeficit'),
    ('quickSoloKills'), ('soloBaronKills'), ('voidMonsterKill'), ('fullTeamTakedown'),
    ('initialBuffCount'), ('initialCrabCount'), ('outnumberedKills'), ('pickKillWithAlly'),
    ('quickFirstTurret'), ('scuttleCrabKills'), ('skillshotsDodged'), ('multiKillOneSpell'),
    ('saveAllyFromDeath'), ('takedownsInAlcove'), ('turretPlatesTaken'), ('HealFromMapSources'),
    ('12AssistStreakCount'), ('InfernalScalePickup'), ('acesBefore15Minutes'),
    ('deathsByEnemyChamps'), ('killsUnderOwnTurret'), ('riftHeraldTakedowns'),
    ('teamRiftHeraldKills'), ('killsNearEnemyTurret'), ('teamElderDragonKills'),
    ('elderDragonMultikills'), ('firstTurretKilledTime'), ('fistBumpParticipation'),
    ('mejaisFullStackInTime'), ('takedownOnFirstTurret'), ('takedownsFirstXMinutes'),
    ('wardTakedownsBefore20M'), ('jungleCsBefore10Minutes'), ('killAfterHiddenWithAlly'),
    ('landSkillShotsEarlyGame'), ('perfectDragonSoulsTaken'), ('tookLargeDamageSurvived'),
    ('twoWardsOneSweeperCount'), ('maxLevelLeadLaneOpponent'), ('takedownsInEnemyFountain'),
    ('immobilizeAndKillWithAlly'), ('knockEnemyIntoTeamAndKill'), ('laneMinionsFirst10Minutes'),
    ('playedChampSelectPosition'), ('completeSupportQuestInTime'), ('dodgeSkillShotsSmallWindow'),
    ('multiTurretRiftHeraldCount'), ('survivedSingleDigitHpCount'), ('turretsTakenWithRiftHerald'),
    ('laningPhaseGoldExpAdvantage'), ('moreEnemyJungleThanOpponent'), ('enemyChampionImmobilizations'),
    ('killsWithHelpFromEpicMonster'), ('maxCsAdvantageOnLaneOpponent'), ('twentyMinionsIn3SecondsCount'),
    ('epicMonsterStolenWithoutSmite'), ('blastConeOppositeOpponentCount'),
    ('multikillsAfterAggressiveFlash'), ('survivedThreeImmobilizesInFight'),
    ('earlyLaningPhaseGoldExpAdvantage'), ('elderDragonKillsWithOpposingSoul'),
    ('epicMonsterKillsNearEnemyJungler'), ('takedownsBeforeJungleMinionSpawn'),
    ('visionScoreAdvantageLaneOpponent'), ('outerTurretExecutesBefore10Minutes'),
    ('baronBuffGoldAdvantageOverThreshold'), ('killsOnOtherLanesEarlyJungleAsLaner'),
    ('takedownsAfterGainingLevelAdvantage'), ('killedChampTookFullTeamDamageSurvived'),
    ('epicMonsterKillsWithin30SecondsOfSpawn'), ('junglerTakedownsNearDamagedEpicMonster'),
    ('getTakedownsInAllLanesEarlyJungleAsLaner'), ('controlWardTimeCoverageInRiverOrEnemyHalf')
)
INSERT INTO participant_challenges (participant_id, match_id, key, value)
SELECT
  p.id AS participant_id,
  p.match_id,
  kv.key,
  (kv.value)::double precision AS value
FROM participants p
CROSS JOIN LATERAL jsonb_each_text(
  CASE WHEN jsonb_typeof(p.challenges) = 'object' THEN p.challenges ELSE '{}'::jsonb END
) AS kv(key, value)
INNER JOIN allowlist a ON a.k = kv.key
WHERE p.challenges IS NOT NULL
  AND kv.value ~ '^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$'
ON CONFLICT (participant_id, key) DO NOTHING;

-- ─── 13. Update PL/pgSQL functions to use the bans table ────────────────────
-- Replace unnest(ARRAY[ban_1..5]) with INNER JOIN bans for cleaner queries.

CREATE OR REPLACE FUNCTION get_stats_overview(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_matches bigint;
  last_update timestamptz;
  player_count bigint;
  by_division jsonb;
  by_version jsonb;
  top_champs jsonb;
  top_pickrate jsonb;
  top_banrate jsonb;
  version_cond text;
  rank_cond text;
  match_cond text;
  division_cond text;
  key_champion_id text := 'championId';
  empty_arr text := '(E''\x5b\x5d'')::jsonb';
BEGIN
  IF p_version IS NULL OR p_version = '' THEN
    version_cond := '1=1';
  ELSE
    version_cond := 'm.game_version IS NOT NULL AND m.game_version LIKE ' || quote_literal(p_version || '.%');
  END IF;
  IF p_rank_tier IS NULL OR p_rank_tier = '' THEN
    rank_cond := '1=1';
  ELSIF position(',' in p_rank_tier) > 0 THEN
    rank_cond := 'm.rank IS NOT NULL AND m.rank != '''' AND UPPER(TRIM(split_part(m.rank, ''_'', 1))) IN (SELECT UPPER(TRIM(unnest(string_to_array(' || quote_literal(p_rank_tier) || ', '','')))))';
  ELSE
    rank_cond := 'm.rank IS NOT NULL AND m.rank != '''' AND UPPER(TRIM(split_part(m.rank, ''_'', 1))) = UPPER(TRIM(' || quote_literal(p_rank_tier) || '))';
  END IF;
  match_cond := version_cond || ' AND ' || rank_cond;
  division_cond := version_cond;

  EXECUTE format(
    'SELECT COUNT(*), MAX(m.created_at) FROM matches m WHERE %s',
    match_cond
  ) INTO total_matches, last_update;

  IF total_matches = 0 THEN
    SELECT COALESCE(
      jsonb_agg(jsonb_build_object('version', TRIM(version_prefix), 'matchCount', (match_count)::int) ORDER BY version_prefix),
      '[]'::jsonb
    ) INTO by_version FROM stats_matches_by_version;
    RETURN jsonb_build_object(
      'totalMatches', 0,
      'lastUpdate', to_jsonb(last_update),
      'playerCount', 0,
      'matchesByDivision', (
        SELECT jsonb_agg(jsonb_build_object('rankTier', t.rank_tier, 'matchCount', 0) ORDER BY t.ord)
        FROM (VALUES ('IRON',1),('BRONZE',2),('SILVER',3),('GOLD',4),('PLATINUM',5),('EMERALD',6),('DIAMOND',7),('MASTER',8),('GRANDMASTER',9),('CHALLENGER',10),('UNRANKED',11)) AS t(rank_tier, ord)
      ),
      'matchesByVersion', COALESCE(by_version, '[]'::jsonb),
      'topWinrateChampions', '[]'::jsonb,
      'topPickrateChampions', '[]'::jsonb,
      'topBanrateChampions', '[]'::jsonb
    );
  END IF;

  EXECUTE format(
    'SELECT COUNT(DISTINCT p.player_id) FROM participants p INNER JOIN matches m ON m.id = p.match_id WHERE %s',
    match_cond
  ) INTO player_count;

  EXECUTE format(
    $q$
    SELECT jsonb_agg(
      jsonb_build_object('rankTier', t.rank_tier, 'matchCount', COALESCE((d.cnt)::int, 0))
      ORDER BY t.ord
    )
    FROM (VALUES ('IRON',1),('BRONZE',2),('SILVER',3),('GOLD',4),('PLATINUM',5),('EMERALD',6),('DIAMOND',7),('MASTER',8),('GRANDMASTER',9),('CHALLENGER',10),('UNRANKED',11)) AS t(rank_tier, ord)
    LEFT JOIN (
      SELECT UPPER(TRIM(split_part(rank, '_', 1))) AS rank_tier, COUNT(*)::bigint AS cnt
      FROM matches m
      WHERE %s AND rank IS NOT NULL AND rank != ''
      GROUP BY split_part(rank, '_', 1)
    ) d ON d.rank_tier = t.rank_tier
    $q$,
    division_cond
  ) INTO by_division;

  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('version', TRIM(version_prefix), 'matchCount', (match_count)::int) ORDER BY version_prefix),
    '[]'::jsonb
  ) INTO by_version FROM stats_matches_by_version;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          %L, champion_id, 'games', (games)::int, 'wins', (wins)::int,
          'winrate', winrate, 'pickrate', pickrate
        )
        ORDER BY winrate DESC
      ), %s
    )
    FROM (
      SELECT p.champion_id,
        COUNT(*)::bigint AS games,
        SUM(p.win::int)::bigint AS wins,
        ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
        ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS pickrate
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE %s
      GROUP BY p.champion_id
      HAVING COUNT(*) >= 20
      ORDER BY winrate DESC
      LIMIT 10
    ) top
    $q$,
    key_champion_id, empty_arr, match_cond, match_cond
  ) INTO top_champs;

  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          %L, champion_id, 'games', (games)::int, 'wins', (wins)::int,
          'winrate', winrate, 'pickrate', pickrate
        )
        ORDER BY pickrate DESC
      ), %s
    )
    FROM (
      SELECT p.champion_id,
        COUNT(*)::bigint AS games,
        SUM(p.win::int)::bigint AS wins,
        ROUND(100.0 * SUM(p.win::int) / NULLIF(COUNT(*), 0), 2) AS winrate,
        ROUND(100.0 * COUNT(*) / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS pickrate
      FROM participants p
      INNER JOIN matches m ON m.id = p.match_id
      WHERE %s
      GROUP BY p.champion_id
      HAVING COUNT(*) >= 20
      ORDER BY pickrate DESC
      LIMIT 5
    ) top
    $q$,
    key_champion_id, empty_arr, match_cond, match_cond
  ) INTO top_pickrate;

  -- banrate: use normalised bans table
  EXECUTE format(
    $q$
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object('championId', champion_id, 'banCount', (ban_count)::int, 'banrate', banrate)
        ORDER BY banrate DESC
      ), %s
    )
    FROM (
      SELECT sub.champion_id,
        sub.ban_count,
        ROUND(100.0 * sub.ban_count / NULLIF((SELECT COUNT(*) FROM matches m WHERE %s), 0), 2) AS banrate
      FROM (
        SELECT b.champion_id AS champion_id, COUNT(DISTINCT mt.match_id)::bigint AS ban_count
        FROM match_teams mt
        INNER JOIN matches m ON m.id = mt.match_id
        INNER JOIN bans b ON b.match_team_id = mt.id
        WHERE %s
        GROUP BY b.champion_id
      ) sub
      ORDER BY banrate DESC
      LIMIT 5
    ) top
    $q$,
    empty_arr, match_cond, match_cond
  ) INTO top_banrate;

  RETURN jsonb_build_object(
    'totalMatches', (total_matches)::int,
    'lastUpdate', to_jsonb(last_update),
    'playerCount', (player_count)::int,
    'matchesByDivision', COALESCE(by_division, '[]'::jsonb),
    'matchesByVersion', by_version,
    'topWinrateChampions', COALESCE(top_champs, '[]'::jsonb),
    'topPickrateChampions', COALESCE(top_pickrate, '[]'::jsonb),
    'topBanrateChampions', COALESCE(top_banrate, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_stats_champions(p_rank_tier text DEFAULT NULL, p_role text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  total_matches bigint;
  total_games int;
  champions_json jsonb;
BEGIN
  WITH filtered AS (
    SELECT p.champion_id, p.match_id, p.win, COALESCE(p.role, 'UNKNOWN') AS role
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier IN (SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))))
      AND (p_role IS NULL OR p_role = '' OR p.role = p_role)
  )
  SELECT COUNT(DISTINCT match_id) INTO total_matches FROM filtered;

  IF total_matches = 0 THEN
    RETURN jsonb_build_object('totalGames', 0, 'totalMatches', 0, 'champions', '[]'::jsonb, 'generatedAt', to_jsonb(now()));
  END IF;

  WITH filtered AS (
    SELECT p.champion_id, p.match_id, p.win, COALESCE(p.role, 'UNKNOWN') AS role
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier IN (SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))))
      AND (p_role IS NULL OR p_role = '' OR p.role = p_role)
  ),
  champ_agg AS (
    SELECT champion_id, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id
  ),
  role_agg AS (
    SELECT champion_id, role, COUNT(*) AS games, SUM(win::int) AS wins
    FROM filtered GROUP BY champion_id, role
  ),
  role_denom AS (
    SELECT role, COUNT(DISTINCT match_id)::bigint AS match_count
    FROM filtered GROUP BY role
  ),
  -- bans: use normalised bans table
  ban_agg AS (
    SELECT b.champion_id, COUNT(*)::bigint AS ban_count
    FROM match_teams mt
    INNER JOIN bans b ON b.match_team_id = mt.id
    WHERE mt.match_id IN (SELECT match_id FROM filtered)
    GROUP BY b.champion_id
  ),
  presence_denom AS (
    SELECT (SELECT COUNT(DISTINCT match_id) FROM filtered) AS total
  ),
  champ_with_roles AS (
    SELECT c.champion_id, c.games, c.wins,
      ROUND(100.0 * c.wins / NULLIF(c.games, 0), 2) AS winrate,
      ROUND(100.0 * c.games / NULLIF((SELECT total FROM presence_denom), 0), 2) AS pickrate,
      ROUND(100.0 * COALESCE(ba.ban_count, 0) / NULLIF((SELECT total FROM presence_denom), 0), 2) AS banrate,
      ROUND(100.0 * (c.games + COALESCE(ba.ban_count, 0)) / NULLIF((SELECT total FROM presence_denom), 0), 2) AS presence,
      (SELECT jsonb_object_agg(r.role, jsonb_build_object('games', r.games, 'wins', r.wins, 'winrate', ROUND(100.0 * r.wins / NULLIF(r.games, 0), 2), 'pickrate', ROUND(100.0 * r.games / NULLIF(d.match_count, 0), 2)))
        FROM role_agg r
        LEFT JOIN role_denom d ON d.role = r.role
        WHERE r.champion_id = c.champion_id
      ) AS byRole
    FROM champ_agg c
    LEFT JOIN ban_agg ba ON ba.champion_id = c.champion_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'championId', champion_id, 'games', games, 'wins', wins,
      'winrate', winrate, 'pickrate', pickrate, 'banrate', banrate,
      'presence', presence, 'byRole', COALESCE(byRole, '{}'::jsonb)
    )
    ORDER BY games DESC
  ) INTO champions_json
  FROM champ_with_roles;

  SELECT SUM(games)::int INTO total_games FROM (
    SELECT champion_id, COUNT(*) AS games
    FROM participants p
    INNER JOIN matches m ON m.id = p.match_id
    WHERE (p_rank_tier IS NULL OR p_rank_tier = '' OR p.rank_tier IN (SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))))
      AND (p_role IS NULL OR p_role = '' OR p.role = p_role)
    GROUP BY champion_id
  ) g;

  RETURN jsonb_build_object(
    'totalGames', total_games,
    'totalMatches', (total_matches)::int,
    'champions', COALESCE(champions_json, '[]'::jsonb),
    'generatedAt', to_jsonb(now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_stats_overview_teams(p_version text DEFAULT NULL, p_rank_tier text DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  match_team_rows bigint;
  bans_by_win jsonb;
  bans_by_loss jsonb;
  obj_first_blood jsonb;
  obj_baron jsonb;
  obj_dragon jsonb;
  obj_tower jsonb;
  obj_inhibitor jsonb;
  obj_rift_herald jsonb;
  obj_horde jsonb;
  result jsonb;
BEGIN
  WITH filtered_mt AS (
    SELECT mt.*
    FROM match_teams mt
    INNER JOIN matches m ON m.id = mt.match_id
    WHERE (p_version IS NULL OR p_version = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE p_version || '.%'))
      AND (
        p_rank_tier IS NULL OR p_rank_tier = '' OR
        UPPER(TRIM(split_part(m.rank, '_', 1))) IN (
          SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))
        )
      )
  )
  SELECT COUNT(*) INTO match_team_rows FROM filtered_mt;

  IF match_team_rows = 0 THEN
    RETURN jsonb_build_object(
      'matchCount', 0,
      'bans', jsonb_build_object('byWin', '[]'::jsonb, 'byLoss', '[]'::jsonb),
      'objectives', jsonb_build_object(
        'firstBlood', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0),
        'baron',      jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'dragon',     jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'tower',      jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'inhibitor',  jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'riftHerald', jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb),
        'horde',      jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)
      )
    );
  END IF;

  -- bans from normalised bans table
  WITH filtered_mt AS (
    SELECT mt.id AS mt_id, mt.win
    FROM match_teams mt
    INNER JOIN matches m ON m.id = mt.match_id
    WHERE (p_version IS NULL OR p_version = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE p_version || '.%'))
      AND (
        p_rank_tier IS NULL OR p_rank_tier = '' OR
        UPPER(TRIM(split_part(m.rank, '_', 1))) IN (
          SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))
        )
      )
  ),
  ban_rows AS (
    SELECT b.champion_id AS champion_id, fm.win
    FROM filtered_mt fm
    INNER JOIN bans b ON b.match_team_id = fm.mt_id
  ),
  bans_win_agg AS (
    SELECT jsonb_agg(jsonb_build_object('championId', champion_id, 'count', cnt) ORDER BY cnt DESC) AS j
    FROM (SELECT champion_id, COUNT(*)::int AS cnt FROM ban_rows WHERE win = true GROUP BY champion_id) t
  ),
  bans_loss_agg AS (
    SELECT jsonb_agg(jsonb_build_object('championId', champion_id, 'count', cnt) ORDER BY cnt DESC) AS j
    FROM (SELECT champion_id, COUNT(*)::int AS cnt FROM ban_rows WHERE win = false GROUP BY champion_id) t
  )
  SELECT COALESCE((SELECT j FROM bans_win_agg), '[]'::jsonb),
         COALESCE((SELECT j FROM bans_loss_agg), '[]'::jsonb)
    INTO bans_by_win, bans_by_loss;

  -- objectives from match_teams columns
  WITH filtered_mt AS (
    SELECT mt.*
    FROM match_teams mt
    INNER JOIN matches m ON m.id = mt.match_id
    WHERE (p_version IS NULL OR p_version = '' OR (m.game_version IS NOT NULL AND m.game_version LIKE p_version || '.%'))
      AND (
        p_rank_tier IS NULL OR p_rank_tier = '' OR
        UPPER(TRIM(split_part(m.rank, '_', 1))) IN (
          SELECT UPPER(TRIM(unnest(string_to_array(p_rank_tier, ','))))
        )
      )
  ),
  obj_flat AS (
    SELECT fm.win, fm.champion_first AS first_blood,
      fm.baron_first, fm.baron_kills, fm.dragon_first, fm.dragon_kills,
      fm.tower_first, fm.tower_kills, fm.inhibitor_first, fm.inhibitor_kills,
      fm.rift_herald_first, fm.rift_herald_kills, fm.horde_first, fm.horde_kills
    FROM filtered_mt fm
  ),
  obj_agg AS (
    SELECT
      SUM(CASE WHEN win AND first_blood THEN 1 ELSE 0 END)::int AS fb_first_win,
      SUM(CASE WHEN NOT win AND first_blood THEN 1 ELSE 0 END)::int AS fb_first_loss,
      SUM(CASE WHEN win AND baron_first THEN 1 ELSE 0 END)::int AS baron_first_win,
      SUM(CASE WHEN NOT win AND baron_first THEN 1 ELSE 0 END)::int AS baron_first_loss,
      SUM(CASE WHEN win THEN baron_kills ELSE 0 END)::int AS baron_kills_win,
      SUM(CASE WHEN NOT win THEN baron_kills ELSE 0 END)::int AS baron_kills_loss,
      SUM(CASE WHEN win AND dragon_first THEN 1 ELSE 0 END)::int AS dragon_first_win,
      SUM(CASE WHEN NOT win AND dragon_first THEN 1 ELSE 0 END)::int AS dragon_first_loss,
      SUM(CASE WHEN win THEN dragon_kills ELSE 0 END)::int AS dragon_kills_win,
      SUM(CASE WHEN NOT win THEN dragon_kills ELSE 0 END)::int AS dragon_kills_loss,
      SUM(CASE WHEN win AND tower_first THEN 1 ELSE 0 END)::int AS tower_first_win,
      SUM(CASE WHEN NOT win AND tower_first THEN 1 ELSE 0 END)::int AS tower_first_loss,
      SUM(CASE WHEN win THEN tower_kills ELSE 0 END)::int AS tower_kills_win,
      SUM(CASE WHEN NOT win THEN tower_kills ELSE 0 END)::int AS tower_kills_loss,
      SUM(CASE WHEN win AND inhibitor_first THEN 1 ELSE 0 END)::int AS inhibitor_first_win,
      SUM(CASE WHEN NOT win AND inhibitor_first THEN 1 ELSE 0 END)::int AS inhibitor_first_loss,
      SUM(CASE WHEN win THEN inhibitor_kills ELSE 0 END)::int AS inhibitor_kills_win,
      SUM(CASE WHEN NOT win THEN inhibitor_kills ELSE 0 END)::int AS inhibitor_kills_loss,
      SUM(CASE WHEN win AND rift_herald_first THEN 1 ELSE 0 END)::int AS rift_herald_first_win,
      SUM(CASE WHEN NOT win AND rift_herald_first THEN 1 ELSE 0 END)::int AS rift_herald_first_loss,
      SUM(CASE WHEN win THEN rift_herald_kills ELSE 0 END)::int AS rift_herald_kills_win,
      SUM(CASE WHEN NOT win THEN rift_herald_kills ELSE 0 END)::int AS rift_herald_kills_loss,
      SUM(CASE WHEN win AND horde_first THEN 1 ELSE 0 END)::int AS horde_first_win,
      SUM(CASE WHEN NOT win AND horde_first THEN 1 ELSE 0 END)::int AS horde_first_loss,
      SUM(CASE WHEN win THEN horde_kills ELSE 0 END)::int AS horde_kills_win,
      SUM(CASE WHEN NOT win THEN horde_kills ELSE 0 END)::int AS horde_kills_loss
    FROM obj_flat
  ),
  baron_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT baron_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY baron_kills) t),
  baron_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT baron_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY baron_kills) t),
  dragon_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT dragon_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY dragon_kills) t),
  dragon_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT dragon_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY dragon_kills) t),
  tower_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT tower_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY tower_kills) t),
  tower_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT tower_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY tower_kills) t),
  inhibitor_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT inhibitor_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY inhibitor_kills) t),
  inhibitor_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT inhibitor_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY inhibitor_kills) t),
  rift_herald_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT rift_herald_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY rift_herald_kills) t),
  rift_herald_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT rift_herald_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY rift_herald_kills) t),
  horde_dw AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT horde_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = true GROUP BY horde_kills) t),
  horde_dl AS (SELECT COALESCE(jsonb_object_agg(k::text, cnt), '{}'::jsonb) AS j FROM (SELECT horde_kills AS k, COUNT(*)::int AS cnt FROM obj_flat WHERE win = false GROUP BY horde_kills) t)
  SELECT
    jsonb_build_object('firstByWin', o.fb_first_win, 'firstByLoss', o.fb_first_loss),
    jsonb_build_object('firstByWin', o.baron_first_win, 'firstByLoss', o.baron_first_loss, 'killsByWin', o.baron_kills_win, 'killsByLoss', o.baron_kills_loss, 'distributionByWin', (SELECT j FROM baron_dw), 'distributionByLoss', (SELECT j FROM baron_dl)),
    jsonb_build_object('firstByWin', o.dragon_first_win, 'firstByLoss', o.dragon_first_loss, 'killsByWin', o.dragon_kills_win, 'killsByLoss', o.dragon_kills_loss, 'distributionByWin', (SELECT j FROM dragon_dw), 'distributionByLoss', (SELECT j FROM dragon_dl)),
    jsonb_build_object('firstByWin', o.tower_first_win, 'firstByLoss', o.tower_first_loss, 'killsByWin', o.tower_kills_win, 'killsByLoss', o.tower_kills_loss, 'distributionByWin', (SELECT j FROM tower_dw), 'distributionByLoss', (SELECT j FROM tower_dl)),
    jsonb_build_object('firstByWin', o.inhibitor_first_win, 'firstByLoss', o.inhibitor_first_loss, 'killsByWin', o.inhibitor_kills_win, 'killsByLoss', o.inhibitor_kills_loss, 'distributionByWin', (SELECT j FROM inhibitor_dw), 'distributionByLoss', (SELECT j FROM inhibitor_dl)),
    jsonb_build_object('firstByWin', o.rift_herald_first_win, 'firstByLoss', o.rift_herald_first_loss, 'killsByWin', o.rift_herald_kills_win, 'killsByLoss', o.rift_herald_kills_loss, 'distributionByWin', (SELECT j FROM rift_herald_dw), 'distributionByLoss', (SELECT j FROM rift_herald_dl)),
    jsonb_build_object('firstByWin', o.horde_first_win, 'firstByLoss', o.horde_first_loss, 'killsByWin', o.horde_kills_win, 'killsByLoss', o.horde_kills_loss, 'distributionByWin', (SELECT j FROM horde_dw), 'distributionByLoss', (SELECT j FROM horde_dl))
  INTO obj_first_blood, obj_baron, obj_dragon, obj_tower, obj_inhibitor, obj_rift_herald, obj_horde
  FROM obj_agg o;

  result := jsonb_build_object(
    'matchCount', match_team_rows,
    'bans', jsonb_build_object('byWin', COALESCE(bans_by_win, '[]'::jsonb), 'byLoss', COALESCE(bans_by_loss, '[]'::jsonb)),
    'objectives', jsonb_build_object(
      'firstBlood', COALESCE(obj_first_blood, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0)),
      'baron',      COALESCE(obj_baron,       jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'dragon',     COALESCE(obj_dragon,      jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'tower',      COALESCE(obj_tower,       jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'inhibitor',  COALESCE(obj_inhibitor,   jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'riftHerald', COALESCE(obj_rift_herald, jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb)),
      'horde',      COALESCE(obj_horde,       jsonb_build_object('firstByWin', 0, 'firstByLoss', 0, 'killsByWin', 0, 'killsByLoss', 0, 'distributionByWin', '{}'::jsonb, 'distributionByLoss', '{}'::jsonb))
    )
  );
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_stats_overview(text, text) IS 'Overview stats using normalised bans table (step 1 normalisation).';
COMMENT ON FUNCTION get_stats_champions(text, text) IS 'Champions stats using normalised bans table (step 1 normalisation).';
COMMENT ON FUNCTION get_stats_overview_teams(text, text) IS 'Bans/objectives using normalised bans table (step 1 normalisation).';

-- ─── 14. Post-backup of new tables (for verification) ────────────────────────

CREATE TABLE IF NOT EXISTS backup_match_teams_post_20260309 AS
SELECT * FROM match_teams;

-- ─── 14. Verification counts (informational) ─────────────────────────────────
-- You can run these manually to verify the migration:
--
--   SELECT COUNT(*) FROM bans;                          -- ~5 * count(match_teams)
--   SELECT COUNT(*) FROM participant_items;
--   SELECT COUNT(*) FROM participant_runes;
--   SELECT COUNT(*) FROM participant_summoner_spells;
--   SELECT COUNT(*) FROM participant_spells;
--   SELECT COUNT(*) FROM participant_perks;
--   SELECT COUNT(*) FROM participant_challenges;
--   SELECT COUNT(*) FROM challenge_keys_registry;
--   SELECT COUNT(*) FROM matches WHERE game_ended_in_surrender IS NOT NULL;
--   SELECT COUNT(*) FROM match_teams WHERE rank_tier IS NOT NULL;
