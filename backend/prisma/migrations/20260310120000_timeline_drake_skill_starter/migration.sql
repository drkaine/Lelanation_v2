-- Timeline ingestion additions:
--   1. challenge_keys_registry: add poll_value column
--   2. participant_items: add starter column
--   3. match_teams_drake: new table (drake kills per team with soul)
--   4. participant_spell_orders: new table (skill level-up order per participant)
--
-- Rollback (for reference, not executed automatically):
--   ALTER TABLE challenge_keys_registry DROP COLUMN IF EXISTS poll_value;
--   ALTER TABLE participant_items DROP COLUMN IF EXISTS starter;
--   DROP TABLE IF EXISTS participant_spell_orders;
--   DROP TABLE IF EXISTS match_teams_drake;

-- 1. challenge_keys_registry.poll_value
ALTER TABLE challenge_keys_registry
  ADD COLUMN IF NOT EXISTS poll_value boolean NOT NULL DEFAULT true;

-- 2. participant_items.starter
ALTER TABLE participant_items
  ADD COLUMN IF NOT EXISTS starter boolean NOT NULL DEFAULT false;

-- 3. match_teams_drake
CREATE TABLE IF NOT EXISTS match_teams_drake (
  id            BIGSERIAL PRIMARY KEY,
  match_id      BIGINT NOT NULL,
  match_team_id BIGINT NOT NULL,
  drake_type    TEXT   NOT NULL,
  soul          TEXT   NULL,
  "order"       INT    NOT NULL,
  CONSTRAINT fk_match_teams_drake_team
    FOREIGN KEY (match_team_id) REFERENCES match_teams (id) ON DELETE CASCADE,
  CONSTRAINT uq_match_teams_drake_team_order
    UNIQUE (match_team_id, "order")
);

CREATE INDEX IF NOT EXISTS idx_match_teams_drake_match_id      ON match_teams_drake (match_id);
CREATE INDEX IF NOT EXISTS idx_match_teams_drake_match_team_id ON match_teams_drake (match_team_id);
CREATE INDEX IF NOT EXISTS idx_match_teams_drake_drake_type    ON match_teams_drake (drake_type);

-- 4. participant_spell_orders
CREATE TABLE IF NOT EXISTS participant_spell_orders (
  id             BIGSERIAL PRIMARY KEY,
  participant_id BIGINT NOT NULL,
  match_id       BIGINT NOT NULL,
  spell_slot     INT    NOT NULL,
  "order"        INT    NOT NULL,
  timestamp_ms   INT    NOT NULL,
  CONSTRAINT fk_participant_spell_orders_participant
    FOREIGN KEY (participant_id) REFERENCES participants (id) ON DELETE CASCADE,
  CONSTRAINT uq_participant_spell_orders_pid_order
    UNIQUE (participant_id, "order")
);

CREATE INDEX IF NOT EXISTS idx_participant_spell_orders_participant_id ON participant_spell_orders (participant_id);
CREATE INDEX IF NOT EXISTS idx_participant_spell_orders_match_id       ON participant_spell_orders (match_id);
