# Collecte de matchs Riot API – Workflow et limites

Ce document décrit comment fonctionne l’API Riot Games (League of Legends), ses limites, et la stratégie de collecte de matchs utilisée par Lelanation.

---

## Règle fondamentale

> **Il n’existe aucun endpoint** permettant de :
> - récupérer tous les matchs d’une région
> - récupérer tous les joueurs d’une région
> - récupérer tous les matchs d’un patch
>
> L’API est **volontairement non exhaustive**. Même avec une clé production, un dump complet est impossible.

---

## APIs utilisées

### 1. League-v4 (seed)

- `GET /lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5`
- `GET /lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5`
- `GET /lol/league/v4/masterleagues/by-queue/RANKED_SOLO_5x5`

**Utilité :** obtenir des **joueurs seed fiables** (Challenger / Grandmaster / Master). Point de départ légal pour la collecte.

### 2. Summoner-v4 (seed → PUUID)

- `GET /lol/summoner/v4/summoners/{summonerId}`

**Utilité :** convertir un **summonerId** (retourné par League-v4) en **PUUID**. Le PUUID est l’identifiant universel requis par Match-v5.

### 3. Match-v5 (PUUID-centric)

- `GET /lol/match/v5/matches/by-puuid/{puuid}/ids` (max 100 IDs par appel, pagination)
- `GET /lol/match/v5/matches/{matchId}`

**Utilité :** lister les matchs d’un joueur, puis récupérer les données complètes d’un match. **Tous les endpoints Match-v5 sont centrés sur le PUUID.**

### 4. Account-v1 (optionnel)

- `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}`

**Utilité :** convertir un **Riot ID** (gameName#tagLine) en PUUID. Non utilisé dans notre pipeline car le seed vient de League-v4 (summonerId).

---

## Récupérer le rang d’un joueur (tier, division, LP)

Le **rang classé** est lié au **`summonerId`**, pas au PUUID. League-v4 n’accepte que le `summonerId`.

### Pipeline obligatoire

```
Riot ID (gameName#tagLine) → PUUID → summonerId → rang
```

| Étape | API | Route | Région / base |
|-------|-----|--------|----------------|
| 1. Riot ID → PUUID | Account-V1 | `GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}` | **Continentale** : `europe`, `americas`, `asia` |
| 2. PUUID → summonerId | Summoner-V4 | `GET /lol/summoner/v4/summoners/by-puuid/{puuid}` | **Régionale** : `euw1`, `eun1`, `na1`, etc. |
| 3. summonerId → rang | League-V4 | `GET /lol/league/v4/entries/by-summoner/{summonerId}` | **Régionale** : `euw1`, `eun1`, etc. |
| 3 bis. **PUUID → rang** | League-V4 | `GET /lol/league/v4/entries/by-puuid/{puuid}` | **Régionale** : `euw1`, `eun1`, etc. |

Sur le [Riot Developer Portal](https://developer.riotgames.com/apis#league-v4), le Swagger propose **by-puuid** : `GET /lol/league/v4/entries/by-puuid/{puuid}`. C’est l’endpoint utilisé dans le projet pour l’enrichissement du rang (on a toujours le PUUID du joueur, pas besoin d’appeler Summoner-V4 pour obtenir le `summonerId`).  
L’endpoint **by-summoner** (`GET_getLeagueEntriesBySummoner`) peut renvoyer 403 selon la clé ; **by-puuid** fonctionne avec la même clé dans beaucoup de cas.  
**GET_getLeagueEntries** (sans « BySummoner ») est un **autre** endpoint : entries par **tier/division** (ex. PLATINUM II), pas par joueur.

- **Account-V1** utilise une **route continentale** (routing value `europe`, `americas`, `asia`).
- **Summoner-V4** et **League-V4** utilisent une **route régionale** (platform : `euw1`, `na1`, etc.).

### Réponse League-V4 (exemple)

Tableau d’entrées (Solo/Duo, Flex, etc.) :

```json
[
  {
    "queueType": "RANKED_SOLO_5x5",
    "tier": "PLATINUM",
    "rank": "II",
    "leaguePoints": 63,
    "wins": 124,
    "losses": 110
  }
]
```

- **Joueur non classé** : tableau vide `[]`.
- **Plusieurs rangs** : une entrée par queue (Solo/Duo, Flex). Filtrer sur `queueType === "RANKED_SOLO_5x5"` pour le rang Solo.

### Erreurs à éviter

| À ne pas faire | Raison |
|----------------|--------|
| Chercher le rang via Match-V5 | Les participants de match ne contiennent pas le rang. |
| Utiliser le PUUID avec **by-summoner** | L’endpoint **by-summoner** attend le **summonerId**. Utiliser **by-puuid** si tu as le PUUID. |
| Utiliser une route continentale pour League-V4 | League-V4 est une API **régionale** (platform : euw1, eun1, etc.). |

### Implémentation dans le projet

- **RiotApiService** : `getLeagueEntriesByPuuid(platform, puuid)` appelle `GET /lol/league/v4/entries/by-puuid/{puuid}` (comme sur le Swagger Riot) et retourne `tier`, `rank`, `leaguePoints` pour Solo/Duo. `getLeagueEntriesBySummonerId(platform, summonerId)` reste disponible (by-summoner).
- **StatsPlayersRefreshService.enrichPlayers()** : pour les joueurs avec `currentRankTier` vide, appelle **League-V4 by-puuid** (avec le PUUID du joueur) et met à jour `Player.currentRankTier`, `currentRankDivision`, `currentRankLp`. Plus besoin de `summonerId` pour le rang.

### Vérifier les joueurs au rang vide

- **Admin** : `GET /api/admin/players-missing-summoner-name` renvoie la liste des joueurs avec `summoner_name` vide, pour relancer l’enrichment ou vérifier manuellement.
- L’enrichment est limité par run (ex. 25 joueurs) pour respecter les rate limits ; plusieurs runs ou un cron dédié permettent de vider la file.

### Bonnes pratiques

- Mettre en cache le rang côté app (ex. colonnes `current_rank_*` sur `Player`).
- Rafraîchir périodiquement (30–60 min) via enrichissement, pas à chaque match.
- Ne pas requêter League-V4 à chaque affichage de joueur.

### 403 Forbidden sur League-V4

Si **League-V4** renvoie **403 Forbidden** alors que Summoner-V4 ou Match-V5 fonctionnent, la clé API n’a en général **pas l’accès au produit League-V4**.

- **Riot Developer Portal** : chaque clé est associée à un **produit** et à des **APIs activées** (Match, League, etc.).
- Vérifier dans le portail que **League-v4** est bien activé pour le produit utilisé.
- En développement, les clés personnelles peuvent avoir des limites ; une clé **Production** (après validation) peut être nécessaire pour League-V4 selon la configuration.
- Voir [Riot Developer Portal](https://developer.riotgames.com/) → votre produit → API access.

---

## Workflow de collecte

```
Une seule table **players** (puuid, summoner_id, summoner_name, region, last_seen, created_at, updated_at) sert de source pour le crawl : admin y ajoute des seeds (avec infos complètes), les joueurs rencontrés dans les matchs y sont upsertés, et le cron utilise `last_seen` pour prioriser qui crawler.

```
Phase 0 : players avec summoner_name manquant → enrichissement (Account-v1 by-puuid)
   ↓
Phase 1 : SELECT players (region=EUW1) ORDER BY last_seen ASC NULLS FIRST LIMIT N
   ↓
Match-v5 : match IDs by PUUID (queue 420, versions.json). Si déjà pollé: [last_seen,now]; sinon patch windows
   ↓
UPDATE last_seen après récupération IDs. Déduplication vs DB → getMatch par match non présent
   ↓
Filtre version → upsert match + participants → players. Erreur : skip (log, Discord)
   ↓
Après crawl d’un joueur : UPDATE players SET last_seen = now()
   ↓
Région : EUW1 uniquement.
```

### Étapes implémentées

1. **Phase 0** : Si des players ont `summoner_name` vide, on les enrichit d'abord (Account-v1 by-puuid → Riot ID). Un batch par cycle.
2. **Crawl** : lecture de **players** (region=EUW1) ordonnée par `last_seen ASC NULLS FIRST`, limite `MAX_PUUIDS_PER_RUN`.
3. **Match IDs** : queue 420. Fenêtre : si `last_seen` déjà set → [last_seen, now] ; sinon fenêtres par patch (`versions.json`).
4. **last_seen** : mis à jour immédiatement après récupération des match IDs.
5. **Match details** : déduplication vs DB (hasMatch). Filtre par version puis `upsertMatchFromRiot`. Erreur match/player → skip (log + Discord).
6. **Participants → players** : upsert dans **players** pour chaque participant (puuid, region, summoner_id, last_seen = null en création).
7. **Refresh** : agrégation joueurs (totalGames, totalWins) depuis **participants**.
9. **Récupération des données manquantes** (à chaque passage du cron) :
   - **Nouveaux participants** : dès qu’un match est inséré, les rangs des participants de ce match sont récupérés immédiatement via League-v4 (`backfillRanksForNewMatch`), un appel API par PUUID distinct du match.
   - **Participants sans rank (reste / legacy)** : backfill en batch via `backfillParticipantRanks` (jusqu’à `RIOT_BACKFILL_RANKS_MAX_BATCHES` × `RIOT_BACKFILL_RANKS_PER_RUN` PUUIDs par cycle) pour rattraper les anciens participants ou les cas où l’appel immédiat a échoué.
   - **Matchs sans rank** : recalcul de `Match.rank` (moyenne des rangs des participants) à partir des participants qui ont un rank (`refreshMatchRanks`).
10. **Enrichment** : Summoner-v4 (by-puuid) pour remplir summoner_name.

### Pourquoi certains champs Player sont vides

- **`summoner_name`** : l’API Match-v5 ne renvoie pas le nom d’invocateur dans les participants. Il est rempli uniquement par un **enrichment** (appel Summoner-v4 par PUUID) après le refresh.
- **`current_rank_tier` / `current_rank_division`** : les participants des matchs ne contiennent pas le rang actuel. De plus, `MatchCollectService` ne lit pas le rang côté Riot. Ils sont remplis par un **enrichment** (appel League-v4 entries by summonerId) après le refresh.

Sans étape d’enrichment, ces colonnes restent donc `NULL`.

### Pourquoi certains participants n’ont pas de rank (rank_tier / rank_division / rank_lp)

L’API **Match-v5** ne renvoie **jamais** le rang des joueurs dans le payload d’un match. À l’insertion, les participants sont créés avec `rank_tier`, `rank_division`, `rank_lp` à `NULL`, puis le rang est récupéré **immédiatement** pour ce match (League-v4 par PUUID) via `backfillRanksForNewMatch`.

En complément, un backfill en batch (`backfillParticipantRanks`) rattrape les participants restés sans rank (anciens en base ou échec de l’appel immédiat) :

- **Script manuel** : `npm run riot:backfill-ranks` (depuis `backend/`) ou `npm run riot:backfill-ranks -- 200` pour une limite de 200 PUUIDs.
- **Admin** : `POST /admin/backfill-participant-ranks` avec optionnel `{ "limit": 200 }`.
- **Cron** : si `RIOT_BACKFILL_RANKS_PER_RUN` > 0, le cron lance ce backfill en plusieurs batches après chaque passage (legacy / rattrapage).

Un participant peut rester sans rank si : (1) le joueur est **non classé** (pas d’entrée Solo/Duo) ; (2) l’API League-v4 a renvoyé une erreur (rate limit, 403, etc.) pour ce PUUID.

### Nettoyer les matchs d’une mauvaise version (game_version)

Si des matchs ont été insérés avec une `game_version` qui n’est pas dans les versions autorisées (ex. 15.22.724.5161), supprimez-les avec le script (les participants sont supprimés en cascade) :

- Par IDs : `npm run riot:cleanup-matches -- --ids=346,347,348`
- Par version : `npm run riot:cleanup-matches -- --game-version=15.22.724.5161`

---

## Contraintes et limites

| Contrainte | Détail |
|------------|--------|
| Match IDs par appel | Max 100, pagination (start/count) |
| Rate limits | Stricts (ex. 20 req/s par méthode, 100 req/2 min par app) |
| Queue | On ne collecte que la queue 420 (Ranked Solo/Duo) |
| Région | EUW1 uniquement pour le moment, endpoint régional `europe` pour Match-v5 |
| Couverture | Impossible d’avoir 100 % des matchs ; crawler lentement et localement |

### Bonnes pratiques

- Crawler **lentement** : respect des limites Riot (20 req/s, 100 req/2 min) via `RiotApiService`.
- Stocker **localement** (PostgreSQL), déduplication par `matchId`.
- Filtrer par **queue** (420) et optionnellement par **patch** (`gameVersion`).
- Surveiller les quotas et respecter les **TOS Riot**.

---

## Architecture technique (backend)

- **Rate limiting** : `RiotApiService` applique 20 req/s (50 ms entre requêtes) et une fenêtre glissante 100 req/2 min.
- **Cache clé** : clé API lue depuis fichier admin ou `RIOT_API_KEY` ; cache invalidé en cas de 401/403.
- **Déduplication** : `hasMatch(matchId)` avant fetch détaillé ; `upsertMatchFromRiot` évite les doublons. Les match IDs demandés à Riot sont filtrés par date : premier run = jusqu’à maintenant ; runs suivants = entre `lastSuccessAt` (dernier run) et maintenant, donc pas de reprise des mêmes matchs.
- **Source crawl** : une seule table **players** (puuid, summoner_id, summoner_name, region, last_seen, created_at, updated_at). Les participants des matchs sont upsertés dans **players** ; le cron sélectionne les joueurs par `last_seen ASC NULLS FIRST` et met à jour `last_seen` après chaque crawl.

### Schéma de données (résumé)

- **matches** : `matchId`, `region`, `queueId`, `gameVersion`, `gameDuration`, `rank` (rang moyen des joueurs de la partie, ex. `GOLD_II`).
- **participants** : par match, `puuid`, `championId`, `win`, `role`, `teamPosition`, `rankTier`/`rankDivision`/`rankLp`, `items`, `kills`/`deaths`/`assists`, etc. (pas de `summoner_id` ni `lane`).
- **players** : une ligne par `puuid` (summoner_id, summoner_name, region, last_seen, created_at, updated_at, rang, totalGames, etc.) — source unique pour le crawl et l’affichage.
- **Stats champion par joueur** : calculées à la volée depuis **participants** (pas de table pré-agrégée).

### Filtrage par patch (versions autorisées)

La liste des patches pour lesquels on collecte les matchs est définie dans **`backend/data/game/versions.json`** (et complétée par `version.json`). Chaque entrée (ex. `16.1.1`, `16.2.1`, `16.3.1`) autorise tous les matchs dont `gameVersion` correspond à ce patch (ex. `16.1.xxx`, `16.2.xxx`, `16.3.xxx`).

- **Collecte** : `loadAllowedGameVersions()` charge `versions.json` ; la fenêtre de dates (`matchStartTime`) commence au plus tôt à la **date de sortie la plus ancienne** des versions listées (`releaseDate`), afin d’inclure les matchs de tous les patches (16.1, 16.2, 16.3, etc.). Chaque match récupéré est accepté seulement si `isAllowedGameVersion(gameVersion, allowedVersions)` est vrai.
- **Requêtes** : filtrer en SQL/Prisma sur `Match.gameVersion` (ex. `startsWith` ou parsing).

### Variables d’environnement (collecte)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `RIOT_MATCH_CRON_SCHEDULE` | Cron (ex. `0 * * * *` = toutes les heures) | `0 * * * *` |
| `RIOT_MATCH_MAX_PUUIDS_PER_RUN` | Nombre max de joueurs crawlé par run (depuis **players** par last_seen) | `50` |
| `RIOT_MATCH_CYCLE_DELAY_MS` | Pause entre deux cycles du worker (ms) | `60000` |
| `RIOT_MATCH_RATE_LIMIT_PAUSE_MS` | Pause quand 429 Rate Limit (ms) | `300000` (5 min) |
| `RIOT_MATCH_5XX_PAUSE_MS` | Pause quand beaucoup d'erreurs 5xx (ms, défaut = RATE_LIMIT_PAUSE_MS) | `300000` |
| `RIOT_MATCH_5XX_PAUSE_THRESHOLD` | Seuil d'erreurs 5xx avant pause (riotMatchCollect) | `50` |
| `RIOT_MATCH_BACKOFF_BASE_MS` | Base pour pause exponentielle (401/403, 5xx) : pause = BASE × 2^attempt (ms) | `60000` |
| `RIOT_MATCH_FAST_BACKLOG_THRESHOLD` | Seuil de joueurs non pollés pour activer le mode rapide | `20000` |
| `RIOT_MATCH_FAST_PUUIDS` | Joueurs par run en mode rapide | `100` |
| `RIOT_MATCH_FAST_CYCLE_DELAY_MS` | Délai entre cycles en mode rapide (worker) | `30000` (30 s) |
| `RIOT_5XX_MAX_RETRIES` | Nombre de retries sur 5xx (0–5). Mettre à 0 si l’API Riot renvoie 500 en masse. | `5` |
| `RIOT_MATCH_5XX_SKIP_AFTER` | Après N erreurs 5xx consécutives par joueur, passer au joueur suivant (évite de bloquer). | `5` |
| `RIOT_MATCH_ENRICH_PASSES` | Nombre de passes d'enrichissement (summoner_name) après chaque cycle du worker | `3` |
| `RIOT_MATCH_ENRICH_PER_PASS` | Joueurs à enrichir par passe (worker) | `150` |
| `RIOT_MATCH_CRAWL_RETRIES` | Nombre de tentatives du crawl en cas d’erreur transitoire (worker) | `3` |
| `RIOT_MATCH_CRAWL_BACKOFF_MS` | Délai initial entre deux tentatives (backoff exponentiel, ms) | `30000` |
| `RIOT_BACKFILL_RANKS_PER_RUN` | Nombre de PUUIDs traités par batch de backfill (0 = désactivé). | `200` |
| `RIOT_BACKFILL_RANKS_MAX_BATCHES` | Nombre max de batches de backfill par cycle (drain de la file). | `3` |

### Blocage « aucun nouveau match » malgré des joueurs non pollés

Si le poller signale « aucun nouveau match » en boucle alors que vous avez des milliers de joueurs non pollés (`last_seen IS NULL`) :

- **Cause** : En cas d’erreurs API (429, 5xx, etc.), `last_seen` n’était pas mis à jour pour ces joueurs. Les mêmes 50 joueurs étaient retentés à chaque cycle.
- **Correction** : `last_seen` est désormais toujours mis à jour après traitement d’un joueur, même en cas d’erreur. Le poller progresse dans la file ; les joueurs en erreur seront recrawlés plus tard.
- **Erreurs nombreuses (ex. 130/cycle)** : Souvent liées aux rate limits Riot (100 req/2 min) ou aux erreurs 500/503 de l’API Riot. Vérifier [Riot Status](https://status.riotgames.com/). En cas de backlog élevé (> 20k joueurs non pollés), le **mode rapide** s’active automatiquement : 1 fenêtre de patch, pas de fetch des rangs (backfill plus tard), 100 joueurs/run, délai 30 s entre cycles.
- **Mode rapide** : Quand `players where last_seen IS NULL` ≥ `RIOT_MATCH_FAST_BACKLOG_THRESHOLD` (défaut 20k), on réduit les appels API (1 fenêtre, skip rank) pour vider la file plus vite. Les rangs sont rattrapés par le backfill.

### Worker continu (recommandé) vs cron

- **Worker** : `npm run riot:worker` (depuis `backend/`). Boucle infinie : un cycle = crawl (avec retry + backoff en cas d’erreur transitoire), refresh + enrichissement, puis N passes d’enrichissement, puis pause. En cas d’erreur (réseau, 429, 5xx) : jusqu’à 3 tentatives avec backoff (30s, 60s, 120s) avant de passer au cycle suivant. 401/403 : retry une fois avec la clé Admin puis exit si échec. **Redémarrage** : en production, lancer le worker sous PM2 (ou systemd) avec `autorestart: true` pour que tout crash du process relance le worker.
- **Cron** : exécution périodique via `setupRiotMatchCollect()`. Une seule exécution par créneau.
- **One-shot** : `npm run riot:collect` pour un seul cycle.

### Statut cron et « dernier récupéré »

L’admin affiche pour chaque job un **lastSuccessAt** (dernière **fin** de run **réussie**). Pour `riotMatchCollect`, si cette date reste ancienne (ex. 04/02 14:38 alors qu’on est le 05/02 09h), cela signifie qu’**aucun run ne s’est terminé avec succès** depuis : soit le cron ne tourne pas (process arrêté, mauvaise planification), soit chaque run échoue (exception avant `markSuccess`).

- **Safeguard** : si `lastSuccessAt` a plus de 12 h, le prochain run utilise une fenêtre de repli (dernières 24 h) pour demander les matchs à Riot, afin de continuer à récupérer des matchs récents même après une longue période sans succès.
- **Logs** : au début du crawl, le backend log `Match window: <start> -> <end>` (UTC) pour vérifier la fenêtre utilisée.
- **Vérifications** : s’assurer que le backend (cron ou worker) tourne, consulter les logs au moment du run, ou lancer manuellement `npm run riot:collect` depuis `backend/` et regarder les erreurs éventuelles.

### Rangs participants et Match.rank

Les participants ont `rankTier`, `rankDivision`, `rankLp` (rang Solo/Duo au moment du match). L’API Match v5 ne les fournit pas ; ils sont remplis via l’API League v4 (by-puuid). Pour les entrées déjà en base sans rang :

- **Backfill + refresh Match.rank** (recommandé) : depuis `backend/`, `npm run riot:backfill-ranks` (ou `npm run riot:backfill-ranks -- 200` pour une limite). Lance le backfill des rangs participants puis recalcule `Match.rank` pour tous les matchs. Variable d’environnement optionnelle : `RIOT_BACKFILL_RANK_LIMIT` (défaut 200).
- **Refresh Match.rank seul** : `npm run riot:refresh-match-ranks` pour recalculer uniquement `Match.rank` à partir des participants déjà remplis.
- **Via l’API admin** : `POST /api/admin/backfill-participant-ranks?limit=200` et `POST /api/admin/refresh-match-ranks` (auth admin, port selon `PORT` dans `.env`).

---

## Ce qui est impossible

- Tous les matchs EUW.
- Tous les matchs d’un patch.
- Tous les joueurs d’une région.
- Dump complet de la base Riot.

Le système est conçu pour un **site de statistiques LoL** et une **analyse data à long terme**, sans supposer un accès global aux données.
