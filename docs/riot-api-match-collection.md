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
| Utiliser le PUUID avec League-V4 | League-V4 attend **summonerId** uniquement. |
| Utiliser une route continentale pour League-V4 | League-V4 est une API **régionale** (platform). |

### Implémentation dans le projet

- **RiotApiService** : `getSummonerByPuuid(platform, puuid)` → retourne `id` (summonerId) ; `getLeagueEntriesBySummonerId(platform, summonerId)` → retourne `tier`, `rank`, `leaguePoints` pour Solo/Duo.
- **StatsPlayersRefreshService.enrichPlayers()** : pour les joueurs avec `currentRankTier` vide et `summonerId` renseigné (ou après avoir récupéré le summoner via Summoner-V4), appelle League-V4 et met à jour `Player.currentRankTier`, `currentRankDivision`, `currentRankLp`.

### Vérifier les joueurs au rang vide

- **Admin** : `GET /api/admin/players-missing-rank` renvoie la liste des joueurs avec `currentRankTier` vide (avec ou sans `summonerId`), pour relancer l’enrichment ou vérifier manuellement.
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
Seed players (DB: SeedPlayer) + file PUUID persistée (DB: PuuidCrawlQueue)
   ↓
League-v4: Challenger / GM / Master → summonerId → Summoner-v4 → puuid
   ↓
PUUID queue en mémoire (seed + drain DB + participants des matchs)
   ↓
Match-v5: match IDs by PUUID (queue 420, pagination)
   ↓
Match-v5: match details
   ↓
Extract participants (10 PUUIDs par match)
   ↓
Expand : en mémoire (run courant) + persistance en DB (PuuidCrawlQueue) pour les runs suivants
```

### Étapes implémentées

1. **Seed Admin (DB)** : joueurs en base (`SeedPlayer`). Admin > Joueurs seed (Riot ID `Nom#Tag` ou nom d’invocateur + plateforme). Résolution : Riot ID → Account-v1 → PUUID ; nom d’invocateur → Summoner-v4 by-name → PUUID.
2. **Drain file PUUID (DB)** : au début de chaque run, le cron lit jusqu’à `MAX_PUUIDS_PER_RUN` entrées dans `PuuidCrawlQueue` (ordre `addedAt`), les ajoute à la file en mémoire, puis les supprime de la table.
3. **Seed League** : Challenger (4), Grandmaster (3), Master (3) par plateforme (EUW, EUNE). Conversion : summonerId → Summoner-v4 → puuid.
4. **Match IDs** : par PUUID, queue 420, ~20 IDs par joueur. **Fenêtre de dates** : premier run = `endTime=now` (matchs récents) ; runs suivants = `startTime=dernier run`, `endTime=now` (évite de redemander les mêmes IDs et les doublons).
5. **Match details** : pour chaque match ID, si déjà en base (`hasMatch(matchId)`) on skip ; sinon fetch détail puis `upsertMatchFromRiot` (pas de doublon).
6. **Expansion** : extraction des 10 PUUIDs participants ; ajout en mémoire (run courant) et `createMany` en DB (`PuuidCrawlQueue`, `skipDuplicates: true`) pour les runs suivants. Les matchs déjà vus ne sont pas re-traités.
7. **Refresh** : après collecte, mise à jour des joueurs et stats champions (PostgreSQL).
8. **Enrichment** (optionnel) : pour les joueurs en base, appel Summoner-v4 (by puuid) et League-v4 (by summonerId) pour remplir `summoner_name`, `current_rank_tier`, `current_rank_division`. Les mêmes valeurs de rang sont recopiées sur les lignes **Participant** (`rank_tier`, `rank_division`, `rank_lp`) pour ce puuid, car l’API Match ne fournit pas le rang par participant.

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
- **File PUUID** : dans un run, après stockage d’un match, les PUUIDs des participants sont ajoutés à une file (en mémoire, bornée) et à `PuuidCrawlQueue` en DB pour les runs suivants ; on ne retraite pas les matchs déjà en base.

### Schéma de données (résumé)

- **matches** : `matchId`, `region`, `queueId`, `gameVersion`, `gameCreation`, `gameDuration`.
- **participants** : par match, `puuid`, `championId`, `win`, `role`, `items`, `kills`/`deaths`/`assists`, etc.
- **players** : agrégation par `puuid` (région, rang, totalGames, etc.).
- **champion_player_stats** : stats par joueur et champion (winrate, moyennes KDA).

### Filtrage par patch

Le champ `gameVersion` (ex. `"15.1.123.456"`) est stocké sur chaque match. Pour filtrer par patch :

- En **collecte** : variable d’environnement `RIOT_MATCH_PATCH_PREFIX` (ex. `15.1`) pour ignorer les matchs dont `gameVersion` ne commence pas par ce préfixe.
- En **requêtes** : filtrer en SQL/Prisma sur `Match.gameVersion` (e.g. `startsWith` ou parsing).

### Variables d’environnement (collecte)

| Variable | Description | Défaut |
|----------|-------------|--------|
| `RIOT_MATCH_CRON_SCHEDULE` | Cron (ex. `0 * * * *` = toutes les heures) | `0 * * * *` |
| `RIOT_MATCH_MAX_PUUIDS_PER_RUN` | Nombre max de PUUIDs traités par run (seed + expansion) | `50` |
| `RIOT_MATCH_PATCH_PREFIX` | Préfixe de patch pour filtrer les matchs (ex. `15.1`) | (aucun) |

---

## Ce qui est impossible

- Tous les matchs EUW.
- Tous les matchs d’un patch.
- Tous les joueurs d’une région.
- Dump complet de la base Riot.

Le système est conçu pour un **site de statistiques LoL** et une **analyse data à long terme**, sans supposer un accès global aux données.
