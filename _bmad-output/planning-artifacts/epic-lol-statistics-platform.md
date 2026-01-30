# EPIC — Plateforme de statistiques League of Legends (type Porofessor / League of Graphs)

**Version :** 1.0  
**Contexte projet :** Lelanation v2 — utilisation de l’API officielle Riot Games, clé `RIOT_API_KEY` dans `backend/.env`.

---

## 1. Objectif global

Construire un **pipeline de collecte et d’agrégation** qui :

- Utilise **uniquement l’API officielle Riot Games**, authentifiée via **`RIOT_API_KEY`** lue depuis **`backend/.env`**.
- Collecte les matchs joués **en Europe** (régions EUW, EUNE).
- Normalise, stocke et agrège les données pour produire des **statistiques de type Porofessor / League of Graphs** : winrate, pickrate, objets les plus joués, builds, runes, rôles, elos, patchs.
- Expose ces statistiques via une **API interne** et une **interface web** (frontend Lelanation).

**Valeur livrée :** Les stats ne sont pas fournies par Riot ; elles sont **calculées** à partir des matchs bruts. La valeur est dans le **pipeline + le volume de données + les agrégations**.

---

## 2. Problème à résoudre

- Riot ne fournit **aucune statistique agrégée** (winrate, builds populaires, tier lists).
- Les données existent uniquement **au niveau des matchs individuels** (Match API v5).
- Il faut donc :
  - collecter un **volume important de matchs** en Europe ;
  - **reconstruire les statistiques par calcul** ;
  - respecter les **rate limits** de l’API Riot ;
  - fournir des données **fiables, filtrables et mises à jour** régulièrement.

---

## 3. Configuration et périmètre technique

### 3.1 Clé API

- **Variable d’environnement :** `RIOT_API_KEY`
- **Emplacement :** `backend/.env`
- **Usage :** Toutes les requêtes vers les APIs Riot (Summoner, League, Match v5) doivent envoyer cette clé (header ou query selon spécification Riot).
- **Sécurité :** La clé ne doit jamais être exposée au frontend ; tout passe par le backend.

### 3.2 Régions ciblées (Europe)

| Région  | Routing value Riot | Périmètre |
|--------|---------------------|-----------|
| EUW    | `euw1`              | Inclus    |
| EUNE   | `eun1`              | Inclus    |

*Extension possible plus tard : TR1, RU (selon définition “Europe”).*

### 3.3 Type de matchs collectés

- **Uniquement Ranked Solo/Duo** (pas de Flex Queue).
- Filtrage strict : `queueId = 420` (Ranked Solo/Duo) dans les matchs récupérés.
- Exclusion explicite des autres queues (Flex, Normal, ARAM, etc.).

### 3.4 Portée de l’EPIC

**Inclus :**

- Utilisation **exclusive** de l’API officielle Riot Games (`RIOT_API_KEY`).
- Collecte automatisée de matchs **Ranked Solo/Duo uniquement** (queueId 420).
- Stockage structuré des données (backend Lelanation).
- Calcul d’agrégations : winrate, pickrate, objets, builds, runes, par **rang**, elo, patch, rôle.
- **Tri et filtrage par rang** (Iron, Bronze, Silver, Gold, Platinum, Emerald, Diamond, Master, Grandmaster, Challenger).
- **Meilleurs joueurs** : classement des joueurs par winrate, nombre de parties, rang.
- **OTP (One Trick Pony)** : identification et classement des meilleurs OTP par champion (joueurs qui jouent principalement un champion).
- API interne pour exposer les stats.
- Frontend de consultation des statistiques (pages dédiées dans le site Lelanation).

**Hors scope initial :**

- Ranked Flex Queue.
- Overlay in-game, coaching temps réel, analyse replay.
- Scraping du client Riot (interdit).
- Données brutes de match exposées publiquement (uniquement agrégats).

---

## 4. Sources de données Riot

APIs utilisées (avec `RIOT_API_KEY`) :

- **Summoner API** — résolution puuid / compte.
- **League API** — classements (pour découvrir des joueurs par elo).
- **Match API v5** — liste de match IDs, puis détails de chaque match.
- **Data Dragon (statique)** — déjà utilisé par Lelanation pour champions, items, runes (pas d’authentification).

Données utiles par match (côté participant) :

- Champion joué, victoire/défaite.
- Items finaux (build).
- Runes (arbre principal + secondaire + shards).
- Sorts d’invocateur.
- Rôle / lane.
- Patch (déduit de la version du match ou métadonnées).
- Durée, rang du joueur (si disponible).

---

## 5. Logique métier des statistiques

Toutes les statistiques sont **calculées** à partir des matchs stockés, jamais récupérées “clé en main” depuis Riot.

Exemples (alignés Porofessor / League of Graphs) :

- **Winrate champion**  
  `nombre de victoires / nombre total de parties` (par patch/elo/rôle si besoin).
- **Pickrate**  
  `(nombre de parties où le champion est joué) / (total parties)`.
- **Build le plus joué**  
  Groupement par `(champion_id + ensemble des items finaux)` ; tri par nombre de parties.
- **Build au meilleur winrate**  
  Même groupement, tri par winrate (avec seuil minimal de parties).
- **Objets les plus utilisés**  
  Agrégation par `champion_id` + `item_id` (et optionnellement rôle/elo/patch).
- **Runes les plus jouées / les plus performantes**  
  Agrégation par page de runes (ou rune principale + secondaires), avec winrate.
- **Stats par elo / rôle / patch**  
  Filtrage des participants puis mêmes formules.

---

## 6. Architecture technique (intégration Lelanation)

### 6.1 Backend (existant + à étendre)

- **Stack :** Node.js, Express (déjà en place).
- **Config :** `RIOT_API_KEY` chargée depuis `backend/.env` (ex. via `dotenv`).
- **Nouveaux éléments à prévoir :**
  - **PostgreSQL** : base de données dédiée aux statistiques (voir section 6.2).
  - **ORM/Query Builder** : Prisma ou TypeORM pour la gestion de la DB.
  - Workers / jobs asynchrones pour la collecte (cron toutes les 2-4 heures).
  - Client HTTP dédié pour les appels Riot (rate limit, retry, backoff).
  - Cache (ex. Redis) recommandé : cache des réponses API, file d’attente, respect des rate limits, cache des agrégats calculés.

### 6.2 Décision architecturale : Base de données vs JSON

**Analyse :**

Le projet Lelanation utilise actuellement un **stockage basé sur fichiers JSON** pour les builds et données de jeu. Cependant, pour les statistiques de matchs LoL, une **base de données relationnelle (PostgreSQL) est nécessaire** pour les raisons suivantes :

**Pourquoi une DB est nécessaire :**

1. **Volume massif** : Des millions de matchs seront collectés (chaque match = 10 participants). Les fichiers JSON ne permettent pas de requêtes efficaces sur de tels volumes.

2. **Requêtes complexes** :
   - Tri par rang (Iron → Challenger) avec filtres multiples (champion, rôle, patch).
   - Recherche de meilleurs joueurs (requêtes avec GROUP BY, ORDER BY, LIMIT).
   - Identification d’OTP (calcul de % de parties sur un champion par joueur).
   - Agrégations multi-dimensionnelles (champion × rang × rôle × patch).

3. **Indexation** : Besoin d’index sur `puuid`, `champion_id`, `rank_tier`, `match_id`, `game_creation` pour des performances acceptables.

4. **Intégrité référentielle** : Relations entre matches, participants, joueurs nécessitent une DB pour éviter les incohérences.

5. **Concurrence** : Les agrégations et la collecte simultanées nécessitent des transactions.

**Décision :**

- **PostgreSQL** sera utilisé **uniquement pour les statistiques de matchs** (pas pour les builds ni les données de jeu statiques qui restent en JSON).
- **Isolation** : La DB stats est indépendante du reste du système (builds, game data restent en JSON).
- **Migration** : Les données JSON existantes (si présentes) seront migrées vers PostgreSQL lors de la mise en place.

**Stack technique :**

- **PostgreSQL** : base de données principale pour matches, participants, joueurs, agrégats.
- **Redis** : cache API, file de requêtes, compteurs de rate limit, cache des agrégats calculés.
- **ORM/Query Builder** : Prisma ou TypeORM (à décider en design détaillé) pour la gestion de la DB.

### 6.3 Frontend

- **Nuxt** (existant) : pages dédiées, par exemple :
  - Champions (winrate, pickrate, par rôle/elo/patch).
  - Builds (builds les plus joués, meilleur winrate).
  - Runes (pages les plus jouées / performantes).
  - Filtres : patch, elo, région (EUW/EUNE).

---

## 7. Pipeline de données

```
RIOT_API_KEY (backend/.env)
         │
         ▼
┌─────────────────────┐
│  Riot APIs          │  Summoner, League, Match v5
│  (EUW + EUNE)       │
└──────────┬──────────┘
           │
           ▼
  Liste de joueurs classés (par elo / région)
           │
           ▼
  Match IDs par joueur (éviter doublons par matchId)
           │
           ▼
  Détails des matchs (Match v5)
           │
           ▼
  Normalisation (champion, items, runes, rôle, win, etc.)
           │
           ▼
  Stockage (DB / fichiers)
           │
           ▼
  Agrégations périodiques (cron / job)
           │
           ├─→ Patch actuel : données brutes conservées
           │
           └─→ Anciens patchs : archivage (agrégats uniquement, données brutes supprimées)
           │
           ▼
  API statistiques (backend)
           │
           ▼
  Frontend (Nuxt)
```

---

## 8. Modèle de données PostgreSQL

### 8.1 Tables principales

**matches**
- `id` (BIGSERIAL PRIMARY KEY)
- `match_id` (VARCHAR UNIQUE) — ID Riot du match
- `region` (VARCHAR) — euw1, eun1
- `queue_id` (INTEGER) — 420 pour Ranked Solo/Duo
- `game_version` (VARCHAR) — patch (ex. "14.1.1")
- `game_creation` (BIGINT) — timestamp Riot
- `game_duration` (INTEGER) — durée en secondes
- `platform_id` (VARCHAR) — platform routing (euw1, eun1)
- `created_at` (TIMESTAMP) — date d’insertion

**participants**
- `id` (BIGSERIAL PRIMARY KEY)
- `match_id` (BIGINT REFERENCES matches(id))
- `puuid` (VARCHAR) — identifiant unique joueur Riot
- `summoner_id` (VARCHAR) — summoner ID (nullable, pour résolution)
- `champion_id` (INTEGER)
- `win` (BOOLEAN)
- `role` (VARCHAR) — TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY
- `lane` (VARCHAR) — lane assignée
- `team_position` (VARCHAR) — position dans l’équipe
- `rank_tier` (VARCHAR) — IRON, BRONZE, SILVER, GOLD, PLATINUM, EMERALD, DIAMOND, MASTER, GRANDMASTER, CHALLENGER
- `rank_division` (VARCHAR) — I, II, III, IV (nullable pour Master+)
- `rank_lp` (INTEGER) — League Points (nullable)
- `items` (JSONB) — tableau des 6 items finaux [item_id, ...]
- `runes` (JSONB) — structure complète des runes (primary, secondary, shards)
- `summoner_spells` (JSONB) — [spell1_id, spell2_id]
- `kills` (INTEGER)
- `deaths` (INTEGER)
- `assists` (INTEGER)
- `created_at` (TIMESTAMP)

**players** (table de référence pour meilleurs joueurs / OTP)
- `puuid` (VARCHAR PRIMARY KEY)
- `summoner_id` (VARCHAR) — nullable
- `summoner_name` (VARCHAR) — nullable, mis à jour périodiquement
- `region` (VARCHAR) — euw1, eun1
- `current_rank_tier` (VARCHAR) — rang actuel (mis à jour périodiquement)
- `current_rank_division` (VARCHAR) — division actuelle
- `current_rank_lp` (INTEGER)
- `total_games` (INTEGER DEFAULT 0) — nombre total de parties collectées
- `total_wins` (INTEGER DEFAULT 0)
- `last_seen` (TIMESTAMP) — dernière partie vue
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**champion_player_stats** (pour OTP et stats par joueur/champion)
- `id` (BIGSERIAL PRIMARY KEY)
- `puuid` (VARCHAR REFERENCES players(puuid))
- `champion_id` (INTEGER)
- `games` (INTEGER DEFAULT 0)
- `wins` (INTEGER DEFAULT 0)
- `winrate` (DECIMAL(5,2)) — calculé : wins/games * 100
- `avg_kills` (DECIMAL(5,2))
- `avg_deaths` (DECIMAL(5,2))
- `avg_assists` (DECIMAL(5,2))
- `last_played` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- UNIQUE(puuid, champion_id)

**champions_stats_aggregate** (agrégats pré-calculés, optionnel pour cache)
- `id` (BIGSERIAL PRIMARY KEY)
- `champion_id` (INTEGER)
- `rank_tier` (VARCHAR) — nullable (NULL = tous rangs)
- `role` (VARCHAR) — nullable (NULL = tous rôles)
- `patch` (VARCHAR) — nullable (NULL = tous patchs)
- `games` (INTEGER)
- `wins` (INTEGER)
- `winrate` (DECIMAL(5,2))
- `pickrate` (DECIMAL(5,2))
- `generated_at` (TIMESTAMP)
- UNIQUE(champion_id, rank_tier, role, patch)

**items_stats_aggregate** (agrégats builds/objets)
- `id` (BIGSERIAL PRIMARY KEY)
- `champion_id` (INTEGER)
- `items` (JSONB) — tableau des 6 items [item_id, ...]
- `rank_tier` (VARCHAR) — nullable
- `patch` (VARCHAR) — nullable
- `games` (INTEGER)
- `wins` (INTEGER)
- `winrate` (DECIMAL(5,2))
- `pickrate` (DECIMAL(5,2))
- `generated_at` (TIMESTAMP)

**runes_stats_aggregate** (agrégats runes)
- `id` (BIGSERIAL PRIMARY KEY)
- `champion_id` (INTEGER)
- `runes` (JSONB) — structure complète des runes
- `rank_tier` (VARCHAR) — nullable
- `patch` (VARCHAR) — nullable
- `games` (INTEGER)
- `wins` (INTEGER)
- `winrate` (DECIMAL(5,2))
- `pickrate` (DECIMAL(5,2))
- `generated_at` (TIMESTAMP)

### 8.2 Index recommandés

```sql
-- matches
CREATE INDEX idx_matches_region ON matches(region);
CREATE INDEX idx_matches_queue_id ON matches(queue_id);
CREATE INDEX idx_matches_game_creation ON matches(game_creation DESC);
CREATE INDEX idx_matches_game_version ON matches(game_version);

-- participants
CREATE INDEX idx_participants_match_id ON participants(match_id);
CREATE INDEX idx_participants_puuid ON participants(puuid);
CREATE INDEX idx_participants_champion_id ON participants(champion_id);
CREATE INDEX idx_participants_rank_tier ON participants(rank_tier);
CREATE INDEX idx_participants_role ON participants(role);
CREATE INDEX idx_participants_win ON participants(win);
CREATE INDEX idx_participants_champion_rank ON participants(champion_id, rank_tier);

-- players
CREATE INDEX idx_players_region ON players(region);
CREATE INDEX idx_players_rank_tier ON players(current_rank_tier);

-- champion_player_stats
CREATE INDEX idx_champ_player_puuid ON champion_player_stats(puuid);
CREATE INDEX idx_champ_player_champion ON champion_player_stats(champion_id);
CREATE INDEX idx_champ_player_winrate ON champion_player_stats(winrate DESC);
CREATE INDEX idx_champ_player_games ON champion_player_stats(games DESC);
```

### 8.3 Notes sur le schéma

- **JSONB** pour items, runes, summoner_spells permet des requêtes flexibles et des mises à jour partielles.
- **Tables d’agrégats** (`*_aggregate`) sont optionnelles mais recommandées pour le cache (recalcul périodique plutôt que calcul à la volée).
- **Table `players`** centralise les infos joueurs pour éviter les doublons et faciliter les requêtes "meilleurs joueurs".
- **Table `champion_player_stats`** permet de calculer facilement les OTP (joueurs avec % élevé de parties sur un champion).

### 8.4 Stratégie de rétention et archivage des données

**Principe :** Optimiser l’espace disque en ne gardant que les données nécessaires. À chaque nouveau patch, on repart de 0 pour les stats (les anciennes données ne sont plus pertinentes).

#### 8.4.1 Patch actuel (données brutes conservées)

- **Données brutes** (`matches`, `participants`) : conservées **uniquement pour le patch actuel**.
- **Période de glissement** : **1 journée** après le changement de patch pour permettre la transition et avoir un peu de données sur le nouveau patch avant de supprimer l’ancien.
- **Détection de nouveau patch** : via Data Dragon (version de jeu) ; quand un nouveau patch est détecté, marquer les matchs de l’ancien patch pour archivage.

#### 8.4.2 Anciens patchs (agrégats uniquement)

- **Suppression des données brutes** : après la période de glissement (1 jour), **supprimer** les lignes de `matches` et `participants` des anciens patchs.
- **Conservation des agrégats** : pour les anciens patchs, ne garder que les **tables d’agrégats** (`champions_stats_aggregate`, `items_stats_aggregate`, `runes_stats_aggregate`) avec le champ `patch` rempli.
- **Données moyennes** : les agrégats contiennent déjà les moyennes (winrate, pickrate, nombre de parties) — suffisant pour consultation historique / comparaison patch à patch.
- **Compression** : optionnellement, compresser les tables d’agrégats des anciens patchs (PostgreSQL TOAST compression automatique pour JSONB, ou partitionnement par patch avec compression).

#### 8.4.3 Table `patches_archive` (optionnel)

Pour traçabilité et historique :

```sql
CREATE TABLE patches_archive (
  patch VARCHAR PRIMARY KEY,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  total_matches INTEGER,
  total_participants INTEGER,
  archived_at TIMESTAMP,
  aggregates_kept BOOLEAN DEFAULT true
);
```

- Enregistrer chaque patch avec dates de début/fin, volume de données, date d’archivage.
- Indiquer si les agrégats ont été conservés.

#### 8.4.4 Processus d’archivage (cron job)

**Déclenchement** : quand un nouveau patch est détecté (via Data Dragon sync).

**Étapes** :

1. **Calculer les agrégats finaux** pour l’ancien patch (si pas déjà fait).
2. **Sauvegarder les agrégats** dans les tables `*_aggregate` avec `patch = 'ancien_patch'`.
3. **Période de glissement** : attendre 1 journée (ou configurable).
4. **Supprimer les données brutes** :
   ```sql
   DELETE FROM participants WHERE match_id IN (
     SELECT id FROM matches WHERE game_version = 'ancien_patch'
   );
   DELETE FROM matches WHERE game_version = 'ancien_patch';
   ```
5. **VACUUM / réindexation** : nettoyer l’espace libéré (PostgreSQL VACUUM).
6. **Enregistrer dans `patches_archive`** (si table créée).

#### 8.4.5 Compression (optionnel)

- **PostgreSQL TOAST** : compression automatique pour JSONB si > 2KB (par défaut).
- **Partitionnement par patch** : créer des partitions pour chaque patch, compresser les partitions des anciens patchs :
  ```sql
  ALTER TABLE champions_stats_aggregate SET (
    toast_tuple_target = 128
  );
  ```
- **Compression manuelle** : pour les très anciens patchs (> 6 mois), exporter les agrégats en JSON compressé (gzip) et les stocker hors DB (S3, fichiers) si besoin.

#### 8.4.6 Estimation d’espace

**Données brutes (patch actuel uniquement) :**
- `matches` : ~100 bytes par match × 100k matchs/jour × 14 jours = ~140 MB
- `participants` : ~200 bytes par participant × 1M participants/jour × 14 jours = ~2.8 GB
- **Total brut** : ~3 GB par patch (avec période de glissement).

**Agrégats (tous patchs) :**
- `champions_stats_aggregate` : ~50 bytes par ligne × 200 champions × 10 rangs × 5 rôles × 10 patchs = ~5 MB
- `items_stats_aggregate` : ~100 bytes × 10k builds × 10 patchs = ~10 MB
- `runes_stats_aggregate` : ~100 bytes × 5k setups × 10 patchs = ~5 MB
- **Total agrégats** : ~20 MB pour 10 patchs.

**Gain** : en gardant uniquement les agrégats pour les anciens patchs, on économise **~3 GB par patch archivé** (données brutes supprimées).

#### 8.4.7 Requêtes historiques

- **Patch actuel** : requêtes sur `matches` / `participants` (données brutes).
- **Anciens patchs** : requêtes uniquement sur les tables `*_aggregate` avec filtre `patch = 'X.Y.Z'`.
- **Comparaison patch à patch** : jointure des agrégats de différents patchs (pas de données brutes nécessaires).

---

## 9. Statistiques à produire (MVP)

Cibles “type Porofessor / League of Graphs” :

### Champion

- Winrate global (et par patch, par **rang**, par rôle).
- Pickrate (global et par **rang**).
- Banrate (si disponible via les données Riot).
- Winrate par rôle, par **rang**, par patch.
- **Tri par rang** : possibilité de filtrer/afficher les stats par tranche de rang (Iron, Bronze, Silver, Gold, Platinum, Emerald, Diamond, Master, Grandmaster, Challenger).

### Builds (objets)

- Build le plus joué (ensemble d’items finaux) par champion.
- Build au meilleur winrate (avec seuil de parties, filtrable par **rang**).
- Pickrate d’un build donné.
- Objets les plus utilisés par champion (filtrable par **rang**, rôle, patch).

### Runes

- Page la plus jouée par champion (filtrable par **rang**, patch).
- Page (ou setup) au meilleur winrate (filtrable par **rang**).
- Sorts d’invocateur les plus pris (optionnel MVP).

### Meilleurs joueurs

- **Classement général** : top joueurs par winrate (avec seuil minimal de parties, ex. 50+).
- **Classement par rang** : meilleurs joueurs dans chaque tranche de rang.
- **Classement par champion** : meilleurs joueurs sur un champion spécifique (filtrable par rang).
- Métriques affichées : winrate, nombre de parties, KDA moyen, rang actuel.

### OTP (One Trick Pony)

- **Identification des OTP** : joueurs qui jouent un champion dans ≥ 70% de leurs parties (seuil configurable).
- **Classement OTP par champion** : meilleurs OTP d'un champion donné, triés par winrate ou nombre de parties.
- **Stats OTP** : winrate, nombre de parties sur le champion, % de parties sur le champion, rang.
- **Filtrage par rang** : voir les meilleurs OTP d'un champion dans une tranche de rang spécifique.

---

## 10. Collecte et mise à jour

### Stratégie de collecte

- **Type de matchs** : Uniquement **Ranked Solo/Duo** (queueId 420). Filtrage strict lors de la récupération des match IDs et des détails.
- **Ciblage joueurs** : 
  - Priorité aux joueurs **Master / GM / Challenger** pour qualité des données.
  - Extension progressive vers Diamond, Emerald, etc. selon capacité.
- **Régions** : **EUW**, **EUNE**.
- **Déduplication** : **dédupliquer par matchId** (colonne `match_id` unique) pour ne pas retraiter un même match.
- **Rate limits** : Respect strict des quotas Riot (file d’attente, retry avec backoff exponentiel).

### Fréquence de collecte

**Décision : Collecte continue toute la journée**

**Justification :**

- **Avantages collecte continue** :
  - Données plus fraîches (stats mises à jour régulièrement).
  - Meilleure couverture (plus de matchs collectés sur 24h).
  - Répartition de la charge (évite les pics de requêtes).
  - Respect plus facile des rate limits (étalement des requêtes).

- **Inconvénients collecte nocturne** :
  - Données moins fraîches (décalage de plusieurs heures).
  - Pic de charge concentré (risque de saturation rate limits).
  - Moins de matchs collectés (fenêtre réduite).

**Implémentation :**

- **Cron job** : Exécution toutes les **2-4 heures** (à ajuster selon rate limits et volume).
- **Collecte progressive** : Par petits lots (ex. 50-100 matchs par exécution) pour éviter les timeouts et respecter les rate limits.
- **Collecte nocturne optionnelle** : Possibilité d’augmenter la fréquence la nuit (ex. toutes les heures) si les rate limits le permettent, pour maximiser le volume.

### Fréquence de recalcul des agrégats

- **Agrégats champions/builds/runes** : Toutes les **6 heures** (ou après chaque collecte si volume significatif).
- **Agrégats joueurs/OTP** : Toutes les **12 heures** (moins fréquent, calcul plus lourd).
- **Cache Redis** : TTL de 1-2 heures pour les stats les plus consultées.

---

## 11. Contraintes critiques

- **Rate limit Riot :** quotas stricts ; file d’attente + retry + backoff obligatoires.
- **Légal / CGU Riot :** respect des conditions d’utilisation ; pas d’exposition de données brutes de match à des fins non conformes.
- **Données exposées :** uniquement **agrégats** (winrate, pickrate, builds populaires, etc.), pas de logs de match bruts aux utilisateurs finaux.

---

## 12. Stratégie MVP (phases)

### Phase 1 (MVP) — Foundation & Setup

**Infrastructure :**
- **Mise en place PostgreSQL** : installation, configuration, schéma de base (matches, participants, tables d’agrégats).
- **Migration données existantes** : si des matchs sont déjà en JSON (`data/riot/matches/`), migration vers PostgreSQL.
- **ORM/Query Builder** : choix et intégration (Prisma ou TypeORM).
- **Stratégie d’archivage** : implémentation du processus d’archivage (cron job) pour supprimer les données brutes des anciens patchs après période de glissement (1 jour) et conserver uniquement les agrégats.

**Collecte :**
- **2 régions** : EUW + EUNE.
- **Ranked Solo/Duo uniquement** (queueId 420, filtrage strict).
- **Collecte continue** : cron toutes les 2-4 heures.
- **Ciblage** : Master / GM / Challenger en priorité.

**Stats de base :**
- Winrate / pickrate par champion (global et par **rang**).
- Winrate / pickrate par champion et par rôle.
- **Tri et filtrage par rang** (Iron → Challenger).

**API :**
- Endpoints de base : `/api/stats/champions`, `/api/stats/champions/:id` (avec filtres rang/rôle).

**Frontend :**
- Page stats champions avec tableau (winrate, pickrate, filtres par rang/rôle).

### Phase 2 — Builds, Runes & Meilleurs Joueurs

- **Builds** : builds les plus joués, meilleur winrate (filtrables par rang).
- **Runes** : pages les plus jouées, meilleur winrate (filtrables par rang).
- **Meilleurs joueurs** : classement général et par champion (avec filtres rang).
- **Filtres avancés** : patch, rang, rôle combinables.

### Phase 3 — OTP & Analytics Avancés

- **OTP** : identification et classement des meilleurs OTP par champion (filtrable par rang).
- **Stats détaillées joueurs** : profil joueur avec historique, champions les plus joués.
- **Matchups** : winrate champion A vs champion B (optionnel).
- **Synergies** : combinaisons de champions performantes (optionnel).
- **Comparaison patch à patch** : évolution des stats entre patchs.

---

## 13. Tests et validation

- Comparer les résultats (winrate, pickrate, builds populaires) avec **U.GG / OP.GG / Porofessor / League of Graphs** sur les mêmes patchs/regions.
- Vérifier la **cohérence statistique** (totaux, déduplication).
- Tester d’abord sur un **faible volume**, puis augmenter progressivement.

---

## 14. Indicateurs de succès

- Nombre de **matchs collectés par jour** (Europe).
- **Délai de mise à jour** des stats (objectif cible à définir, ex. < 24h).
- **Écart statistique** < 1–2 % avec des références (U.GG, etc.) sur les mêmes périmètres.
- **Temps de réponse API** stats < 200 ms (avec cache).

---

## 15. Mise en place PostgreSQL (Phase 1 — Prioritaire)

### 15.1 Installation et configuration

**Prérequis :**
- PostgreSQL 14+ installé sur le serveur (ou service cloud : AWS RDS, DigitalOcean Managed DB, etc.).
- Variables d’environnement dans `backend/.env` :
  ```
  DATABASE_URL=postgresql://user:password@localhost:5432/lelanation_stats
  # ou pour production :
  # DATABASE_URL=postgresql://user:password@host:5432/lelanation_stats?sslmode=require
  ```

**Migrations :**
- Utiliser Prisma Migrate ou TypeORM Migrations pour créer le schéma.
- Scripts de migration dans `backend/prisma/migrations/` (si Prisma) ou `backend/src/migrations/` (si TypeORM).

### 15.2 Schéma initial (Phase 1 MVP)

Tables minimales pour MVP :
- `matches` (id, match_id, region, queue_id, game_version, game_creation, game_duration, created_at)
- `participants` (id, match_id, puuid, champion_id, win, role, rank_tier, items, runes, summoner_spells, created_at)

Tables optionnelles pour Phase 1 (peuvent être ajoutées en Phase 2) :
- `players` (pour meilleurs joueurs)
- `champion_player_stats` (pour OTP)
- `*_aggregate` (agrégats pré-calculés, optionnel)

### 15.3 Scripts de migration

- **Migration depuis JSON** : Si des matchs existent déjà en JSON (`data/riot/matches/`), créer un script de migration vers PostgreSQL.
- **Backup** : Mettre en place des backups automatiques (pg_dump quotidien).

### 15.4 Processus d’archivage (cron job)

**Objectif :** Optimiser l’espace disque en ne gardant que les agrégats pour les anciens patchs (voir section 8.4).

**Implémentation :**
- **Cron job** : Exécution automatique quand un nouveau patch est détecté (via Data Dragon sync).
- **Étapes** :
  1. Calculer les agrégats finaux pour l’ancien patch (si pas déjà fait).
  2. Sauvegarder les agrégats dans les tables `*_aggregate` avec `patch = 'ancien_patch'`.
  3. Attendre la période de glissement (1 jour configurable).
  4. Supprimer les données brutes (`matches` et `participants` de l’ancien patch).
  5. VACUUM pour libérer l’espace.
  6. Enregistrer dans `patches_archive` (si table créée).
- **Script** : `backend/src/cron/patchArchive.ts` (ou équivalent selon structure).

### 15.5 Monitoring

- Surveiller la taille de la DB (croissance prévisible : ~3-5 Go avec données brutes du patch actuel + agrégats de tous patchs).
- Surveiller les performances des requêtes (EXPLAIN ANALYZE sur les requêtes lentes).
- Alertes si la DB approche de sa capacité.
- **Monitoring archivage** : vérifier que le processus d’archivage s’exécute correctement à chaque nouveau patch (logs, taille DB avant/après archivage).

---

## 16. Résumé exécutif

Cette EPIC décrit l’ajout d’une **plateforme de statistiques LoL** dans Lelanation v2 :

- **Source :** API officielle Riot uniquement, avec **`RIOT_API_KEY`** dans **`backend/.env`**.
- **Type de matchs :** **Ranked Solo/Duo uniquement** (queueId 420, pas de Flex).
- **Périmètre géographique :** Europe (EUW, EUNE).
- **Stockage :** **PostgreSQL** (décision justifiée section 6.2) — uniquement pour les stats, indépendant du reste du système (builds/game data restent en JSON).
- **Collecte :** Continue toute la journée (cron toutes les 2-4 heures).
- **Archivage :** Données brutes conservées uniquement pour le patch actuel (+ 1 jour de glissement) ; anciens patchs : agrégats uniquement (winrate, pickrate, builds populaires) pour économiser ~3 GB par patch archivé.
- **Fonctionnalités clés :**
  - Stats champions/builds/runes avec **tri et filtrage par rang**.
  - **Meilleurs joueurs** : classement général et par champion.
  - **OTP** : identification et classement des meilleurs OTP par champion.
- **Livrables :** collecte massive de matchs, stockage PostgreSQL, calcul d’agrégations, API + frontend type **Porofessor / League of Graphs**.

La valeur est dans le **pipeline de collecte**, le **volume de données**, les **agrégations** et les **fonctionnalités de classement/OTP**, pas dans l’API Riot seule.

---

*Document prêt pour découpage en user stories et spécification technique détaillée (schéma SQL complet, pseudo-code worker, contrats API, scripts de migration PostgreSQL).*
