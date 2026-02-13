# Archivage des versions (stats conservées, limite 100k matchs)

Quand une version atteint le plafond (ex. 100k matchs), on peut l’**archiver** : pré-calculer les stats qu’on veut garder, les stocker dans des tables dédiées, puis supprimer (ou exporter) les lignes brutes pour libérer de l’espace.

## Objectif

- Garder les **mêmes stats** qu’aujourd’hui pour les versions archivées (overview, runes/items/sorts, durée, teams, sides, champions, etc.).
- Réduire fortement le volume : plus de millions de lignes `participants`/`matches` par vieille version.

---

## Option 1 : Tables d’agrégats (recommandée)

Une **table (ou un schéma) dédié** qui stocke, par version archivée, des agrégats pré-calculés : moyennes, min, max, comptages. Les APIs de stats lisent soit les données brutes (version courante), soit ces tables (version archivée).

### 1.1 Ce qu’il faut pouvoir recalculer

D’après les APIs actuelles, il faut au minimum :

| API / usage | Données à archiver |
|-------------|--------------------|
| **Overview** | total matches, top winrate/pickrate/banrate champions, matchesByDivision, matchesByVersion, playerCount |
| **Overview detail** | runes (pickrate/winrate par rune), rune sets, items, item sets, items by order, summoner spells |
| **Duration winrate** | tranches de durée (ex. 5 min) → winrate, nb matchs |
| **Progression** | gainers/losers (delta WR par champion entre versions) — peut rester calculé à la volée si peu de versions |
| **Teams** | bans by win/loss, objectifs (first tower, etc.) |
| **Sides** | winrate par côté, champions/objectives par côté |
| **Champion** | par champion : games, wins, pickrate, winrate, builds, runes, spells, durée |

Tout ça peut être exprimé en **comptages + moyennes (et éventuellement min/max)** par (version, champion_id, rank_tier, role, etc.).

### 1.2 Schéma possible (exemple simplifié)

```sql
-- Métadonnée des versions archivées
CREATE TABLE archived_versions (
  version_prefix   TEXT PRIMARY KEY,   -- ex. '16.1', '16.2'
  archived_at      TIMESTAMPTZ NOT NULL,
  match_count      BIGINT NOT NULL,
  participant_count BIGINT NOT NULL
);

-- Agrégats champion par version (pour overview + pages champion)
CREATE TABLE archived_champion_stats (
  version_prefix   TEXT NOT NULL REFERENCES archived_versions(version_prefix),
  champion_id      INT NOT NULL,
  rank_tier        TEXT,                -- NULL = tous rangs
  role             TEXT,                -- NULL = tous rôles
  games            BIGINT NOT NULL,
  wins             BIGINT NOT NULL,
  ban_count        BIGINT NOT NULL DEFAULT 0,
  avg_duration_sec NUMERIC,
  min_duration_sec INT,
  max_duration_sec INT,
  PRIMARY KEY (version_prefix, champion_id, rank_tier, role)
);

-- Runes / items / spells : distributions pré-agrégées (JSONB)
-- Une ligne par (version, rank_tier?) avec un blob de stats
CREATE TABLE archived_overview_detail (
  version_prefix   TEXT NOT NULL REFERENCES archived_versions(version_prefix),
  rank_tier        TEXT,                -- NULL = tous
  runes_json       JSONB NOT NULL,      -- [{ runeId, pickrate, winrate, games }, ...]
  rune_sets_json   JSONB NOT NULL,
  items_json       JSONB NOT NULL,
  item_sets_json   JSONB NOT NULL,
  items_by_order_json JSONB NOT NULL,
  summoner_spells_json JSONB NOT NULL,
  PRIMARY KEY (version_prefix, rank_tier)
);

-- Duration winrate (tranches 5 min)
CREATE TABLE archived_duration_winrate (
  version_prefix   TEXT NOT NULL,
  rank_tier        TEXT,
  bucket_min       INT NOT NULL,        -- ex. 0, 5, 10, ...
  games            BIGINT NOT NULL,
  wins             BIGINT NOT NULL,
  PRIMARY KEY (version_prefix, rank_tier, bucket_min)
);

-- Teams (bans, objectifs)
CREATE TABLE archived_teams (
  version_prefix   TEXT NOT NULL,
  teams_json       JSONB NOT NULL,      -- structure proche de l’API actuelle
  PRIMARY KEY (version_prefix)
);
```

- **Moyennes / min / max** : là où c’est utile (ex. durée, KDA), les colonnes `avg_*`, `min_*`, `max_*` suffisent.
- **Runes / items / sorts** : garder la même forme que l’API (listes avec pickrate, winrate, etc.) en JSONB pour ne pas multiplier les tables.

### 1.3 Workflow

1. **Déclencher l’archivage** quand une version atteint la limite (ex. 100k matchs) :
   - marquer la version comme “à archiver” (ou lancer un job dédié).
2. **Job d’archivage** (script ou cron) :
   - pour cette version, exécuter les requêtes SQL (ou appels service) qui recalculent tout ce que font aujourd’hui `get_stats_overview`, overview-detail, duration-winrate, teams, etc. ;
   - écrire les résultats dans les tables `archived_*` ;
   - (optionnel) supprimer les `matches` / `participants` dont `game_version` correspond à cette version.
3. **APIs** :
   - si la version demandée est dans `archived_versions` → lire uniquement les tables `archived_*` ;
   - sinon → comportement actuel (requêtes sur `matches` / `participants`).

Comprimer les agrégats en JSONB (gzip côté app ou stockage) est possible mais souvent inutile : le volume par version archivée reste faible (quelques Mo par version).

---

## Option 2 : Compression / export des bruts

- **Export** : exporter `matches` + `participants` de la version en Parquet (ou CSV) vers un stockage froid (S3, disque).
- **Suppression** : supprimer ces lignes de la base principale.
- **Relecture** : pour requêter une version archivée, il faudrait soit recharger dans une table temporaire, soit utiliser un moteur (DuckDB, Athena, etc.) sur les fichiers — plus lourd à intégrer dans l’API actuelle.

Cette approche garde les **données brutes** mais ne réduit pas la charge en base ; elle sert surtout de **backup** et éventuellement d’aliment pour des analyses hors ligne.

---

## Recommandation

- **Court terme** : mettre en place **Option 1** (tables d’agrégats) avec au minimum :
  - `archived_versions`
  - `archived_champion_stats` (games, wins, pickrate, winrate, ban_count, avg/min/max duration)
  - `archived_overview_detail` (runes, items, spells en JSONB)
  - `archived_duration_winrate`
  - `archived_teams` (ou équivalent pour teams/sides)
- **Logique API** : détecter “version archivée” (présence dans `archived_versions`) et brancher sur ces tables au lieu du raw.
- **Option 2** en complément : avant suppression des bruts, exporter une fois en Parquet/S3 pour conservation long terme et analyses futures.

Si tu veux, on peut détailler la prochaine étape concrète : schéma Prisma/migration exacte pour `archived_*` et où brancher la lecture (StatsOverviewService, etc.).
