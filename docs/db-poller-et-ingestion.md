# Base de données, poller et ingestion — vue d'ensemble

Document de référence sur l'architecture des statistiques LoL dans Lelanation v2 : schéma PostgreSQL, pipeline **poller-v2**, problèmes opérationnels actuels, et consommation des données par l'API / le frontend.

> **Compléments** : [Accès à la base de données](./database-access.md) · [Collecte Riot API](./riot-api-match-collection.md) · [Calculs des statistiques](./stats-calculations.md)

---

## 1. Vue d'ensemble

Lelanation sépare deux mondes de données :

| Domaine | Stockage | Exemples |
|---------|----------|----------|
| **Game data & builds** | Fichiers JSON + cache Redis | champions, items, runes, builds communautaires, YouTube |
| **Statistiques LoL (matchs)** | PostgreSQL `lelanation_statistiques` | winrate, tier list, matchups, builds stats, objectifs |

L'ancienne base **`lelanation_stats`** (Prisma, tables normalisées `matches` / `participants`) a été retirée du stack. Le poller-v2 alimente directement des **agrégats pré-calculés** — il ne persiste pas les matchs bruts.

```
Riot API ──► poller-v2 (BullMQ + Redis) ──► PostgreSQL (agrégats)
                                                    │
                                                    ▼
                                          API /api/stats/* ──► frontend /statistics/*
```

---

## 2. Base de données PostgreSQL

### 2.1 Connexion et migrations

| Paramètre | Valeur |
|-----------|--------|
| Base | `lelanation_statistiques` |
| User / password | `lelanation` / `lelanation` |
| Port Docker | `5434` |
| Variable | `DATABASE_URL=postgresql://lelanation:lelanation@localhost:5434/lelanation_statistiques` |

**Démarrage :**

```bash
docker compose up -d
make migrate-db   # backend/drizzle/migrations (0000 → 0013)
```

**Fichiers clés :**

| Rôle | Chemin |
|------|--------|
| Client SQL (poller) | `backend/src/db/client.ts` |
| Helpers requêtes API | `backend/src/db/query.ts` |
| Pool Drizzle (API) | `backend/src/drizzle/statistiquesDb.ts` |
| Schéma Drizzle (partiel) | `backend/src/drizzle/statistiquesSchema.ts` |
| Migrations SQL | `backend/drizzle/migrations/` |
| Mapping noms logiques → physiques | `backend/src/stats/statsTableMap.ts` |

Le schéma TypeScript Drizzle ne couvre qu'une table (`botlane_duo_vs_duo_stats`). Le reste est défini en SQL migration et interrogé via **SQL brut** (`postgres.js`).

### 2.2 Philosophie : agrégats-first

Chaque match Riot est parsé **en mémoire**, puis ses métriques sont **incrémentées** dans ~15 tables d'agrégats via `INSERT … ON CONFLICT DO UPDATE`. Seule une **sentinelle anti-doublon** est conservée.

**Conséquences :**

- Pas de re-parsing historique sans re-fetch Riot
- Idempotence garantie par `processed_matches` + upserts atomiques
- Requêtes API rapides (pas de JOIN sur des millions de lignes de matchs)

### 2.3 Tables métier (non partitionnées)

#### `players` — file de crawl

Point d'entrée du graphe de découverte. Le poller parcourt les joueurs par `last_seen ASC NULLS FIRST`.

| Colonne | Rôle |
|---------|------|
| `puuid` (PK) | Identifiant universel Riot |
| `region` | Plateforme (`euw1`, `eun1`, …) |
| `puuid_key_version` | Version de clé API (`dev` / `prod`) |
| `last_seen` | Dernière activité (tri discovery) |

Alimentée par l'ingestion (participants découverts) et par le script admin **`league-xp`** (seed League v4).

#### `player_rank_history` — historique de rang

Snapshot journalier du rang Solo/Duo par joueur.

| Colonne | Rôle |
|---------|------|
| PK `(puuid, date, region)` | Un snapshot par jour |
| `rank_tier`, `rank_division`, `rank_lp` | Rang League v4 |

Alimentée par le worker **rank** et par l'ingestion. Utilisée par le **rank gate** (voir § 4.3) pour savoir si un joueur est classé ou confirmé UNRANKED.

#### `processed_matches` — anti-doublon

| Colonne | Rôle |
|---------|------|
| `riot_match_id` (PK, partition LIST par `patch`) | ID match Riot |
| `patch`, `game_date` | Métadonnées |
| `status` | `DONE` après agrégation |
| `rank` | Libellé tier moyen du match (ex. `GOLD`) |

Insertion `ON CONFLICT DO NOTHING` **avant** toute agrégation. Un conflit → `AlreadyProcessedMatchError` (compté comme duplicate).

> **Note legacy** : les colonnes `aggregate_status` / `aggregated_at` ont été supprimées (migration 0006). Certains scripts admin (`AdminDataCollectService`) référencent encore ces colonnes — voir § 5.6.

### 2.4 Tables d'agrégats (partition LIST par `patch`)

Migration 0001 : toutes les tables stats sont partitionnées par `patch` pour faciliter la rétention et les requêtes filtrées.

**Dimensions communes** (clé composite) :

```
(patch, role, rank_tier, region, champion_id, …)
```

| Table | Contenu |
|-------|---------|
| `champion_stats` | Stats globales champion (KDA, dégâts, objectifs, challenges, …) |
| `champion_vs_stats` | Matchups (vs opponent) |
| `champion_duo_role_stats` | Synergies alliées par rôle |
| `champion_spell_stats` | Ordres de sorts (`spell_order_hash` = md5, migration 0003) |
| `champion_item_set_stats` / `champion_item_solo_stats` | Builds items (starter / core / final) |
| `champion_runes_stats` / `champion_runes_solo_stats` / `champion_shard_solo_stats` | Runes |
| `champion_summoner_spell_pair_stats` / `champion_summoner_spells` | Sorts d'invocateur |
| `champion_bans_by_banner` | Bans par rôle / équipe / outcome (0010–0011) |
| `champion_pick_order` | Ordre de pick en draft |
| `champion_bucket` | Stats par tranche de durée |
| `champion_tier_daily_snapshots` | Snapshots tier list journaliers |
| `botlane_duo_vs_duo_stats` | Botlane duo vs duo |
| `match_outcome_stats` | Compteur de matchs par patch / tier |
| `objective_outcome_histogram` | Histogramme objectifs (drakes typés via `type_drake` + `is_soul`, 0013) |
| `team_core_stat` | Wins / surrenders par équipe (fix per-side, 0012) |

**Pattern d'écriture :** colonnes `count_game`, `count_win`, `sum_*` incrémentées à chaque match ingéré. Les métriques challenges/lane sont en `double precision` depuis la migration 0008.

### 2.5 Relations logiques

```
players
  ↑ upsert depuis ingestion (participants découverts)
  ↓ discovery lit last_seen → Match-v5 IDs

player_rank_history
  ↑ rank worker + ingestion
  ↓ hydration : snapshot du jour pour le rank gate

processed_matches
  ↑ sentinelle avant agrégation
  ↓ empêche re-traitement

champion_* / team_* / objective_*
  ↑ upserts incrémentaux ON CONFLICT DO UPDATE
  ↓ API /api/stats/*
```

---

## 3. Poller-v2

### 3.1 Déploiement

| Élément | Détail |
|---------|--------|
| Processus PM2 | `lelanation-poller-v2` (`tsx src/main.ts`) |
| API Express | `lelanation-backend` — **n'exécute pas** l'ingestion matchs |
| Instance unique | Verrou Redis `poller-v2:leader` (TTL 120 s, renouvelé / 30 s) |
| Prérequis | PostgreSQL, Redis, `RIOT_API_KEY`, `DATABASE_URL` |

Point d'entrée : `backend/src/main.ts`

### 3.2 Architecture : 4 pipelines BullMQ

```
┌─────────────┐   match IDs    ┌─────────────┐  parsed DTOs  ┌─────────────┐
│  DISCOVERY  │ ─────────────► │  HYDRATION  │ ─────────────►│  INGESTION  │
│  (repeat)   │                │ match+timeline              │  (SQL agg)  │
└─────────────┘                └──────┬──────┘                └─────────────┘
       │                              │                              │
       │ players.last_seen            │ rank gate                      │ players upsert
       ▼                              ▼                              ▼
   PostgreSQL                    ┌─────────┐                    PostgreSQL
                                 │  RANK   │◄── League v4 by-puuid
                                 └─────────┘
```

#### Discovery (`discovery.worker.ts`)

- Job répété toutes les `DISCOVERY_INTERVAL_MS` (défaut **45 s**)
- Sélectionne `DISCOVERY_PLAYERS_PER_TICK` joueurs (défaut **6**) via `FOR UPDATE SKIP LOCKED`
- Appelle `RiotClient.getMatchlist(puuid, region, { startTime })`
- Fenêtre temporelle : patch courant + grâce de 2 jours (`PATCH_SWITCH_GRACE_DAYS`)
- Filtre les matchs déjà dans `processed_matches` et déjà en file Redis (`rl:queued:{matchId}`)
- Enfile des jobs **hydration**
- **Prefetch rank** : enfile des jobs rank pour joueurs sans snapshot League du jour, avec délai hydration associé

**Pauses discovery si :**

- Backlog rank > `MAX_RANK_BACKLOG_PAUSE_PIPELINES` (défaut **8000**)
- File hydration > `MAX_HYDRATION_QUEUE_DEPTH` (défaut **1500**)

#### Hydration (`hydration.worker.ts`)

- Concurrence : **8** (dev) / **80** (prod)
- Coût rate limit : **2 slots** (match + timeline en parallèle)
- Parse via `parseMatch()` → `ParsedParticipantDto[]`
- **Rank gate** : voir § 4.3
- Match trop ancien (avant cutoff patch) → skip sans erreur
- Cache inter-jobs : `cachedHydration` dans les données BullMQ

#### Rank (`rank.worker.ts`)

- Appelle `RiotClient.getRank(puuid, region)` — League v4 `entries/by-puuid`
- Upsert `player_rank_history` pour aujourd'hui (`ON CONFLICT DO NOTHING`)
- Concurrence : **2** (normal) / **6** (drain)
- Rate limit via drip Redis (`waitForRankSlot()`) — plus de limiter BullMQ séparé

#### Ingestion (`ingestion.worker.ts`)

Transaction SQL unique par match :

1. Sentinelle `processed_matches`
2. Upsert `players` + `player_rank_history`
3. ~15 upserts agrégats (champion, items, runes, bans, botlane, objectifs, …)
4. Post-ingestion : enqueue rank pour participants `needsRankFetch`

Si rangs pas prêts → upsert joueurs seulement, **pas d'agrégation**.

### 3.3 Rate limiting (Redis + Lua)

Fichier : `backend/src/redis/rate-scheduler.ts`

Trois **drips** indépendants sur fenêtre 120 s :

| Pipeline | Budget dev (ref 95 req/120s) | Coût par job |
|----------|------------------------------|--------------|
| Discovery | 6 | 1 |
| Hydration | 74 | 2 (match + timeline) |
| Rank | 18 | 1 |

- Budgets scalés selon `RATE_LIMIT_PER_120S` (dev: 95, prod: 28500)
- Cooldown global sur 429 (`rl:app:global-cooldown`) — bloque les 3 pipelines
- Mode drain (`RANK_DRAIN_MODE=1`) : 93 % budget rank, discovery/hydration réduits

### 3.4 Observabilité

| Élément | Chemin / endpoint |
|---------|-------------------|
| Snapshot JSON | `logs/poller-v2-observability.json` |
| Métriques | Toutes les 30 s (depth files, data lag, pipelines paused) |
| Résumés | 30 min / 1 h dans le log unifié |
| Admin API | `GET /api/admin/poller-v2/observability` |
| Dashboard | `GET /api/admin/riot-poller/metrics` |

### 3.5 Scripts de maintenance

| Script | Rôle |
|--------|------|
| `backend/scripts/reset-poller-queues.ts` | Reset files BullMQ |
| `backend/src/services/patch-retention-cleanup.ts` | Purge rétention patch |
| `backend/scripts/verify-ingestion-idempotence.ts` | Vérif idempotence |
| `backend/scripts/inspect-failed-jobs.ts` | Inspect jobs failed |

### 3.6 Seeds joueurs (hors poller)

Via orchestrateur admin (`scriptOrchestrator.ts`) :

- **`league-xp`** (`backend/src/worker/leagueXpScript.ts`) — League v4 entries par tier/division → insert `players`
- **`puuid-migration`** — rotation clé API / resync PUUIDs

---

## 4. Flux d'ingestion (source → base)

### 4.1 Pipeline complet

```
Riot API
  Match-v5  (matchlist + match + timeline)
  League-v4 (entries/by-puuid)
        │
        ▼
[Discovery] ──► Redis BullMQ (hydration queue)
        │
        ▼
[Hydration] parseMatch() + rank gate
        │
        ├──► [Rank queue] ──► player_rank_history
        │
        ▼
[Ingestion] transaction SQL
        │
        ├──► processed_matches (sentinelle)
        ├──► players (graphe de crawl)
        ├──► player_rank_history
        └──► ~15 tables champion_* / team_* / objective_*
                │
                ▼
        API /api/stats/*  ──►  frontend /statistics/*
```

### 4.2 Ce qui est parsé (en mémoire)

Le parseur `backend/src/parsers/match.parser.ts` transforme le JSON Riot en `ParsedParticipantDto[]` :

- Identité : `puuid`, `championId`, `role`, `teamId`, `win`
- Rang : `rankTier`, `rankTierValue`, `needsRankFetch`
- Builds : items starter/core/final, runes, shards, summoner spells
- Métriques : KDA, gold, vision, dégâts, challenges (lane economy, u15, …)
- Draft : bans, pick order
- Objectifs d'équipe : drakes, baron, herald, tours, …

**Rien de tout cela n'est stocké tel quel** — seuls les compteurs agrégés le sont.

### 4.3 Rank gate — goulot d'étranglement central

Fichier : `backend/src/workers/match-rank-readiness.ts`

Un match n'est agrégé que si :

1. **Chaque** participant a un rang connu (tier classé sur le match **ou** snapshot League du jour, y compris UNRANKED confirmé)
2. **Au moins un** participant est classé → tier moyen du match calculable

```typescript
// Conditions simplifiées
participants.every(p => participantRankKnown(p, todaySnapshotPuuids))
&& averageMatchRankTierLabel(participants) != null
```

**Conséquences :**

- Les matchs **100 % unranked** ne sont jamais agrégés (volontaire)
- Chaque nouveau joueur déclenche un appel League v4 → jobs rank → attente hydration
- Le prefetch rank au discovery et les retries hydration (45 s / 3 min backlog) tentent de réduire la latence

### 4.4 Politique de pause (backlog rank)

Fichier : `backend/src/queues/rank-backlog-policy.ts`

Quand `rank.waiting > MAX_RANK_BACKLOG_PAUSE_PIPELINES` (8000) :

- Discovery, hydration et ingestion sont **pausés**
- Concurrence rank passe en mode **drain** (6 workers)
- Hydration diffère ses jobs (`moveToDelayed`, 3 min)

Objectif : vider la file rank avant d'enfiler plus de matchs qui échoueraient au rank gate.

### 4.5 Idempotence

- `processed_matches` : conflit → match déjà traité
- Upserts agrégats : `ON CONFLICT DO UPDATE` avec incréments
- Jobs BullMQ : déduplication Redis (`rl:queued:{matchId}`, job IDs stables)

---

## 5. Ennuis actuels

### 5.1 Rank gate vs budget API — tension structurelle

Le rank gate exige un snapshot League v4 **par participant inconnu** avant agrégation. Or :

- Chaque match = 10 participants potentiellement sans snapshot
- Le budget rank (18 req/120s en dev) est bien inférieur au débit hydration (74 slots / 2 = ~37 matchs/120s théoriques)
- Résultat : **backlog rank chronique**, hydration en attente, ingestion ralentie

Des améliorations récentes (mai 2026) ont visé ce problème :

| Phase | Changement |
|-------|------------|
| Rate limiter unifié | Rank intégré au drip Redis (plus de double limiter BullMQ + Redis) |
| Prefetch rank | Jobs rank enfilés au cycle discovery, délai hydration calculé |
| Seuils assouplis | `MAX_RANK_BACKLOG_PAUSE_PIPELINES` 5000 → **8000**, `MAX_HYDRATION_QUEUE_DEPTH` 500 → **1500** |
| Retries hydration | 120 s → **45 s** ; backlog 10 min → **3 min** |
| Concurrence drain | Rank drain 4 → **6** workers |
| Drip uniforme | 1 token/tick, intervalles calibrés (discovery /20s, rank /6.7s, hydration /3.2s par job) |

Le problème reste **partiellement ouvert** : le ratio rank/hydration est intrinsèquement défavorable tant que le rank gate reste strict.

### 5.2 Pause globale des pipelines

Au-delà de 8000 jobs rank en attente, **tout s'arrête** (discovery, hydration, ingestion). Risques :

- Stagnation si le drain rank est ralenti par des 429 League v4
- Data lag croissant sur le patch courant
- Effet yo-yo : pause → drain → reprise → nouveau backlog

Alerte observability : `rank_queue_backlog_high`.

### 5.3 Rate limiting et 429

Trois alertes dans `poller-v2-observability.ts` :

| Alerte | Condition | Signification |
|--------|-----------|---------------|
| `token_rate_unstable` | écart-type > 15 sur 10 min | Drip irrégulier |
| `token_rate_too_low` | min < 70 req/120s | Sous-consommation du budget |
| `token_rate_over_budget` | max > 99 req/120s | Risque de 429 imminents |

Le cooldown 429 global (`rl:app:global-cooldown`) freeze les 3 pipelines — cascade sur toutes les files.

### 5.4 Bug de concurrence rank

Alerte `rank_worker_concurrency_bug` si `rank.active > rankWorkerConcurrencyDrain()` (6). Indique un dépassement de concurrence rank non prévu — à investiguer si récurrent en prod.

### 5.5 Limitation fondamentale Riot

> Il n'existe **aucun endpoint** pour lister tous les matchs d'une région ou d'un patch.

L'API est volontairement non exhaustive. Le crawl est **PUUID-centric** (queue 420 Ranked Solo/Duo, régions EUW/EUN principalement). La couverture statistique dépend entièrement de la profondeur du graphe `players`.

### 5.6 Pas de stockage match brut

Impossible de :

- Re-parser un match après correction du parseur
- Auditer un match individuel en base
- Recalculer des agrégats sans re-fetch Riot

Seule la sentinelle `processed_matches` + les compteurs agrégés subsistent.

### 5.7 Code et docs legacy

| Problème | Détail |
|----------|--------|
| `AdminDataCollectService.ts` | Requêtes sur `aggregate_status` supprimé (migration 0006) — métriques admin « pending aggregate » cassées |
| `docs/data-models.md`, `docs/architecture-backend.md` | Indiquent encore « No Database » |
| `docs/riot-api-match-collection.md` | Décrit l'ancien poller v1 (cron in-process, Prisma) |
| `docs/riot-api-to-db.md` | Modèle normalisé obsolète |
| `StatsOverviewService.ts` | Fallbacks sur concepts legacy (`match_ingest_raw`) |

### 5.8 Matchs exclus volontairement

- Matchs **full unranked** (aucun participant classé)
- Matchs **avant cutoff patch** (patch trop ancien)
- Matchs **404** Riot (supprimés côté Riot)
- Doublons (`AlreadyProcessedMatchError`)

---

## 6. Consommation des données (après ingestion)

### 6.1 API statistiques

Route principale : `backend/src/routes/stats.ts`

**Principe :** l'API ne retourne que des **agrégats pré-calculés** — jamais de JSON match brut.

Services consommateurs (lecture SQL sur tables `champion_*`, etc.) :

| Service | Usage |
|---------|-------|
| `StatsOverviewService` | Overview, progression, durée, objectifs, sides |
| `TierListService` / `MatchupTierService` | Tier list par lane |
| `StatsBuildsService` | Builds items stats |
| `StatsRunesService` | Runes stats |
| `StatsMatchupsService` | Matchups |
| `ChampionGlobalTableService` | Table globale champions |
| `StatsBotlaneVsBotlaneService` | Botlane duo vs duo |
| `ChampionTierDailySnapshotService` | Snapshots tier journaliers |
| `StatsAbandonsService` | Abandons / surrenders |
| `StatsPlayersService` | Top joueurs |

Le mapping `statsTableMap.ts` traduit les noms logiques legacy (`agg_champion_core_stats`) vers les tables physiques (`champion_stats`).

### 6.2 Frontend

Pages `/statistics/*` consomment `/api/stats/*` avec filtres :

- `patch`, `region`, `rank_tier`, `role`, `championId`

Formules documentées dans [Calculs des statistiques](./stats-calculations.md) (winrate, pickrate, banrate, tier score, …).

### 6.3 Autres pipelines de sync (hors poller matchs)

Cron dans l'API Express (`src/index.ts`) — **séparés** du poller-v2 :

| Cron | Source → Destination |
|------|---------------------|
| Data Dragon | Riot DDragon → fichiers JSON frontend |
| YouTube | YouTube API → JSON statique |
| Community Dragon | CDragon → assets |
| Archive agrégats live | Archivage versions stats |

---

## 7. Configuration opérationnelle

### 7.1 Variables obligatoires

```env
DATABASE_URL=postgresql://lelanation:lelanation@localhost:5434/lelanation_statistiques
REDIS_URL=redis://localhost:6379
RIOT_API_KEY=RGAPI-...
ENV=dev   # ou prod
```

### 7.2 Variables poller (principales)

| Variable | Défaut | Rôle |
|----------|--------|------|
| `DISCOVERY_PLAYERS_PER_TICK` | 6 | Joueurs par cycle discovery |
| `DISCOVERY_INTERVAL_MS` | 45000 | Intervalle job discovery |
| `MAX_HYDRATION_QUEUE_DEPTH` | 1500 | Pause discovery si dépassé |
| `MAX_RANK_BACKLOG_PAUSE_PIPELINES` | 8000 | Pause globale si backlog rank |
| `HYDRATION_CONCURRENCY` | 8 (dev) / 80 (prod) | Workers hydration |
| `RANK_WORKER_CONCURRENCY_DRAIN` | 6 | Concurrence rank en drain |
| `RANK_WORKER_CONCURRENCY_NORMAL` | 2 | Concurrence rank normal |
| `RANK_DRAIN_MODE` | — | Mode drain (PM2 : `1`) |
| `RIOT_RATE_LIMIT_PER_120S` | 95 (dev) / 28500 (prod) | Override budget 120s |
| `POLLER_PATCH_ROLLOUT_GRACE_DAYS` | 2 | Grâce changement patch |
| `POLLER_PATCH_RETENTION_DAYS` | *(absent / false)* | Purge `processed_matches` / `player_rank_history` : `false` = off, `true` = 5 j, entier = jours |
| `POLLER_EXTERNAL` | — | Poller externe à l'API |
| `PLAYER_KEY_VERSION` | = `ENV` | Version clé PUUID |

### 7.3 Checklist démarrage

1. `docker compose up -d` → PostgreSQL port 5434
2. `make migrate-db` → migrations Drizzle
3. PM2 : `lelanation-backend` + `lelanation-poller-v2`
4. Redis actif (BullMQ + rate limiter)
5. Seed joueurs : admin script `league-xp` ou insert manuel dans `players`
6. Vérifier observability : `logs/poller-v2-observability.json` ou endpoint admin

---

## 8. Migrations récentes (historique)

| Migration | Changement |
|-----------|------------|
| 0001 | Partition LIST(`patch`) sur agrégats |
| 0005 | `player_rank_history` ; allègement `players` |
| 0006–0007 | Colonne `rank TEXT` sur `processed_matches` ; suppression colonnes agrégat async |
| 0008 | Métriques challenges en `double precision` |
| 0010–0011 | Bans par outcome |
| 0012 | Surrender par équipe corrigé |
| 0013 | Objectifs drake : `type_drake`, `is_soul` |

---

## 9. Références rapides

| Sujet | Document / fichier |
|-------|-------------------|
| Connexion DB | [database-access.md](./database-access.md) |
| Limites Riot API | [riot-api-match-collection.md](./riot-api-match-collection.md) |
| Formules stats | [stats-calculations.md](./stats-calculations.md) |
| Config PM2 | `ecosystem.config.js` |
| Config poller | `backend/src/config/index.ts` |
| Dashboard admin | `backend/src/services/PollerV2DashboardService.ts` |
