-- Tables pré-calculées pour stats rapides à la première visite.
-- Remplies par un job horaire (refresh precomputed stats).
-- rank_tier/role '' = pas de filtre (global). Les APIs lisent en priorité quand (version null, rank_tier) correspond.

-- Champions: une ligne par (rank_tier, role). '' = global.
CREATE TABLE IF NOT EXISTS stats_precomputed_champions (
  rank_tier text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rank_tier, role)
);

-- Overview (get_stats_overview): une ligne par rank_tier. '' = global.
CREATE TABLE IF NOT EXISTS stats_precomputed_overview (
  rank_tier text NOT NULL DEFAULT '' PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Overview teams
CREATE TABLE IF NOT EXISTS stats_precomputed_overview_teams (
  rank_tier text NOT NULL DEFAULT '' PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Overview detail: (rank_tier, include_smite). '' = global.
CREATE TABLE IF NOT EXISTS stats_precomputed_overview_detail (
  rank_tier text NOT NULL DEFAULT '',
  include_smite boolean NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rank_tier, include_smite)
);

-- Duration-winrate (overview)
CREATE TABLE IF NOT EXISTS stats_precomputed_duration_winrate (
  rank_tier text NOT NULL DEFAULT '' PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sides (overview-sides, version null + un seul rank_tier)
CREATE TABLE IF NOT EXISTS stats_precomputed_sides (
  rank_tier text NOT NULL DEFAULT '' PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Abandons
CREATE TABLE IF NOT EXISTS stats_precomputed_abandons (
  rank_tier text NOT NULL DEFAULT '' PRIMARY KEY,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE stats_precomputed_champions IS 'Champions stats pré-calculés par (rank_tier, role). Rafraîchi par job horaire.';
COMMENT ON TABLE stats_precomputed_overview IS 'Overview stats par rank_tier. Rafraîchi par job horaire.';
COMMENT ON TABLE stats_precomputed_overview_teams IS 'Overview teams par rank_tier. Rafraîchi par job horaire.';
COMMENT ON TABLE stats_precomputed_overview_detail IS 'Overview detail par (rank_tier, include_smite). Rafraîchi par job horaire.';
COMMENT ON TABLE stats_precomputed_duration_winrate IS 'Duration-winrate par rank_tier. Rafraîchi par job horaire.';
COMMENT ON TABLE stats_precomputed_sides IS 'Sides stats par rank_tier. Rafraîchi par job horaire.';
COMMENT ON TABLE stats_precomputed_abandons IS 'Abandons stats par rank_tier. Rafraîchi par job horaire.';
