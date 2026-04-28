-- Remove legacy ingest table cleanup from close_patch() ahead of ingest_* decommission.
DO $$
DECLARE
  fn_def TEXT;
  patched_def TEXT;
BEGIN
  BEGIN
    SELECT pg_get_functiondef('close_patch(text)'::regprocedure) INTO fn_def;
  EXCEPTION
    WHEN undefined_function THEN
      fn_def := NULL;
  END;

  IF fn_def IS NULL THEN
    RETURN;
  END IF;

  patched_def := regexp_replace(
    fn_def,
    E'\\n\\s*DELETE\\s+FROM\\s+ingest_matchs\\s*\\n\\s*WHERE\\s+game_version\\s*=\\s*p_game_version\\s*;\\s*\\n',
    E'\n',
    'gi'
  );

  IF patched_def <> fn_def THEN
    EXECUTE patched_def;
  END IF;
END $$;
