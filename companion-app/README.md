# Lelanation Companion

Application Windows (Tauri 2 + Vue 3) pour importer les builds du site dans le client LoL et envoyer les matchs au backend.

## Fonctionnalités MVP

- **Consentement RGPD** : écran au premier lancement (envoi match ID + région).
- **Liste des builds** : chargée depuis l’API Lelanation (`GET /api/builds`).
- **Favoris** : stockage local uniquement (même clé que le web).
- **Paramètres** : options d’import (runes, items, sorts d’invocateur).
- **Envoi du dernier match** : récupération via LCU puis `POST /api/app/match`.
- **LCU** : lecture du lockfile et requêtes authentifiées (Rust).

## Prérequis

- Node.js et npm
- Rust (1.87+ peut être requis selon les dépendances ; sur Windows le build est prioritaire)
- Windows : pour build et exécution. Linux/macOS : possible avec les deps système (webkit2gtk, etc.).

## Configuration

- `VITE_API_BASE` : URL de l’API (défaut : `https://www.lelanation.fr`). À définir dans `.env` ou en build.

## Commandes

```bash
npm install
npm run tauri dev    # Développement
npm run tauri build  # Build (Windows : .msi/.exe dans src-tauri/target/release/bundle/)
```

## Déclencher la CI installer (tag de version)

La workflow GitHub installer Windows se déclenche sur :

- tags `v*` (ex: `v1.3.0`)
- tags `companion-v*` (ex: `companion-v1.3.0`)

Exemple pour taguer le commit courant et déclencher la CI :

```bash
git add .
git commit -m "release: companion 1.3.0"
git tag -a companion-v1.3.0 -m "Companion installer 1.3.0"
git push origin main --tags
```

Si tu veux taguer un commit précis (pas forcément le HEAD) :

```bash
git tag -a companion-v1.3.0 <sha_du_commit> -m "Companion installer 1.3.0"
git push origin companion-v1.3.0
```

## Structure

- `src/` : frontend Vue (consent, builds, favoris, paramètres, envoi match).
- `src-tauri/src/` : Rust (lockfile, client LCU HTTPS).
- `src-tauri/src/lcu.rs` : lecture lockfile, `lcu_request` (GET/POST vers le client LoL).

## Import build (runes/items/sorts)

Le bouton « Importer » est branché sur la détection LCU ; l’envoi effectif des runes/items/sorts au client LoL nécessite de construire les payloads LCU (format Riot) à partir du build et d’appeler les endpoints appropriés (`/lol-perks/v1/pages`, item sets, etc.). À compléter selon la doc LCU.
