# Lelanation Companion

Application Windows (Tauri 2 + Vue 3) pour importer les builds du site dans le client LoL et envoyer les matchs au backend.

## Fonctionnalités MVP

- **Consentement RGPD** : écran au premier lancement (envoi match ID + région).
- **Liste des builds** : chargée depuis l’API Lelanation (`GET /api/builds`).
- **Favoris** : stockage local uniquement (même clé que le web).
- **Paramètres** : options d’import (runes, items, sorts d’invocateur).
- **Envoi du dernier match** : récupération via LCU puis `POST /api/app/match`.
- **LCU** : lecture du lockfile (chemins multiples + process Windows/macOS) et requêtes authentifiées (Rust). Match history : `/lol-match-history/v1/games` ou fallback `/lol-match-history/v1/products/lol/{puuid}/matches`.

## Prérequis

- Node.js et npm
- Rust (1.87+ peut être requis selon les dépendances ; sur Windows le build est prioritaire)
- Windows : pour build et exécution. Linux/macOS : possible avec les deps système (webkit2gtk, etc.).

## Configuration

- `VITE_API_BASE` : URL de l’API (défaut : `https://www.lelanation.fr`). À définir dans `.env` ou en build.
- `LELANATION_LCU_LOCKFILE` : chemin manuel du lockfile LCU si l'app ne le trouve pas (ex. installation personnalisée, GOG, Steam). Ex. Windows : `C:\Games\LoL\lockfile` ; macOS : `~/Library/Application Support/Riot Games/League of Legends/Config/lockfile`.

## Commandes

```bash
npm install
npm run tauri dev    # Développement
npm run tauri build  # Build (Windows : .msi/.exe dans src-tauri/target/release/bundle/)
```

## Version (une seule source de vérité)

La version est pilotée par **`companion-app/package.json`**. Le script `scripts/sync-version.mjs` propage vers `tauri.conf.json` et `Cargo.toml`.

### Release + tag CI (`companion-v*`)

**Recommandé** — une commande aligne les 3 fichiers, commit le bump, crée le tag annoté (déclenche la CI Windows) :

```bash
# Depuis la racine du monorepo
make companion-tag VERSION=1.0.0 MSG="Companion installer 1.0.0"
git push origin HEAD
git push origin companion-v1.0.0
```

Équivalent npm :

```bash
cd companion-app
npm run release:tag -- 1.0.0 -m "Companion installer 1.0.0"
```

Aperçu sans git : `npm run release:tag -- 1.0.0 --dry-run`

### Bump local sans tag (dev)

```bash
cd companion-app
npm version 0.12.0          # postversion → sync-version.mjs
# ou
npm run version:sync -- 1.0.0
```

Sans commit/tag npm : `npm version 0.12.0 --no-git-tag-version`

> Évite `git tag companion-v…` à la main sans passer par `release:tag` / `make companion-tag` : les fichiers locaux resteraient désynchronisés (ex. `package.json` 0.28 vs `tauri.conf.json` 1.0). La CI réinjecte la version au build, mais le dépôt doit rester cohérent.

## « Éditeur inconnu » sous Windows

À l’installation, Windows peut afficher **« Éditeur inconnu »** au lieu de **« Darkaine »**. Ce n’est pas un souci de configuration : le champ `publisher: "Darkaine"` dans `tauri.conf.json` est déjà correct. Windows affiche l’éditeur à partir du **certificat de signature de code** de l’exécutable. Sans signature, il affiche toujours « Éditeur inconnu ».

Pour que « Darkaine » s’affiche :

1. Obtenir un **certificat de signature de code** (OV) auprès d’une autorité reconnue par Microsoft, au nom de Darkaine (ou de ton entité).
2. Configurer la signature dans Tauri et builder avec ce certificat.

Voir le guide détaillé : [CODE_SIGNING_WINDOWS.md](./CODE_SIGNING_WINDOWS.md).

## Déclencher la CI installer (tag de version)

La workflow GitHub installer Windows se déclenche sur :

- tags `v*` (ex: `v1.3.0`)
- tags `companion-v*` (ex: `companion-v1.3.0`)

Exemple (préféré) :

```bash
make companion-tag VERSION=1.3.0 MSG="Companion installer 1.3.0"
git push origin HEAD
git push origin companion-v1.3.0
```

### Secrets GitHub pour la CI

Pour que la workflow génère **`latest.json`** et que l’auto-update in-app fonctionne, il faut configurer le secret **`TAURI_SIGNING_PRIVATE_KEY`** :

1. La clé privée Tauri (minisign) correspond à la `pubkey` dans `tauri.conf.json`. Elle se trouve en local dans `~/.tauri/lelanation.key` (ou là où tu l’as générée avec `npx tauri signer generate -w ~/.tauri/lelanation.key`).
2. Dans GitHub : **Settings → Secrets and variables → Actions → New repository secret**.
3. Nom : `TAURI_SIGNING_PRIVATE_KEY`. Valeur : le **contenu complet** du fichier de clé privée (les deux lignes).
4. Si la clé a un mot de passe, ajoute aussi le secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` ; sinon laisser vide.

Sans ce secret, la CI ne peut pas générer `latest.json` et l’auto-update in-app ne fonctionnera pas.

Avec `createUpdaterArtifacts: true` (Tauri v2), les artefacts updater sont `*-setup.exe` + `*-setup.exe.sig` (pas `.nsis.zip`). La CI régénère la signature minisign après la signature Authenticode Windows.

Pour la **signature de code Windows** (éditeur « Darkaine »), voir [CODE_SIGNING_WINDOWS.md](./CODE_SIGNING_WINDOWS.md) ; en CI il faut aussi les secrets `WINDOWS_CODESIGN_PFX_B64` et `WINDOWS_CODESIGN_PASSWORD`.

## Structure

- `src/` : frontend Vue (consent, builds, favoris, paramètres, envoi match).
- `src-tauri/src/` : Rust (lockfile, client LCU HTTPS).
- `src-tauri/src/lcu.rs` : lecture lockfile, `lcu_request` (GET/POST vers le client LoL).

## Import build (runes/items/sorts)

- **Runes + fragments** : mise à jour LCU via `lol-perks/v1/pages` (`GET` page courante, `PUT` ou `DELETE`+`POST`).
- **Objets** : fichier JSON Riot dans `Config/Champions/<ChampionId>/Recommended/lelanation_*.json` (chemin install LoL depuis l’onboarding).
- **Sorts** : `PATCH` sur `lol-champ-select/.../my-selection` en sélection de champion (si les IDs sorts du build sont numériques).

UI : bouton sur la fiche détail + icône sur chaque carte ; cases à cocher dans **Paramètres**.
