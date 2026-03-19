-- Materialized views + active_patches + refresh + close_patch (plan technique LoL Stats)
-- Ne refresh que les patches "actifs" (en cours ou pas encore à max match).

-- 1. Table des patches actifs (inclus dans les vues matérialisées)
CREATE TABLE IF NOT EXISTS active_patches (
    game_version    TEXT PRIMARY KEY,
    activated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_current      BOOLEAN NOT NULL DEFAULT TRUE
);

-- Bootstrap: un patch = deux premiers segments (ex. 15.1)
INSERT INTO active_patches (game_version, activated_at, is_current)
SELECT DISTINCT (split_part(game_version, '.', 1) || '.' || split_part(game_version, '.', 2)), NOW(), TRUE
FROM champion_core_stats
ON CONFLICT (game_version) DO NOTHING;

-- 2. Vues matérialisées (uniquement les patches actifs ; patch = 2 premiers segments de game_version)
DROP MATERIALIZED VIEW IF EXISTS mv_champion_vs_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_team_core_stats;
DROP MATERIALIZED VIEW IF EXISTS mv_champion_core_stats;

CREATE MATERIALIZED VIEW mv_champion_core_stats AS
SELECT ccs.*
FROM champion_core_stats ccs
WHERE (split_part(ccs.game_version, '.', 1) || '.' || split_part(ccs.game_version, '.', 2)) IN (SELECT game_version FROM active_patches);

CREATE UNIQUE INDEX ON mv_champion_core_stats (champion_id, rank_tier, rank_division, game_version, role, region);

CREATE MATERIALIZED VIEW mv_champion_vs_stats AS
SELECT cvs.champion_stat_id, cvs.opponent_champion_id, cvs.count_win, cvs.count_game,
       ccs.role, ccs.rank_tier, ccs.game_version, ccs.region
FROM champion_vs_stats cvs
JOIN champion_core_stats ccs ON ccs.id = cvs.champion_stat_id
WHERE (split_part(ccs.game_version, '.', 1) || '.' || split_part(ccs.game_version, '.', 2)) IN (SELECT game_version FROM active_patches);

CREATE UNIQUE INDEX ON mv_champion_vs_stats (champion_stat_id, opponent_champion_id);

CREATE MATERIALIZED VIEW mv_team_core_stats AS
SELECT tcs.*
FROM team_core_stats tcs
WHERE (split_part(tcs.game_version, '.', 1) || '.' || split_part(tcs.game_version, '.', 2)) IN (SELECT game_version FROM active_patches);

CREATE UNIQUE INDEX ON mv_team_core_stats (team, rank_tier, rank_division, game_version, region);

-- 3. Fonction de refresh (CONCURRENTLY pour ne pas bloquer les lectures)
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_core_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_champion_vs_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_core_stats;
END;
$$ LANGUAGE plpgsql;

-- 4. Clôture d'un patch : archivage des agrégats + retrait actifs + suppression des données brutes uniquement (plan : pas de DELETE sur les tables d'agrégats)
CREATE OR REPLACE FUNCTION close_patch(p_game_version TEXT)
RETURNS VOID AS $$
DECLARE
    v_table_suffix TEXT := replace(replace(p_game_version, '.', '_'), '-', '_');
    v_count_games  BIGINT;
    v_like_patch   TEXT := p_game_version || '.%';
BEGIN
    IF length(p_game_version) > 0 AND position('.' in p_game_version) > 0 THEN
        v_like_patch := p_game_version || '.%';
    ELSE
        v_like_patch := p_game_version || '%';
    END IF;

    SELECT COUNT(*) INTO v_count_games
    FROM champion_core_stats
    WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

    IF v_count_games = 0 THEN
        RAISE NOTICE 'Aucune donnée agrégée pour le patch %. Retrait du patch actif et suppression données brutes.', p_game_version;
    ELSE
        -- Snapshot des agrégats vers tables d'archive (ex: archive_champion_core_stats_15_1)
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS archive_champion_core_stats_%s AS SELECT * FROM champion_core_stats WHERE game_version = %L OR game_version LIKE %L',
            v_table_suffix, p_game_version, v_like_patch
        );
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS archive_champion_vs_%s AS SELECT cvs.* FROM champion_vs_stats cvs JOIN champion_core_stats ccs ON ccs.id = cvs.champion_stat_id WHERE ccs.game_version = %L OR ccs.game_version LIKE %L',
            v_table_suffix, p_game_version, v_like_patch
        );
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS archive_team_core_stats_%s AS SELECT * FROM team_core_stats WHERE game_version = %L OR game_version LIKE %L',
            v_table_suffix, p_game_version, v_like_patch
        );
        RAISE NOTICE 'Archives créées pour le patch %', p_game_version;
    END IF;

    -- Retirer le patch des actifs (la prochaine REFRESH l''exclura des MVs)
    DELETE FROM active_patches WHERE game_version = p_game_version;

    -- Suppression des données brutes uniquement (CASCADE supprime teams, match_players, etc.)
    DELETE FROM matchs
    WHERE game_version = p_game_version OR game_version LIKE v_like_patch;

    RAISE NOTICE 'Patch % clôturé.', p_game_version;
END;
$$ LANGUAGE plpgsql;
