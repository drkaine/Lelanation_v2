-- agg_champion_bans_by_banner.banned_champion_id est INTEGER ; SMALLINT débordait (22003).
ALTER TABLE champion_bans_by_banner
  ALTER COLUMN banned_champion_id TYPE integer USING banned_champion_id::integer;
