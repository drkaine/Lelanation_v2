-- Stockage : index redondants.
-- player_rank_history : PK (puuid, date, region) + idx_rank_history_lookup (puuid, region, date DESC)
-- couvraient les mêmes requêtes (~1,1 Go chacun). Une seule PK (puuid, region, date) suffit :
-- égalité sur les 3 colonnes (ON CONFLICT), préfixe puuid, et tri date dans les deux sens.
LOCK TABLE player_rank_history IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS player_rank_history_pkey_v2 ON player_rank_history (puuid, region, date);
--> statement-breakpoint
ALTER TABLE player_rank_history DROP CONSTRAINT IF EXISTS player_rank_history_pkey;
--> statement-breakpoint
ALTER TABLE player_rank_history ADD CONSTRAINT player_rank_history_pkey PRIMARY KEY USING INDEX player_rank_history_pkey_v2;
--> statement-breakpoint
DROP INDEX IF EXISTS idx_rank_history_lookup;
--> statement-breakpoint
-- players : ORDER BY last_seen DESC NULLS LAST = parcours inverse de idx_players_last_seen_asc_nulls_first.
DROP INDEX IF EXISTS idx_players_last_seen_desc;
