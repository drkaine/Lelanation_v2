-- Types enum canoniques pour role / rank_tier / region (agrégats stats).
-- Conversion des colonnes : migration 0038 (merge doublons MID/SUPPORT avant ALTER).

DO $$ BEGIN
  CREATE TYPE lol_role AS ENUM ('TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lol_rank_tier AS ENUM (
    'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'EMERALD', 'DIAMOND',
    'MASTER', 'GRANDMASTER', 'CHALLENGER', 'UNRANKED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lol_region AS ENUM (
    'EUW1', 'EUN1', 'NA1', 'KR', 'BR1', 'LA1', 'LA2', 'OC1', 'TR1', 'JP1', 'ME1'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION normalize_stats_role_text(t TEXT) RETURNS TEXT AS $$
  SELECT CASE upper(trim(t))
    WHEN 'MID' THEN 'MIDDLE' WHEN 'MIDLANE' THEN 'MIDDLE'
    WHEN 'ADC' THEN 'BOTTOM' WHEN 'BOT' THEN 'BOTTOM'
    WHEN 'SUPPORT' THEN 'UTILITY' WHEN 'SUP' THEN 'UTILITY' WHEN 'UNKNOWN' THEN 'UTILITY'
    ELSE upper(trim(t)) END;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION text_to_lol_role(t TEXT) RETURNS lol_role AS $$
  SELECT normalize_stats_role_text(t)::lol_role;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION text_to_lol_rank_tier(t TEXT) RETURNS lol_rank_tier AS $$
  SELECT upper(trim(t))::lol_rank_tier;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION text_to_lol_region(t TEXT) RETURNS lol_region AS $$
BEGIN
  RETURN CASE lower(trim(t))
    WHEN 'euw' THEN 'EUW1'::lol_region WHEN 'eune' THEN 'EUN1'::lol_region WHEN 'eun' THEN 'EUN1'::lol_region
    WHEN 'na' THEN 'NA1'::lol_region WHEN 'oce' THEN 'OC1'::lol_region WHEN 'oc' THEN 'OC1'::lol_region
    WHEN 'br' THEN 'BR1'::lol_region WHEN 'lan' THEN 'LA1'::lol_region WHEN 'las' THEN 'LA2'::lol_region
    WHEN 'jp' THEN 'JP1'::lol_region WHEN 'tr' THEN 'TR1'::lol_region WHEN 'me' THEN 'ME1'::lol_region
    ELSE upper(trim(t))::lol_region END;
END; $$ LANGUAGE plpgsql IMMUTABLE;
