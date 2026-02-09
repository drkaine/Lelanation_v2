# Sources de données et versions

## Community Dragon

**Community Dragon** fournit les définitions de sorts des champions (theorycraft), avec les **bonnes valeurs** (coefficients, effectAmounts, cooldown/cost par rang) et les **textes localisés** (noms, descriptions, sorts) selon la locale.

**Source** : API v1 Riot game data, par **locale** (default = en_US sur CD, on utilise `fr_fr` pour le français) :  
`https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/{locale}/v1/champions/{id}.json`  
Ex. `global/fr_fr/v1/champions/1.json` = Annie en français, `global/default/v1/champions/1.json` = Annie en anglais.  
Locales disponibles : `default`, `fr_fr`, `de_de`, `es_es`, `it_it`, `pt_br`, `ja_jp`, `ko_kr`, `zh_cn`, etc.

**Locale** : par défaut le sync utilise `fr_fr`. Pour une autre langue, définir la variable d’environnement `COMMUNITY_DRAGON_LOCALE` (ex. `COMMUNITY_DRAGON_LOCALE=en_gb`).

Le flux :

1. **Sync côté backend** : le cron `communityDragonSync` et le script `syncData` appellent `CommunityDragonService.syncAllChampions()`, qui télécharge les JSON v1 par **clé numérique** (depuis championFull.json) pour la locale configurée, et les enregistre dans `backend/data/community-dragon/` (ex. `266.json`).
2. **Fusion** : `ChampionMergeService.mergeChampionFull()` fusionne DDragon (stats, images, structure) et CD (noms, descriptions, sorts) dans un seul `championFull.json` (par langue).
3. **Copie puis suppression** : `StaticAssetsService.copyCommunityDragonDataToFrontend()` copie les JSON CD vers `frontend/public/data/community-dragon/`, puis supprime les fichiers du backend. Les championFull fusionnés sont déjà dans le répertoire game (DDragon) et sont copiés avec le reste des assets.
4. **Utilisation** : le frontend charge la liste champions via championFull fusionné ; les sorts détaillés (theorycraft) via `/data/community-dragon/{championKey}.json`. Le parser détecte le format v1 (tableau `spells` à la racine) et en déduit coefficients, dégâts de base par rang, cooldown et coût.

Le backend ne conserve pas de copie après la copie vers le frontend.

### Fusion CD + Data Dragon (une seule source)

Après le sync CD, une fusion (ChampionMergeService) combine DDragon (stats de base, images, structure) et CD (noms/titres/descriptions, sorts avec coefficients/coûts/cooldowns) dans un seul championFull.json (ex. fr_FR). Une seule source côté affichage ; champion.json n'est plus produit. L'API sert championFull même si on demande champions sans full=true (fallback).

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
