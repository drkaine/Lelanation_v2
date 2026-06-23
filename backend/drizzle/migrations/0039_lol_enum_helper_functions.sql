-- Recrée les helpers enum si absents (0037 peut avoir été marquée appliquée sans les fonctions).

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
