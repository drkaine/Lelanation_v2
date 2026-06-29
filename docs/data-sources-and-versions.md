# Sources de données et versions

## Community Dragon

Community Dragon sert à deux usages distincts dans le projet.

### Theorycraft (données champions)

**Community Dragon** fournit les définitions de sorts (coefficients, effectAmounts, cooldown/cost/range par rang) selon la locale.

**Source** : API v1 Riot game data :  
`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/{locale}/v1/champions/{id}.json`

Le flux theorycraft :

1. **Data Dragon sync** : `DataDragonService` télécharge `championFull.json` (stats, images, structure).
2. **Build theorycraft** : `TheorycraftDataBuilderService.build()` fusionne DDragon + CD (API + bins) et écrit `frontend/public/data/game/{version}/{lang}/champions/{id}.json` (ex. `kalista.json`).
3. **Utilisation frontend** : le theorycraft charge ces fichiers par champion ; pas de JSON CD à la racine de `community-dragon/`.

Le cache CD intermédiaire est dans `backend/data/theorycraft-cache/` (pas versionné).

### Assets statiques (images)

`CommunityDragonService` est synchronisé **uniquement lors d'un changement de version** (via `dataDragonSync`) ou manuellement (admin / script `syncData`). Pas de cron quotidien. Assets synchronisés :

- `frontend/public/data/community-dragon/ranked-emblem/` — emblèmes de rang
- `frontend/public/data/community-dragon/scoreboard-objectives/` — icônes objectifs
- `frontend/public/data/community-dragon/map-planner/` — assets carte tactique

`StaticAssetsService.copyCommunityDragonDataToFrontend()` copie ces sous-dossiers depuis le backend si besoin, et supprime les éventuels JSON champions legacy à la racine.

### Nettoyage des payloads Data Dragon

Pendant le sync DDragon :
- `championFull.json` est réduit aux champs utiles (`id/key/name/title/image/tags/partype/stats/spells/passive`).
- `runesReforged.json` supprime `shortDesc` sur chaque rune.
- `summoner.json` supprime `description` sur chaque sort.
- `item.json` supprime `maps` après filtrage backend.

---

## Shared-builds (désactivé)

Le partage de build par lien (**shared-builds**) n’est plus utilisé : les builds ne sont plus enregistrés côté serveur. La page `/builds/shared/:id` affiche un message indiquant que le partage par lien n’est plus disponible et propose un lien vers la liste des builds.

---

## versions.json – Récap des versions et dates

**Fichier** : `backend/data/game/versions.json` (copié vers `frontend/public/data/game/versions.json` lors du sync des assets).

**Rôle** : garder un **récap des versions de jeu** avec les **dates de mise en place** (release). Utilisé pour :

- **Collecte de matchs** : filtrer ou qualifier les matchs par patch (ex. `RIOT_MATCH_PATCH_PREFIX` ou logique basée sur `gameVersion` et les plages de dates).
- **Archivage** : savoir à quel patch appartient une période.
- **Stats par patch** : les endpoints stats (`/api/stats/champions/:id/builds`, runes, etc.) acceptent déjà `?patch=16.2` ; `versions.json` permet de lister les patches valides et leurs dates.

**Structure** (exemple) :

```json
{
  "updatedAt": "2026-02-03T00:00:00.000Z",
  "description": "Recap of game versions with release dates...",
  "versions": [
    { "version": "16.2.1", "releaseDate": "2026-01-22", "patchLabel": "16.2" },
    { "version": "16.1.1", "releaseDate": "2026-01-08", "patchLabel": "16.1" }
  ]
}
```

- **version** : chaîne complète (ex. 16.2.1).
- **releaseDate** : date de mise en place du patch (ISO date).
- **patchLabel** : libellé court pour affichage / filtre (ex. 16.2).

**API** : `GET /api/game-data/versions` renvoie le contenu de ce fichier.

**Maintenance** : mettre à jour les entrées (et `updatedAt`) à chaque nouveau patch, à la main ou via un script, en s’appuyant sur le calendrier des patches Riot.
