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

### 3.3 Portée de l’EPIC

**Inclus :**

- Utilisation **exclusive** de l’API officielle Riot Games (`RIOT_API_KEY`).
- Collecte automatisée de matchs **classés** (Ranked Solo/Duo).
- Stockage structuré des données (backend Lelanation).
- Calcul d’agrégations : winrate, pickrate, objets, builds, runes, par elo/patch/rôle.
- API interne pour exposer les stats.
- Frontend de consultation des statistiques (pages dédiées dans le site Lelanation).

**Hors scope initial :**

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
  - Workers / jobs asynchrones pour la collecte (cron ou file + worker).
  - Client HTTP dédié pour les appels Riot (rate limit, retry, backoff).
  - Stockage : selon choix projet (PostgreSQL, ou fichier/JSON comme le reste de Lelanation) — à trancher en design détaillé.
  - Cache (ex. Redis) recommandé : cache des réponses API, file d’attente, respect des rate limits.

### 6.2 Base de données / stockage

- Idéal : **PostgreSQL** pour matches + participants + tables d’agrégats (intégrité, requêtes analytiques).
- Option scaling : **ClickHouse** ou autre pour stats massives (hors MVP si besoin).
- **Redis** : cache API, file de requêtes, compteurs de rate limit.

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
           ▼
  API statistiques (backend)
           │
           ▼
  Frontend (Nuxt)
```

---

## 8. Modèle de données (simplifié)

Tables (ou équivalent) principales :

- **matches** — id, région, patch, durée, game_creation, etc.
- **participants** — match_id, puuid, champion_id, win, role, lane, items[] (finaux), runes, summoner_spells, rank_tier, etc.
- **champions_stats** — agrégats par champion (et optionnellement patch, elo, rôle).
- **items_stats** — agrégats par champion + item (pickrate, winrate).
- **runes_stats** — agrégats par page / runes.
- **patches** — référence des patchs utilisés.
- **elos** — référence des tranches d’elo.

Les détails de schéma SQL (ou schéma fichier) sont à produire en story/tech spec.

---

## 9. Statistiques à produire (MVP)

Cibles “type Porofessor / League of Graphs” :

### Champion

- Winrate global (et par patch, par elo, par rôle).
- Pickrate.
- Banrate (si disponible via les données Riot).
- Winrate par rôle, par elo.

### Builds (objets)

- Build le plus joué (ensemble d’items finaux) par champion.
- Build au meilleur winrate (avec seuil de parties).
- Pickrate d’un build donné.
- Objets les plus utilisés par champion (et optionnellement par rôle/elo).

### Runes

- Page la plus jouée par champion.
- Page (ou setup) au meilleur winrate.
- Sorts d’invocateur les plus pris (optionnel MVP).

---

## 10. Collecte et mise à jour

### Stratégie

- Cibler des joueurs **classés** (ex. Master / GM / Challenger en priorité pour qualité des données).
- Par région : **EUW**, **EUNE**.
- Récupérer les match IDs puis les détails ; **dédupliquer par matchId** pour ne pas retraiter un même match.
- Respect strict des **rate limits** Riot (file d’attente, retry avec backoff).

### Fréquence

- Collecte : **continue** ou par cron (ex. toutes les X minutes/heures).
- Recalcul des agrégats : **périodique** (ex. toutes les heures en MVP, ou à la fin d’un patch).

---

## 11. Contraintes critiques

- **Rate limit Riot :** quotas stricts ; file d’attente + retry + backoff obligatoires.
- **Légal / CGU Riot :** respect des conditions d’utilisation ; pas d’exposition de données brutes de match à des fins non conformes.
- **Données exposées :** uniquement **agrégats** (winrate, pickrate, builds populaires, etc.), pas de logs de match bruts aux utilisateurs finaux.

---

## 12. Stratégie MVP (phases)

### Phase 1 (MVP)

- **1 région** : EUW (ou EUW + EUNE si capacité dispo).
- **Ranked Solo/Duo** uniquement.
- **1 patch** courant (ou patchs récents).
- Stats **champion** basiques : winrate, pickrate, par rôle.
- Clé API : **`RIOT_API_KEY`** dans **`backend/.env`** uniquement.

### Phase 2

- Multi-elos, builds (objets) + runes.
- Filtres avancés (patch, elo, rôle).

### Phase 3

- Matchups, synergies, comparaison patch à patch (si pertinent).

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

## 15. Résumé exécutif

Cette EPIC décrit l’ajout d’une **plateforme de statistiques LoL** dans Lelanation v2 :

- **Source :** API officielle Riot uniquement, avec **`RIOT_API_KEY`** dans **`backend/.env`**.
- **Périmètre géographique :** Europe (EUW, EUNE).
- **Livrables :** collecte massive de matchs, stockage structuré, calcul d’agrégations (winrate, pickrate, objets, builds, runes), API + frontend type **Porofessor / League of Graphs**.

La valeur est dans le **pipeline de collecte**, le **volume de données** et les **agrégations**, pas dans l’API Riot seule.

---

*Document prêt pour découpage en user stories et spécification technique détaillée (schéma SQL, pseudo-code worker, contrats API).*
