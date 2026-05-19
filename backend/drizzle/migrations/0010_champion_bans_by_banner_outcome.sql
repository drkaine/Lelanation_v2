-- Bans comptés selon victoire/défaite de l'équipe qui ban (rempli par ingestion.worker).
ALTER TABLE champion_bans_by_banner
  ADD COLUMN IF NOT EXISTS count_ban_when_team_won  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS count_ban_when_team_lost INTEGER NOT NULL DEFAULT 0;
