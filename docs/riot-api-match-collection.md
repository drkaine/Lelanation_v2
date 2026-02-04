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
Admin : ajout seed → players (puuid, summoner_id, summoner_name, region, last_seen = null)
   ↓
League-v4 : Challenger / GM / Master → Summoner-v4 → upsert players (sans doublon)
   ↓
Crawl : SELECT players ORDER BY last_seen ASC NULLS FIRST LIMIT N
   ↓
Match-v5 : match IDs by PUUID (queue 420) → match details
   ↓
Pour chaque match inséré : extraction des 10 participants → upsert players (puuid, region, summoner_id, last_seen = null)
   ↓
Après crawl d’un joueur : UPDATE players SET last_seen = now()
   ↓
Refresh + enrichment (stats, summoner_name, rank)
```

### Étapes implémentées

1. **Seed Admin** : Admin > Joueurs seed. Résolution Riot ID (Account-v1) → puuid ; Summoner-v4 by-puuid → summoner_id, summoner_name. Création dans **players** (puuid, summoner_id, summoner_name, region, last_seen = null). Pas de doublon (unicité sur puuid).
2. **Seed League** : Challenger (4), Grandmaster (3), Master (3) par plateforme (EUW, EUNE). Summoner-v4 → upsert dans **players** (last_seen = null).
3. **Crawl** : lecture de **players** ordonnée par `last_seen ASC NULLS FIRST`, limite `MAX_PUUIDS_PER_RUN`. Les joueurs jamais crawlé (last_seen null) passent en premier.
4. **Match IDs** : par joueur crawlé, queue 420, fenêtre de dates (premier run = récents ; runs suivants = depuis lastSuccessAt).
5. **Match details** : si déjà en base on skip ; sinon `upsertMatchFromRiot` (pas de doublon).
6. **Participants → players** : pour chaque participant du match, upsert dans **players** (puuid, region, summoner_id si dispo, last_seen = null en création). Tous les joueurs rencontrés sont ainsi ajoutés pour un crawl futur, sans doublon.
7. **last_seen** : après avoir crawlé un joueur (récupéré ses matchs), mise à jour `players.last_seen = now()` pour ce puuid.
8. **Refresh** : agrégation joueurs et champion_player_stats depuis **participants**.
9. **Enrichment** : Summoner-v4 (by-puuid) et League-v4 pour remplir summoner_name, current_rank_* ; recopie du rang sur **Participant**.

### Pourquoi certains champs Player sont vides

- **`summoner_name`** : l’API Match-v5 ne renvoie pas le nom d’invocateur dans les participants. Il est rempli uniquement par un **enrichment** (appel Summoner-v4 par PUUID) après le refresh.
- **`current_rank_tier` / `current_rank_division`** : les participants des matchs ne contiennent pas le rang actuel. De plus, `MatchCollectService` ne lit pas le rang côté Riot. Ils sont remplis par un **enrichment** (appel League-v4 entries by summonerId) après le refresh.

Sans étape d’enrichment, ces colonnes restent donc `NULL`.

---

## Contraintes et limites

| Contrainte | Détail |
|------------|--------|
| Match IDs par appel | Max 100, pagination (start/count) |
| Rate limits | Stricts (ex. 20 req/s par méthode, 100 req/2 min par app) |
| Queue | On ne collecte que la queue 420 (Ranked Solo/Duo) |
| Région | EUW (euw1) + EUNE (eun1), endpoint régional `europe` pour Match-v5 |
| Couverture | Impossible d’avoir 100 % des matchs ; crawler lentement et localement |

### Bonnes pratiques

- Crawler **lentement** (délai entre requêtes, ex. 70 ms).
- Stocker **localement** (PostgreSQL), déduplication par `matchId`.
- Filtrer par **queue** (420) et optionnellement par **patch** (`gameVersion`).
- Surveiller les quotas et respecter les **TOS Riot**.

---

## Architecture technique (backend)

- **Rate limiting** : `RiotApiService` applique un délai fixe entre chaque requête (ex. 70 ms).
- **Cache clé** : clé API lue depuis fichier admin ou `RIOT_API_KEY` ; cache invalidé en cas de 401/403.
- **Déduplication** : `hasMatch(matchId)` avant fetch détaillé ; `upsertMatchFromRiot` évite les doublons. Les match IDs demandés à Riot sont filtrés par date : premier run = jusqu’à maintenant ; runs suivants = entre `lastSuccessAt` (dernier run) et maintenant, donc pas de reprise des mêmes matchs.
- **Source crawl** : une seule table **players** (puuid, summoner_id, summoner_name, region, last_seen, created_at, updated_at). Les participants des matchs sont upsertés dans **players** ; le cron sélectionne les joueurs par `last_seen ASC NULLS FIRST` et met à jour `last_seen` après chaque crawl.

### Schéma de données (résumé)

- **matches** : `matchId`, `region`, `queueId`, `gameVersion`, `gameCreation`, `gameDuration`.
- **participants** : par match, `puuid`, `championId`, `win`, `role`, `items`, `kills`/`deaths`/`assists`, etc.
- **players** : une ligne par `puuid` (summoner_id, summoner_name, region, last_seen, created_at, updated_at, rang, totalGames, etc.) — source unique pour le crawl et l’affichage.
- **champion_player_stats** : stats par joueur et champion (winrate, moyennes KDA).

### Filtrage par patch

Le champ `gameVersion` (ex. `"15.1.123.456"`) est stocké sur chaque match. Pour filtrer par patch :

- En **collecte** : variable d’environnement `RIOT_MATCH_PATCH_PREFIX` (ex. `15.1`) pour ignorer les matchs dont `gameVersion` ne commence pas par ce préfixe.
- En **requêtes** : filtrer en SQL/Prisma sur `Match.gameVersion` (e.g. `startsWith` ou parsing).

### Variables d’environnement (collecte)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `RIOT_MATCH_CRON_SCHEDULE` | Cron (ex. `0 * * * *` = toutes les heures) | `0 * * * *` |
| `RIOT_MATCH_MAX_PUUIDS_PER_RUN` | Nombre max de joueurs crawlé par run (depuis **players** par last_seen) | `50` |
| `RIOT_MATCH_PATCH_PREFIX` | Préfixe de patch pour filtrer les matchs (ex. `15.1`) | (aucun) |
| `RIOT_MATCH_CYCLE_DELAY_MS` | Pause entre deux cycles du worker (ms) | `60000` |
| `RIOT_MATCH_ENRICH_PASSES` | Nombre de passes d'enrichissement (summoner_name) après chaque cycle du worker | `3` |
| `RIOT_MATCH_ENRICH_PER_PASS` | Joueurs à enrichir par passe (worker) | `150` |
| `RIOT_MATCH_CRAWL_RETRIES` | Nombre de tentatives du crawl en cas d’erreur transitoire (worker) | `3` |
| `RIOT_MATCH_CRAWL_BACKOFF_MS` | Délai initial entre deux tentatives (backoff exponentiel, ms) | `30000` |

### Worker continu (recommandé) vs cron

- **Worker** : `npm run riot:worker` (depuis `backend/`). Boucle infinie : un cycle = crawl (avec retry + backoff en cas d’erreur transitoire), refresh + enrichissement, puis N passes d’enrichissement, puis pause. En cas d’erreur (réseau, 429, 5xx) : jusqu’à 3 tentatives avec backoff (30s, 60s, 120s) avant de passer au cycle suivant. 401/403 : retry une fois avec la clé Admin puis exit si échec. **Redémarrage** : en production, lancer le worker sous PM2 (ou systemd) avec `autorestart: true` pour que tout crash du process relance le worker.
- **Cron** : exécution périodique via `setupRiotMatchCollect()`. Une seule exécution par créneau.
- **One-shot** : `npm run riot:collect` pour un seul cycle.

---

## Ce qui est impossible

- Tous les matchs EUW.
- Tous les matchs d’un patch.
- Tous les joueurs d’une région.
- Dump complet de la base Riot.

Le système est conçu pour un **site de statistiques LoL** et une **analyse data à long terme**, sans supposer un accès global aux données.
