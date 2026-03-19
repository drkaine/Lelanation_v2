# Snapshots quotidiens champion × tier (tendances)

## Objectif

Table **`champion_tier_daily_snapshots`** : une ligne par `(jour UTC résumé, rank_tier sans division, champion)` avec :

- `games` / `wins` / `win_rate_pct`
- `bans` (dans la partie, tier du **match** = lobby)
- `pick_rate_pct` = part des picks du champion dans le tier sur le **total de slots** (10 joueurs / partie) du même tier sur la fenêtre

Pas de split par rôle ni par division (`DIAMOND_I` → `DIAMOND` via `split_part(..., '_', 1)`).

## Fenêtre temporelle

- **Jour résumé** : jour calendaire **UTC** précédent.
- **Fenêtre** : `[J 00:00:00 UTC, J+1 00:00:00 UTC)`.
- **Filtrage** : `matchs.ingested_at` dans cette fenêtre (moment où le match a été inséré en base par le poller).

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

Réponse : `{ championId, rankTier, fromDate, toDate, points: [{ snapshotForDate, rankTier, games, wins, bans, pickRatePct, winRatePct }] }`.
