# Calculs des statistiques

Ce document liste et explique les formules utilisées pour les statistiques LoL (winrate, pickrate, banrate, objectifs, durée, progression, etc.). Les données viennent de la base PostgreSQL (matches, participants, match_teams, bans, objectifs).

**Voir aussi :** [Audit des formules de stats](stats-formulas-audit.md) pour la conformité détaillée et les cas particuliers (banrate overview vs teams).

---

## 1. Conventions et sources

- **Matchs filtrés** : selon `game_version` (ex. 16.1) et/ou `rank` (ex. GOLD). Une partie des stats est calculée sans filtre (cache en vues matérialisées).
- **Équipe gagnante / perdante** : déduite de `match_teams.win` (plus de `participants.win`).
- **Rôle équipe** : les 5 premiers participants d’un match = équipe 100 (bleue), les 5 suivants = équipe 200 (rouge), via `ROW_NUMBER() OVER (PARTITION BY match_id ORDER BY id)`.

---

## 2. Champions

### 2.1 Winrate

**Définition :** proportion de parties gagnées parmi les parties jouées avec ce champion.

```
winrate_champion(X) = (parties gagnées avec X) / (parties jouées avec X)
                    = wins / games
```

- **games** : `COUNT(*)` sur les participants où `champion_id = X` (une ligne = une partie).
- **wins** : `SUM(CASE WHEN mt.win THEN 1 ELSE 0 END)` en joignant `match_teams mt` sur `(match_id, team_id)` via le rôle équipe (p_team).

**Affichage :** souvent en % (ex. `100 * wins / games`).  
**Où :** `get_stats_champions`, `get_stats_overview` (top winrate), détail champion, tier list, etc.

### 2.2 Pickrate

**Définition :** proportion de matchs où le champion est pick.

```
pickrate_champion(X) = (nombre de matchs où X est pick) / (nombre total de matchs)
                     = games / total_matches
```

- **games** : nombre de matchs distincts où au moins un participant a `champion_id = X` (un pick par champion par match).
- **total_matches** : `COUNT(DISTINCT match_id)` sur les matchs filtrés.

**En % :** `100 * games / total_matches`.  
**Où :** `get_stats_champions`, `get_stats_overview` (top pickrate), détail champion.

### 2.3 Banrate

**Définition :** proportion de matchs où le champion est banni (au moins une fois dans le match).

```
banrate_champion(X) = (nombre de matchs où X est banni) / (nombre total de matchs)
                   = ban_count / total_matches
```

- **ban_count** : `COUNT(DISTINCT match_id)` sur les bans où `champion_id = X` (ou équivalent par match_team).
- **total_matches** : même dénominateur que pour le pickrate.

**En % :** `100 * ban_count / total_matches`.  
**Où :** `get_stats_champions`, `get_stats_overview` (topBanrateChampions, après correction migration 20260214130504).

**Note :** Les vues « bans par équipe gagnante/perdante » (overview-teams) utilisent un autre indicateur (répartition des bans entre gagnants/perdants, pas « matchs où banni / |M| »). Voir [stats-formulas-audit.md](stats-formulas-audit.md).

### 2.4 Presence

**Définition :** proportion de matchs où le champion est soit pick soit ban.

```
presence(X) = (games + ban_count) / total_matches
```

Souvent affiché en %. Utilisé dans la liste champions et le détail champion.

---

## 3. Overview (résumé global)

Source : `get_stats_overview(p_version, p_rank_tier)` (et cache `mv_stats_overview`).

- **totalMatches** : `COUNT(*)` sur les matchs filtrés.
- **lastUpdate** : `MAX(matches.created_at)` sur les matchs filtrés.
- **playerCount** : `COUNT(DISTINCT participant.player_id)` sur les participants des matchs filtrés.
- **matchesByDivision** : pour chaque tier (IRON, BRONZE, …), `COUNT(*)` des matchs où `UPPER(TRIM(split_part(rank, '_', 1))) = tier`.
- **matchesByVersion** : pour chaque version (ex. 16.1, 16.2), `COUNT(*)` des matchs où le préfixe `game_version` correspond.
- **topWinrateChampions** : champions avec au moins 20 parties, triés par winrate décroissant, limit 10 (winrate = wins/games comme en 2.1).
- **topPickrateChampions** : idem, tri par pickrate, limit 5.
- **topBanrateChampions** : idem, tri par banrate (matchs où banni / total matchs), limit 5.

---

## 4. Objectifs (équipes)

Source : `get_stats_overview_teams(p_version, p_rank_tier)`. Données dérivées de `match_teams` et `match_team_first_objectives`.

### 4.1 Bans par équipe gagnante / perdante

- **byWin** : pour chaque champion, nombre de bans par les équipes qui ont gagné (comptage des slots de ban, pas « matchs où banni »).
- **byLoss** : idem pour les équipes perdantes.

### 4.2 First objectif (first blood, first dragon, first tower, etc.)

**Définition :** pour un type d’objectif O (champion, tower, dragon, baron, …) :

```
firstByWin  = nombre d’équipes qui ont pris le first O et ont gagné
firstByLoss = nombre d’équipes qui ont pris le first O et ont perdu
winrate_first_O = firstByWin / (firstByWin + firstByLoss)
```

Les champs first viennent de la table `match_team_first_objectives` (une ligne par équipe par type d’objectif « first »).

### 4.3 Kills d’objectifs (baron, dragon, tower, inhibitor, rift herald, horde)

Pour chaque objectif avec « kills » :

- **killsByWin** / **killsByLoss** : somme des kills de l’objectif pour les équipes gagnantes / perdantes.
- **distributionByWin** : pour chaque entier `n`, nombre d’équipes gagnantes avec exactement `n` kills (ex. 2 barons).
- **distributionByLoss** : idem pour les équipes perdantes.

**Winrate conditionnel :**  
`winrate_O(n) = distributionByWin[n] / (distributionByWin[n] + distributionByLoss[n])`.  
Winrate si « au moins n » : en sommant les comptes pour k ≥ n.

---

## 5. Overview détail (runes, items, sorts d’invocateur)

Source : `get_stats_overview_detail(p_version, p_rank_tier)`. Base : `mv_overview_detail_base` (participants avec runes, items, summoner_spells, win depuis match_teams).

### 5.1 Runes

- **pickrate_rune(X)** : `100 * (nombre de participants avec la rune X) / total_participants`.
- **winrate_rune(X)** : `100 * wins / games` pour les participants ayant la rune X (wins via match_teams).

Runes par match : une rune compte une fois par participant ; les « rune sets » (combinaisons) sont agrégés de la même façon (games, wins, pickrate, winrate).

### 5.2 Items (inventaire final)

- **pickrate_item(X)** : `100 * (nombre de participants avec l’item X en inventaire final) / total_participants`.
- **winrate_item(X)** : `100 * wins / games` pour les participants ayant l’item X.

Les items sont ceux présents en fin de partie (colonnes dérivées / JSON participant).

### 5.3 Sorts d’invocateur

- **pickrate_spell(X)** : `100 * (nombre de participants avec le sort X en spell1 ou spell2) / total_participants`.
- **winrate_spell(X)** : `100 * wins / games` pour les participants ayant ce sort.

---

## 6. Winrate par durée de partie

Source : `get_stats_overview_duration_winrate`, `get_stats_duration_winrate_by_champion`.

**Idée :** découper les matchs en tranches de durée (ex. 5 min) et calculer le winrate par tranche.

- **duration_min** : tranche en minutes, ex. `FLOOR((game_duration / 60) / 5) * 5` (0, 5, 10, …).
- **match_count** : nombre de matchs dans la tranche (filtrés version/rank).
- **wins** : nombre de matchs gagnés dans la tranche (via match_teams.win, première équipe du match = côté « win » considéré par match).
- **winrate** : `100 * wins / match_count` par tranche.

La version « by champion » restreint aux matchs où le champion est joué et applique la même logique (tranches 5 min, winrate par tranche).

---

## 7. Progression (évolution par version)

Source : `get_stats_overview_progression`, `get_stats_overview_progression_full`.

**Idée :** comparer le winrate d’un champion sur la version la plus ancienne (ex. 16.1) à son winrate sur toutes les versions ≥ cette version.

- **oldestVersion** : ex. 16.1 (paramètre `p_version_oldest`).
- **wr_oldest** : winrate du champion sur les matchs dont `game_version LIKE p_version_oldest.%` (ex. 16.1 uniquement), avec seuil min games (ex. 20).
- **wr_since** : winrate sur les matchs dont la version (prefix 16.x) ≥ p_version_oldest.
- **delta** : `wr_since - wr_oldest` (gainers = delta > 0, losers = delta < 0).

La version « full » expose une liste de champions avec `wrOldest`, `wrSince`, `deltaWr`, `deltaPick` (même idée pour le pickrate).

---

## 8. Tier list (lane / patch)

Source : service Tier List (données dérivées de `get_stats_champions` ou requêtes dédiées par rôle/patch).

### 8.1 Tier score (champion × rôle)

```
tierScore = (winrate - 0.5) * sqrt(games)
```

- **winrate** : en proportion (0–1), pour le champion sur le rôle principal.
- **games** : nombre de parties sur ce rôle.  
Plus le volume est élevé et le winrate éloigné de 50 %, plus le score est extrême. Les tiers (S, A, B, C, D) sont dérivés de ce score (seuils).

### 8.2 PBI (Performance Beyond Impact)

```
PBI = (winrate_pct - 50) * pickrate_pct / (100 - banrate_pct)
```

- **winrate_pct**, **pickrate_pct**, **banrate_pct** : en % (0–100).  
Interprétation : force du champion (écart à 50 % winrate) pondérée par la pickrate et « corrigée » par la banrate (dénominateur évite les divisions par zéro quand tout le monde ban un champion).

---

## 9. Matchups (champion à un rôle donné vs opposant au même rôle)

Les matchups sont toujours **par lane** : un champion A au rôle R (ex. MIDDLE) contre un champion B au même rôle R (opposant direct dans la lane). Les données sont donc (patch, lane, champion_id, opponent_champion_id) avec games, wins.

### 9.1 Méthode type Lolalytics (Delta + bandes + pondération)

**Delta(A→B)** : écart entre le winrate de A face à B et le winrate moyen des autres champions (éligibles) face à B :

```
winrate_A_vs_B = 100 * wins(A vs B) / games(A vs B)
avg_winrate_others_vs_B = moyenne des winrate(C vs B) pour tout champion C ≠ A avec games(C vs B) ≥ minGames (ex. 100)
Delta(A→B) = winrate_A_vs_B - avg_winrate_others_vs_B
```

Par construction, **Delta(A→B) ≠ Delta(B→A)** (moyenne des “autres” différente, et ELO mixte possible). On peut **recentrer** la distribution des Delta sur 0 (soustraire la moyenne des Delta du jeu de données) pour appliquer les bandes de façon symétrique.

**Score de matchup** (un matchup = une paire A vs B à une lane) : on mappe Delta sur une note de -10 à +10, puis on pondère par le poids du matchup :

| Delta (en points de winrate) | Score de base (avant pondération) |
|------------------------------|-----------------------------------|
| Delta < -5                    | -10 (matchup très difficile)      |
| -5 ≤ Delta < -2               | -6 (matchup difficile)            |
| -2 ≤ Delta < -0,5             | -3 (matchup défavorable)          |
| -0,5 ≤ Delta ≤ 0,5            | 0 (matchup even)                  |
| 0,5 < Delta ≤ 2               | +3 (matchup favorable)            |
| 2 < Delta ≤ 5                 | +6 (matchup facile)               |
| Delta > 5                     | +10 (matchup très facile)         |

**Pondération** : ratio entre le nombre de parties jouées dans ce matchup et le nombre total de parties du champion A sur ce rôle :

```
pondération(A vs B) = games(A vs B) / total_games(A au rôle R)
```

**Score de matchup pondéré** : `score_matchup(A vs B) = score_de_base(Delta(A→B)) × pondération(A vs B)`.

**Note du champion (à un rôle donné)** : somme des scores de matchup pondérés sur tous les opposants :

```
note_champion_A_rôle_R = Σ_B score_matchup(A vs B)
```

Cette note agrège la difficulté des matchups pondérée par la fréquence de jeu de chaque opposition.

### 9.2 Ancienne méthode (score par agrégats winrate/KDA/level)

Pour référence (ex. table `matchup_tier_scores` si réintroduite) : score -10..+10 à partir de winrate lissé, KDA et level :

- **smoothedWinrate** : `(wins + 10) / (games + 20)` en %.
- **wrComponent** : `clamp(((smoothedWinrate - 50) / 50) * 10, -10, 10)`.
- **kdaComponent** : `clamp(((avgKda - 3) / 3) * 10, -10, 10)`.
- **levelComponent** : `clamp(((avgLevel - 14) / 4) * 10, -10, 10)`.
- **raw** : `0.8 * wrComponent + 0.1 * kdaComponent + 0.1 * levelComponent`.
- **confidence** : `clamp(games / 60, 0, 1)`.
- **score** : `clamp(round(raw * confidence), -10, 10)`.

**delta_vs_prev_patch** : différence entre ce score et le score du même matchup au patch précédent.

---

## 10. Abandons (remake, surrender)

Source : `StatsAbandonsService.getOverviewAbandons` (requêtes SQL directes).

- **totalMatches** : `COUNT(DISTINCT m.id)` sur les matchs filtrés (version, rank).
- **remakeCount** : nombre de matchs où au moins un participant a 0 item (inventaire vide ou null) → considéré comme remake (AFK / non connecté).
- **remakeRate** : `100 * remakeCount / totalMatches`.
- **earlySurrenderCount** : nombre de matchs avec early surrender (définition côté données : colonne sur match ou participants selon migrations).
- **earlySurrenderRate** : `100 * earlySurrenderCount / totalMatches`.
- **surrenderCount** : nombre de matchs avec surrender (toutes types).
- **surrenderRate** : `100 * surrenderCount / totalMatches`.

**Note :** Après les migrations qui ont supprimé les colonnes surrender des participants, les comptes surrender/early surrender doivent être dérivés des colonnes sur `matches` (`game_ended_in_surrender`, `game_ended_in_early_surrender`) si le code a été mis à jour.

---

## 11. Côté (bleu vs rouge) 

Source : `getOverviewSidesStats` (StatsOverviewService).

- **sideWinrate** : pour team_id 100 (bleu) et 200 (rouge), `wins / matches` (nombre de matchs où l’équipe a gagné / nombre de matchs où l’équipe a joué).
- **championWinrateBySide** : pour chaque champion, winrate quand joué côté bleu vs côté rouge (top N par côté).

---

## 12. Où c’est implémenté (référence rapide)

| Calcul / métrique           | Backend (service ou SQL)                    | API / cache                          |
|----------------------------|---------------------------------------------|--------------------------------------|
| Champion winrate/pickrate/banrate | `get_stats_champions` (SQL)               | GET /api/stats/champions, overview   |
| Overview (totaux, top 5)   | `get_stats_overview` (SQL), mv_stats_overview | GET /api/stats/overview              |
| Objectifs (first, kills)   | `get_stats_overview_teams` (SQL)            | GET /api/stats/overview-teams        |
| Runes / items / spells     | `get_stats_overview_detail` (SQL)          | GET /api/stats/overview-detail       |
| Winrate par durée          | `get_stats_overview_duration_winrate`, by_champion | GET /api/stats/duration-winrate, …   |
| Progression (gainers/losers) | `get_stats_overview_progression`, _full   | GET /api/stats/progression, …       |
| Tier list (tier score, PBI)| TierListService, requêtes par rôle/patch   | GET /api/stats/tier-list, …         |
| Matchups (score, delta)    | MatchupTierService, matchup_tier_scores    | GET /api/stats/matchups, …           |
| Abandons                   | StatsAbandonsService                        | GET /api/stats/abandons              |
| Côté bleu/rouge            | StatsOverviewService.getOverviewSidesStats | GET /api/stats/overview-sides        |

Les vues matérialisées `mv_stats_champions`, `mv_stats_overview`, `mv_stats_overview_teams` mettent en cache les résultats des fonctions sans filtre (version/rank null) pour des réponses rapides ; elles sont rafraîchies après collecte (voir [migrations-long-running.md](migrations-long-running.md)).
