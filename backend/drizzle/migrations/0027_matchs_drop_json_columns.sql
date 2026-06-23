-- Retrait des colonnes hors schéma (stockage JSON brut match/timeline).

ALTER TABLE matchs DROP COLUMN IF EXISTS match_json;
ALTER TABLE matchs DROP COLUMN IF EXISTS timeline_json;
