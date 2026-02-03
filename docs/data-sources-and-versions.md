# Sources de données et versions

## Community Dragon

**Community Dragon** fournit les définitions de sorts des champions (theorycraft). Le flux :

1. **Sync côté backend** : le cron `communityDragonSync` et le script `syncData` appellent `CommunityDragonService.syncAllChampions()`, qui télécharge les JSON par champion et les enregistre dans `backend/data/community-dragon/`.
2. **Copie puis suppression** : `StaticAssetsService.copyCommunityDragonDataToFrontend()` copie ces fichiers vers `frontend/public/data/community-dragon/`, puis **supprime les fichiers du backend** pour ne pas dupliquer les données.
3. **Utilisation** : le frontend charge les sorts via `/data/community-dragon/{ChampionName}.json`.

Le backend ne conserve pas de copie après la copie vers le frontend.

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
