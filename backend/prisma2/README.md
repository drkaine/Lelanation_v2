# Prisma2 — Base de données « lelanation »

Ce schéma Prisma cible une **base PostgreSQL distincte** nommée `lelanation`. Il ne remplace pas le schéma existant dans `../prisma/` (ni la base actuelle utilisée par l’app).

## Prérequis

1. **Créer la base** (même serveur ou autre) :

   ```bash
   createdb lelanation
   # ou en SQL : CREATE DATABASE lelanation;
   ```

2. **Définir l’URL de connexion** : ajouter dans `backend/.env` (le fichier est chargé par `prisma.config.ts` via `dotenv/config`) :

   ```bash
   DATABASE_URL_LELANATION="postgresql://USER:PASSWORD@HOST:PORT/lelanation"
   ```

   Exemple si la base est sur le même host que l’existant (port 5433 si Docker) :

   ```bash
   DATABASE_URL_LELANATION="postgresql://lelanation:lelanation@localhost:5433/lelanation"
   ```

   Une entrée commentée est dans `backend/.env.example` ; sans cette variable, `npm run prisma2:migrate` échoue avec « Environment variable not found: DATABASE_URL_LELANATION ».

**Note** : Si `prisma2:generate` échoue avec une erreur de résolution de `@prisma/client`, exécuter `npm install` dans `backend/` puis réessayer.

## Commandes (depuis `backend/`)

- **Générer le client** (écrit dans `backend/src/generated/prisma2`) :

  ```bash
  npm run prisma2:generate
  ```

- **Créer / appliquer les migrations** :

  ```bash
  npm run prisma2:migrate
  ```

  À la première exécution, donner un nom à la migration (ex. `init`).

## Contenu du schéma

- **Tables brutes** : `players`, `matchs`, `teams`, `bans`, `drake_details`, `match_players`, `match_player_core`, `match_player_visions`, `match_player_matchup`, `match_player_objectives`, `match_player_combats`, `match_player_challenges`, `match_player_items`, `match_player_runes`, `match_player_summoner_spells`, `match_player_shards`, `match_player_spell_orders`, `match_player_bucket`.
- **Tables d’agrégats** : `champion_core_stats`, `champion_vs_stats`, `team_core_stats`, et les tables satellites (champion_first_objectif_stats, champion_objectif_stats, champion_vision_stats, champion_combat_stats, champion_matchup_stats, champion_challenge_stats, champion_shard_solo_stats, champion_runes_solo_stats, champion_shard_stats, champion_runes_stats, champion_item_solo_stats, champion_item_stats, champion_spell_solo_stats, champion_summoner_spells, champion_bucket).

Les tables d’agrégats sont alimentées par des jobs / fonctions d’ingestion (hors API). Les vues matérialisées et fonctions SQL du plan technique peuvent être ajoutées via des migrations SQL brutes si besoin.
