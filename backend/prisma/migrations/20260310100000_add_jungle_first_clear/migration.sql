-- Migration: add participant_jungle_first_clear
-- Additive migration: new table only, no existing tables modified.
-- Source: timeline participantFrames[].jungleMinionsKilled delta per 1-min frame.
-- Only populated for participants with role='JUNGLE', capped at first-clear length (~8-10 camps).

-- rollback:
--   DROP TABLE IF EXISTS "participant_jungle_first_clear";

CREATE TABLE "participant_jungle_first_clear" (
    "id"             BIGSERIAL       NOT NULL,
    "participant_id" BIGINT          NOT NULL,
    "match_id"       BIGINT          NOT NULL,
    "order_index"    INTEGER         NOT NULL,
    "timestamp_ms"   INTEGER         NOT NULL,

    CONSTRAINT "participant_jungle_first_clear_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "participant_jungle_first_clear"
    ADD CONSTRAINT "participant_jungle_first_clear_participant_id_fkey"
    FOREIGN KEY ("participant_id")
    REFERENCES "participants"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE;

CREATE UNIQUE INDEX "participant_jungle_first_clear_participant_id_order_index_key"
    ON "participant_jungle_first_clear"("participant_id", "order_index");

CREATE INDEX "participant_jungle_first_clear_match_id_participant_id_idx"
    ON "participant_jungle_first_clear"("match_id", "participant_id");

CREATE INDEX "participant_jungle_first_clear_match_id_idx"
    ON "participant_jungle_first_clear"("match_id");
