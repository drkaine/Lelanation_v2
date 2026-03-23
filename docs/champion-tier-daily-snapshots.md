# Snapshots quotidiens champion × tier (tendances)

## Objectif

Table **`champion_tier_daily_snapshots`** : une ligne par `(date_of_game, rank_tier sans division, role, champion)` avec :

- `games` / `wins` — le winrate se déduit : `wins / games`
- `ban_rate_pct` — part des **bans** du **même rank_tier** (jour UTC) pour ce champion (pas un volume « ban » stocké)
- `pick_rate_pct` — part des **picks** du **même rank_tier et rôle** (jour UTC) pour ce champion

Rôles normalisés : **TOP**, **JUNGLE**, **MIDDLE**, **BOTTOM**, **SUPPORT** (la réponse Riot *UTILITY* est agrégée en **SUPPORT**). Tier sans division (`DIAMOND_I` → `DIAMOND` via `split_part(..., '_', 1)`).

## Fenêtre temporelle

- **Jour résumé** : jour calendaire **UTC** précédent.
- **Fenêtre** : `[J 00:00:00 UTC, J+1 00:00:00 UTC)`.
- **Filtrage** : `matchs.game_date` dans cette fenêtre (date/heure de partie côté Riot, alignée sur le calendrier UTC du résumé).

## Planification

Le **riot poller** appelle `tryRunChampionTierDailySnapshot` à chaque tour de boucle (léger si déjà fait).

Variables d’environnement :

| Variable | Défaut | Rôle |
|----------|--------|------|
| `CHAMPION_TIER_SNAPSHOT_UTC_HOUR` | `0` | Heure UTC minimale pour lancer le job ce jour-là |
| `CHAMPION_TIER_SNAPSHOT_UTC_MINUTE` | `5` | Minute UTC (ex. 00:05 = après minuit) |
| `CHAMPION_TIER_SNAPSHOT_DISABLED` | — | Si `1`, aucun snapshot |

La table **`champion_tier_snapshot_runs`** enregistre les jours déjà traités (y compris 0 match), pour ne pas boucler indéfiniment.

## API (graphiques)

`GET /api/stats/champions/:championId/tier-trend-snapshots?rankTier=DIAMOND&from=2026-01-01&to=2026-03-15&limit=365`

Réponse : `{ championId, rankTier, fromDate, toDate, points: [{ dateOfGame, rankTier, role, games, wins, banRatePct, pickRatePct }] }` — winrate = `wins/games` côté client.
