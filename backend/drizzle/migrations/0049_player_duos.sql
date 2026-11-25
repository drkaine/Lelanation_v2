-- Poller : marqueur de poll (exclusion des duos le même jour) + duos réguliers.
-- player_duos       : paires qui jouent ≥ 10 % de leurs parties ensemble (min 3), puuid_a < puuid_b.
-- player_duo_games  : une ligne par partie commune (rôles, champions, KDA, rang à la date du match).
--                     Conservée hors de `participants` pour survivre aux purges de données brutes.

ALTER TABLE players ADD COLUMN IF NOT EXISTS last_polled_at timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_players_last_polled_at ON players (last_polled_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_rank_history_date ON player_rank_history (date);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS player_duos (
  puuid_a varchar(78) NOT NULL,
  puuid_b varchar(78) NOT NULL,
  region lol_region NOT NULL,
  games_together integer NOT NULL DEFAULT 0,
  wins_together integer NOT NULL DEFAULT 0,
  games_a integer NOT NULL DEFAULT 0,
  games_b integer NOT NULL DEFAULT 0,
  first_game_at date,
  last_game_at date,
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (puuid_a, puuid_b),
  CHECK (puuid_a < puuid_b)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_player_duos_puuid_b ON player_duos (puuid_b);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS player_duo_games (
  riot_match_id text NOT NULL,
  puuid_a varchar(78) NOT NULL,
  puuid_b varchar(78) NOT NULL,
  region lol_region NOT NULL,
  patch text,
  game_date date,
  win boolean NOT NULL,
  role_a text,
  role_b text,
  champion_a integer,
  champion_b integer,
  kills_a integer, deaths_a integer, assists_a integer,
  kills_b integer, deaths_b integer, assists_b integer,
  tier_a lol_rank_tier, division_a text, lp_a smallint,
  tier_b lol_rank_tier, division_b text, lp_b smallint,
  PRIMARY KEY (riot_match_id, puuid_a, puuid_b),
  FOREIGN KEY (puuid_a, puuid_b) REFERENCES player_duos (puuid_a, puuid_b) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_player_duo_games_pair ON player_duo_games (puuid_a, puuid_b);
--> statement-breakpoint
-- Agrégat prêt pour le front : par paire et par couple de rôles.
CREATE OR REPLACE VIEW player_duo_role_stats AS
SELECT
  puuid_a, puuid_b, region, role_a, role_b,
  COUNT(*)::int AS games,
  COUNT(*) FILTER (WHERE win)::int AS wins,
  ROUND(AVG(win::int)::numeric, 4) AS winrate,
  SUM(kills_a)::int AS kills_a, SUM(deaths_a)::int AS deaths_a, SUM(assists_a)::int AS assists_a,
  SUM(kills_b)::int AS kills_b, SUM(deaths_b)::int AS deaths_b, SUM(assists_b)::int AS assists_b,
  MODE() WITHIN GROUP (ORDER BY tier_a) AS usual_tier_a,
  MODE() WITHIN GROUP (ORDER BY tier_b) AS usual_tier_b,
  MAX(game_date) AS last_game_at
FROM player_duo_games
GROUP BY puuid_a, puuid_b, region, role_a, role_b;
--> statement-breakpoint
-- Curseur du cron des duos (matchs.created_at déjà traités) : rafraîchissement incrémental.
CREATE TABLE IF NOT EXISTS duo_refresh_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  last_match_created_at timestamptz
);
--> statement-breakpoint
-- État du balayage des rangs par pages league-v4 (budget du jour, curseur, page par division).
CREATE TABLE IF NOT EXISTS league_sweep_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
