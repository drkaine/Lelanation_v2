# Audit des formules de stats (champions, runes, items, summoner spells)

Ce document compare les formules cibles (document utilisateur) avec l’implémentation actuelle.

**Notation:**  
- `M` = ensemble des matchs filtrés (patch / queue / région)  
- `|M|` = nombre total de matchs  
- `P` = ensemble des participants (10 × |M|)  
- `X` = entité (champion / rune / item / summoner)

---

## 1. Champions

### Pickrate (cible)

`pickrate_champion(X) = |{ m ∈ M : X est pick dans m }| / |M|`

**Implémentation:**  
- `get_stats_champions`: `pickrate = 100 * games / total_matches` avec `games = COUNT(*)` sur `participants` où `champion_id = X` et `total_matches = COUNT(DISTINCT match_id)`. Chaque match contribue au plus une fois (un pick par champion par match). Donc `games = |{ m : X pick dans m }|`. **✅ Conforme.**

- `get_stats_overview` (top winrate / top pickrate): même logique, pickrate = `COUNT(*) / (SELECT COUNT(*) FROM matches m WHERE ...)`. **✅ Conforme.**

### Banrate (cible)

`banrate_champion(X) = |{ m ∈ M : X est ban dans m }| / |M|`

**Implémentation:**  
- `get_stats_champions`: `match_bans` = `DISTINCT (m.id, champion_id)`, puis `ban_count = COUNT(*)` par champion → nombre de **matchs** où le champion est banni. `banrate = 100 * ban_count / total_matches`. **✅ Conforme.**

- `get_stats_overview` (topBanrateChampions): actuellement `ban_count = COUNT(*)` sur tous les slots de ban (si les deux équipes bannissent le même = 2), puis `banrate = 100 * ban_count / (2 * total_matches)`. Ce n’est **pas** la formule cible (on veut “nombre de matchs où X est banni”, pas “nombre de bans / 2”). **❌ À corriger.**

### Winrate (cible)

`winrate_champion(X) = |{ p ∈ P : p.champion = X AND p.win }| / |{ p ∈ P : p.champion = X }|`

**Implémentation:**  
- Partout: `winrate = 100 * wins / NULLIF(games, 0)` avec `wins = SUM(win::int)` et `games = COUNT(*)` sur les participants avec ce champion. **✅ Conforme.**

---

## 2. Runes (overview global)

### Pickrate (cible)

`pickrate_rune(X) = |{ p ∈ P : p utilise rune X }| / |P|`

**Implémentation:**  
- `get_stats_overview_detail`: `total_participants = COUNT(*)` sur la base filtrée (= |P|). Pour chaque rune (perk_id): `pickrate = 100 * COUNT(*) / total_participants`. **✅ Conforme.**

### Winrate (cible)

`winrate_rune(X) = |{ p : p utilise rune X AND p.win }| / |{ p : p utilise rune X }|`

**Implémentation:**  
- `winrate = 100 * SUM(win::int) / NULLIF(COUNT(*), 0)` par rune. **✅ Conforme.**

---

## 3. Summoner spells (overview global)

### Pickrate (cible)

`pickrate_summoner(X) = |{ p ∈ P : p a spell X en spell1 OU spell2 }| / |P|`

**Implémentation:**  
- `get_stats_overview_detail`: `spell_flat` déplie `summoner_spells`; par spell_id: `pickrate = 100 * COUNT(*) / total_participants`. **✅ Conforme.**

### Winrate (cible)

`winrate_summoner(X) = |{ p : p a spell X AND p.win }| / |{ p : p a spell X }|`

**Implémentation:**  
- `winrate = 100 * SUM(win::int) / NULLIF(COUNT(*), 0)` par spell. **✅ Conforme.**

---

## 4. Items (overview global)

### Pickrate inventaire final (cible)

`pickrate_item(X) = |{ p ∈ P : p a item X dans inventaire final }| / |P|`

**Implémentation:**  
- `get_stats_overview_detail`: `item_flat` déplie `b.items` (inventaire final). `pickrate = 100 * COUNT(*) / total_participants`. **✅ Conforme.**

### Winrate (cible)

`winrate_item(X) = |{ p : p a item X AND p.win }| / |{ p : p a item X }|`

**Implémentation:**  
- `winrate = 100 * SUM(win::int) / NULLIF(COUNT(*), 0)` par item. **✅ Conforme.**

*(La variante “pickrate achat à un moment donné” n’est pas implémentée dans l’overview; les items sont en “inventaire final” uniquement.)*

---

## 5. Synthèse et correction à faire

| Entité / métrique        | Où c’est calculé              | Statut      |
|--------------------------|--------------------------------|-------------|
| Champion pickrate        | get_stats_champions, overview  | ✅ Conforme |
| Champion banrate         | get_stats_champions            | ✅ Conforme |
| Champion banrate (top 5) | get_stats_overview             | ❌ À corriger |
| Champion winrate         | partout                        | ✅ Conforme |
| Rune pickrate / winrate  | get_stats_overview_detail      | ✅ Conforme |
| Summoner pickrate/winrate| get_stats_overview_detail      | ✅ Conforme |
| Item pickrate / winrate  | get_stats_overview_detail      | ✅ Conforme |

**Action (faite):** la migration `20260214130504_banrate_matches_formula` corrige `get_stats_overview` pour que `topBanrateChampions` utilise la même définition que le reste:  
`banrate_champion(X) = |{ m ∈ M : X est ban dans m }| / |M|`  
avec `ban_count = COUNT(DISTINCT m.id)` (nombre de matchs où le champion est banni).  
Note: le champ `banCount` exposé par l’API représente désormais ce nombre de matchs (et non plus le nombre de slots de ban).

### 5.1 Propagation des formules (où c’est appliqué)

| Source / écran | Données | Formule banrate / pickrate / winrate |
|----------------|---------|--------------------------------------|
| **GET /api/stats/overview** | topBanrateChampions | ✅ `banrate = \|m : X ban\| / \|M\|` (migration 20260214130504) |
| **GET /api/stats/champions** | liste de tous les champions | ✅ `get_stats_champions` : pickrate = games/\|M\|, banrate = matchs où banni/\|M\|, winrate = wins/games |
| **GET /api/stats/champions/:championId** | stats d’un champion (donuts, etc.) | ✅ Même source `get_stats_champions` → même formules |
| **GET /api/stats/overview-teams** | bans byWin / byLoss (équipe gagnante / perdante) | ⚠️ Métrique **volontairement différente** : `count` = nombre de **slots** de ban (une équipe = 5 bans), `banRatePercent` = part de ce champion parmi **tous les bans** de l’équipe gagnante (ou perdante). Ce n’est pas « banrate = matchs où banni / \|M\| ». |
| **GET /api/stats/overview-sides** | bansBySide.blue / .red | Comptage brut par côté (championId → count). Pas de pourcentage côté backend ; pas de formule banrate à propager. |
| **Fallback top 5 banrate** (si overview vide) | teams.bans.top20Total (5 premiers) | ⚠️ On réutilise `banRatePercent` de top20Total = part des bans parmi **tous** les bans (slots). Pas la formule « matchs / \|M\| » (top20Total ne contient pas le détail matchs). |

En résumé : la formule **banrate = \|{ m : X ban dans m }\| / \|M\|** est bien propagée partout où on affiche un « banrate champion » global : overview (top 5), liste champions, détail champion par ID. Les vues « bans par équipe gagnante/perdante » et « bans par côté » utilisent d’autres métriques (répartition des bans, comptages) par conception.

---

## 6. Objectifs (équipes)

**Notation:**  
- `T` = ensemble des équipes (2 × |M|), une ligne par `elem` dans `m.teams`  
- `O` = objectif (dragon, baron, tower, first blood, etc.)  
- `team(m, side)` = équipe blue ou red du match m  

Source: `get_stats_overview_teams(p_version, p_rank_tier)`. Les données viennent de `matches.teams` (une ligne par équipe, avec `win` et `objectives`).

### 6.1 Winrate si objectif pris (≥1 O)

**Formule cible:**  
`winrate_objective(O) = |{ t ∈ T : t a pris ≥1 O AND t.win }| / |{ t ∈ T : t a pris ≥1 O }|`

**Implémentation:**  
On ne pré-agrège pas ce ratio. On expose `distributionByWin` et `distributionByLoss` (nombre d’équipes par nombre de kills). Pour O (ex. baron) :  
- `|{ t : O ≥ 1 AND win }|` = somme des `distributionByWin[k]` pour k ≥ 1  
- `|{ t : O ≥ 1 }|` = même somme côté win + côté loss  
→ Le frontend (ou un client) peut calculer winrate_objective(O). **✅ Données conformes.**

### 6.2 Winrate conditionnel au FIRST objectif

**Formule cible:**  
`winrate_first_O = |{ t : t.first_O = true AND t.win }| / |{ t : t.first_O = true }|`

**Implémentation:**  
Pour chaque objectif (firstBlood, baron, dragon, tower, inhibitor, riftHerald, horde) on retourne `firstByWin` et `firstByLoss` :  
- `firstByWin` = nombre d’équipes qui ont pris le first et ont gagné  
- `firstByLoss` = nombre d’équipes qui ont pris le first et ont perdu  

Donc `winrate_first_O = firstByWin / (firstByWin + firstByLoss)`. **✅ Conforme.**

### 6.3 Winrate par nombre d’objectifs

**Formule cible:**  
`winrate_O(n) = |{ t : t.O = n AND t.win }| / |{ t : t.O = n }|`

**Implémentation:**  
Pour chaque objectif avec “kills” (baron, dragon, tower, inhibitor, riftHerald, horde), on expose :  
- `distributionByWin` : pour chaque clé `n`, nombre d’équipes gagnantes avec exactement `n` kills  
- `distributionByLoss` : idem pour les équipes perdantes  

Donc `winrate_O(n) = distributionByWin[n] / (distributionByWin[n] + distributionByLoss[n])`. **✅ Conforme.**

### 6.4 Winrate si ≥ n objectifs

**Formule cible:**  
`winrate_O_≥n = |{ t : t.O ≥ n AND t.win }| / |{ t : t.O ≥ n }|`

**Implémentation:**  
Dérivable à partir des mêmes distributions (sommer pour k ≥ n). **✅ Données conformes.**

### 6.5 Winrate Baron / First tower / First blood

Même logique : first = firstByWin / (firstByWin + firstByLoss) ; baron ≥ 1 à partir des distributions. **✅ Conforme.**

### 6.6 Non implémenté (données ou logique absentes)

| Formule / concept | Raison |
|-------------------|--------|
| **Dragon Soul** (winrate_soul, winrate_soul_type(X)) | Payload Riot `objectives.dragon` utilisé ici ne contient que `first` et `kills`. Pas de champ soul / soul_type dans la structure actuelle. |
| **Elder** (winrate_elder, winrate_double_elder) | Idem : pas de champ elder dans `objectives.dragon` exposé par notre schéma. |
| **Winrate différentiel** (ex. dragon_diff = team_dragons − enemy_dragons) | Nécessite d’associer les deux équipes du même match (team_id 100 vs 200) pour calculer la diff par équipe. Non calculé actuellement. |
| **Winrate temporel** (O pris avant minute X) | Pas de timestamp `O_time` dans les données stockées (objectives = first + kills uniquement). |

### 6.7 Corrélation P(win \| O) vs P(win \| no O)

**Formule cible:**  
`P(win | O) = wins_with_O / teams_with_O` et `P(win | no O) = wins_without_O / teams_without_O`.

**Implémentation:**  
Pour chaque objectif, à partir des distributions :  
- “with O” (ex. baron ≥ 1) : somme des counts pour k ≥ 1 (win + loss)  
- “without O” (k = 0) : distributionByWin["0"], distributionByLoss["0"]  

→ Les deux probabilités sont calculables côté client. **✅ Données conformes.**

---

## 7. Synthèse objectifs

| Formule / métrique | Source | Statut |
|--------------------|--------|--------|
| Winrate first O (first blood, first dragon, first tower, etc.) | firstByWin / (firstByWin + firstByLoss) | ✅ Conforme |
| Winrate O(n) (par nombre de dragons, tours, etc.) | distributionByWin[n] / (win+loss pour n) | ✅ Conforme |
| Winrate O ≥ n | Dérivable (somme k≥n) | ✅ Données conformes |
| Winrate si objectif pris (≥1) | Dérivable (somme k≥1) | ✅ Données conformes |
| P(win \| O) et P(win \| no O) | Dérivable depuis les distributions | ✅ Données conformes |
| Dragon Soul / Elder | Champs absents du payload utilisé | ⚠️ Non implémenté |
| Winrate différentiel (dragon_diff, etc.) | Nécessite jointure 2 équipes / match | ⚠️ Non implémenté |
| Winrate temporel (O avant minute X) | Pas de O_time stocké | ⚠️ Non implémenté |

**Conclusion objectifs:** Les formules que tu as données sont respectées pour tout ce qui est dérivable à partir de **first** (firstByWin / firstByLoss) et de la **distribution par nombre de kills** (distributionByWin / distributionByLoss). Aucune modification backend nécessaire pour ces cas. Soul, Elder, diff et timing ne sont pas couverts par les données actuelles.
