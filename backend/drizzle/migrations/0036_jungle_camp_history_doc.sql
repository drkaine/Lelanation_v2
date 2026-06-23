-- Jungle path dérivé stocké dans jungle_camp_history.early_path (plus de colonnes dédiées).

UPDATE participants
SET jungle_camp_history = jsonb_build_object(
  'camps',
  CASE
    WHEN jsonb_typeof(jungle_camp_history) = 'array' THEN jungle_camp_history
    WHEN jungle_camp_history ? 'camps' THEN jungle_camp_history->'camps'
    ELSE '[]'::jsonb
  END,
  'early_path',
  jsonb_build_object(
    'path_sequence', to_jsonb(jungle_path_sequence),
    'path_hash', jungle_path_hash,
    'clear_time_ms', jungle_clear_time_ms
  )
)
WHERE jungle_path_hash IS NOT NULL;

UPDATE participants
SET jungle_camp_history = jsonb_build_object('camps', jungle_camp_history)
WHERE jsonb_typeof(jungle_camp_history) = 'array';

ALTER TABLE participants DROP COLUMN IF EXISTS jungle_path_sequence;
ALTER TABLE participants DROP COLUMN IF EXISTS jungle_path_hash;
ALTER TABLE participants DROP COLUMN IF EXISTS jungle_clear_time_ms;

ALTER TABLE participants
  ALTER COLUMN jungle_camp_history SET DEFAULT '{"camps":[],"early_path":null}'::jsonb;
