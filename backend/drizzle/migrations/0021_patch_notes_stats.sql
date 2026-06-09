-- Agrégats nerf / buff / ajust par entité et patch (alimentés depuis les JSON patch notes).

CREATE TABLE IF NOT EXISTS patch_notes_stats (
  type_cible    VARCHAR(16)  NOT NULL CHECK (type_cible IN ('champion', 'items', 'runes')),
  id_cible      TEXT         NOT NULL,
  game_version  VARCHAR(16)  NOT NULL,
  count_nerf    INT          NOT NULL DEFAULT 0,
  count_up      INT          NOT NULL DEFAULT 0,
  count_ajust   INT          NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (type_cible, id_cible, game_version)
);

CREATE INDEX IF NOT EXISTS patch_notes_stats_game_version_idx
  ON patch_notes_stats (game_version DESC);

CREATE INDEX IF NOT EXISTS patch_notes_stats_type_id_idx
  ON patch_notes_stats (type_cible, id_cible);
