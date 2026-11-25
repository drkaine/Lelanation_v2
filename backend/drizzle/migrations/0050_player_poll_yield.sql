-- Priorité par rendement : rythme mesuré (parties classées / jour) et date du prochain poll.
ALTER TABLE players ADD COLUMN IF NOT EXISTS games_per_day real;
--> statement-breakpoint
ALTER TABLE players ADD COLUMN IF NOT EXISTS next_poll_at timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS players_next_poll_at_last_seen_idx ON players (next_poll_at ASC NULLS FIRST, last_seen ASC NULLS FIRST);
