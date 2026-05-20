-- objective_outcome_histogram : retirer atakhan, typer les drakes via type_drake + is_soul.

DELETE FROM objective_outcome_histogram WHERE objective_type = 'atakhan';

ALTER TABLE objective_outcome_histogram
  ADD COLUMN IF NOT EXISTS is_soul BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS type_drake TEXT NULL;

-- Anciens types élémentaires → objective_type = dragon
UPDATE objective_outcome_histogram
SET
  objective_type = 'dragon',
  type_drake = regexp_replace(objective_type, '_drake$', ''),
  is_soul = FALSE
WHERE objective_type ~ '_drake$'
  AND objective_type <> 'dragon';

UPDATE objective_outcome_histogram
SET
  objective_type = 'dragon',
  type_drake = regexp_replace(objective_type, '_soul$', ''),
  is_soul = TRUE
WHERE objective_type ~ '_soul$';

UPDATE objective_outcome_histogram
SET
  objective_type = 'dragon',
  type_drake = 'elder',
  is_soul = FALSE
WHERE objective_type = 'elder';

-- Clé primaire : type_drake nullable → colonne générée pour unicité
ALTER TABLE objective_outcome_histogram
  ADD COLUMN IF NOT EXISTS type_drake_key TEXT GENERATED ALWAYS AS (COALESCE(type_drake, '')) STORED;

ALTER TABLE objective_outcome_histogram
  DROP CONSTRAINT IF EXISTS objective_outcome_histogram_pkey;

ALTER TABLE objective_outcome_histogram
  ADD CONSTRAINT objective_outcome_histogram_pkey PRIMARY KEY (
    patch,
    rank_tier,
    region,
    team,
    objective_type,
    type_drake_key,
    is_soul,
    outcome,
    obj_count
  );

ALTER TABLE objective_outcome_histogram
  DROP CONSTRAINT IF EXISTS objective_outcome_histogram_drake_cols_chk;

ALTER TABLE objective_outcome_histogram
  ADD CONSTRAINT objective_outcome_histogram_drake_cols_chk CHECK (
    (objective_type = 'dragon')
    OR (type_drake IS NULL AND is_soul = FALSE)
  );

CREATE INDEX IF NOT EXISTS objective_outcome_histogram_dragon_idx
  ON objective_outcome_histogram (patch, rank_tier, objective_type, type_drake, is_soul);
