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
4. **Match IDs** : par PUUID, queue 420 (Ranked Solo/Duo), ~20 IDs par joueur.
5. **Match details** : pour chaque match non déjà en base.
6. **Expansion** : extraction des 10 PUUIDs participants ; ajout en mémoire (run courant) et `createMany` en DB (`PuuidCrawlQueue`, `skipDuplicates: true`) pour les runs suivants.
7. **Refresh** : après collecte, mise à jour des joueurs et stats champions (PostgreSQL).

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
- **Déduplication** : `hasMatch(matchId)` avant fetch détaillé ; `upsertMatchFromRiot` évite les doublons.
- **File PUUID** : dans un run, après stockage d’un match, les PUUIDs des participants sont ajoutés à une file (en mémoire, bornée) et traités dans la même exécution pour étendre le graphe.

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
