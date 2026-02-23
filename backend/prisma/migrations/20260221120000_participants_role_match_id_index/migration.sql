-- Index pour get_stats_champions(p_rank_tier, p_role) quand p_role est fixé (ex. JUNGLE).
-- Permet un scan par rôle puis join sur match_id sans full table scan.
CREATE INDEX IF NOT EXISTS participants_role_match_id_idx ON participants (role, match_id) WHERE role IS NOT NULL;
