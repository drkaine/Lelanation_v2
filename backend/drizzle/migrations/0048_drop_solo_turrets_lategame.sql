-- Patch 16.23 (fixtures 2026-11-17) : challenges.soloTurretsLategame retiré de match-v5.
-- teams[].objectives.atakhan (absent aussi) n'a jamais été persisté.

ALTER TABLE participants DROP COLUMN IF EXISTS solo_turrets_lategame;

ALTER TABLE champion_stats DROP COLUMN IF EXISTS sum_solo_turrets_lategame;

UPDATE participants
SET challenges_extra = challenges_extra - 'soloTurretsLategame'
WHERE challenges_extra ? 'soloTurretsLategame';
