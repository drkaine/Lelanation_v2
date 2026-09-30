# AGENTS.md

## harness-forge

Ce projet utilise **harness-forge**.
Au démarrage de chaque session, lire dans cet ordre :
1. `.harness/AGENTS.md`
2. `.harness/rules/concision.md` — style et format de réponse
3. `.harness/rules/tdd.md`
4. `.harness/rules/project.md` — règles propres au projet
5. `.harness/memory/corrections.md`
6. `.harness/memory/decisions.md`
7. `.harness/memory/state.json`

## Projet

- Plateforme : web
- Monorepo   : true
- Initialisation : existing — voir `.harness/skills/begin.md`

## Stack

- Backend  : Node/Express (TypeScript)
- Frontend : Vue 3/Nuxt 4
- DB       : PostgreSQL

## Commandes

```bash
# Tests
npm run test:precommit -w backend
npm run test -w frontend

# Linter
npm run typecheck -w backend
npm run lint -w frontend && npm run typecheck -w frontend   # vue-tsc -b (tsconfig à références)

# Build
npm run build -w frontend

# Runner
bash .harness/runner/harness.sh          # sprint courant
bash .harness/runner/harness.sh --status # état du harness
bash .harness/runner/harness.sh --cursor # mode Cursor (semi-auto)
```

## Architecture

Trois process PM2 (`ecosystem.config.js`), tous lancés depuis ce dépôt :

| Process | Entrée | Rôle |
|---|---|---|
| `lelanation-backend` | `backend/dist/app/index.js` (bundle de `src/index.ts`, port 3500) | API Express, crons, monitoring |
| `lelanation-poller-v2` | `backend/dist/app/main.js` (bundle de `src/main.ts`) | Ingestion Riot : poll joueurs → matchs → BullMQ → Postgres |
| `lelanation-frontend` | `frontend/` (Nuxt build) | Site + page admin |

Le backend tourne en **JS compilé** (`npm run build -w backend` → esbuild, `dist/app/`) : un changement
n'est actif qu'après `make deploy-backend` (typecheck + tests + build + restart PM2 + `/health`). L'onglet admin Monitoring signale un process périmé.

Backend (`backend/src/`) :
- `riot-gateway/` : client Riot unique (rate limit, file, retries). `poller/`, `poll-orchestration/`, `tuner/` : boucle d'ingestion.
- `queues/`, `workers/`, `redis/` : BullMQ sur Redis. `db/`, `drizzle/` : Postgres `lelanation_statistiques` (docker-compose).
- `services/` : logique métier (stats, tier lists, builds, matchups). `routes/` : endpoints `/api/*`, admin sous `/api/admin` (auth).
- `cron/` : syncs Data Dragon / YouTube / CommunityDragon, disque, liens sociaux, monitoring.
- `logging/` : log unifié `logs/lelanation-unified.log` (une ligne par événement, lu par l'admin). Les erreurs console et pino y sont copiées.
- `monitoring/` : règles d'incidents (ingestion, 429, API 5xx, crons, code périmé), alertes Discord (`DISCORD_WEBHOOK_URL`), récap quotidien à 9 h.

Frontend (`frontend/`) : Nuxt 4, i18n fr/en (`i18n/locales`), Pinia (`stores/`), logique pure testée dans `utils/`.
Admin : `pages/admin/index.vue` = coquille d'onglets ; chaque onglet est un composant `components/Admin/*Tab.vue`.

Tests dans la gate : backend `tests/riot-gateway/unit`, `tests/poller/unit` ; frontend `vitest run` (tout `*.test.ts`).

## Règles spécifiques au projet

Dans `.harness/rules/project.md` (ajout via `.harness/runner/correct.sh --accept`) :
- RULE-001 : backend/poller déployés par `make deploy-backend` (bundle compilé, pas de rechargement auto).
- RULE-002 : test backend sans base ni Redis dans `tests/riot-gateway/unit` ou `tests/poller/unit` (gate).
- RULE-003 : un onglet admin = `components/Admin/<Nom>Tab.vue` ; `pages/admin/index.vue` reste une coquille.

## Règles de session (Claude Code direct, sans runner)

Aucun runner ne contrôle cette session. Ces règles le remplacent.

1. **Format** : réponse = un titre + liste numérotée courte, style homme des
   cavernes. Pas de prose. `détail N M` → développer ces points seulement
   (`.harness/rules/concision.md`).
2. **TDD** : le test d'abord, lancé, vu échouer (RED). Le code ensuite. Pas de
   code sans test — un fichier de code créé sans test fait échouer la gate
   `evidence`.
3. **Avant de conclure**, lancer les gates et rapporter leur résultat :
   `bash .harness/runner/check.sh` — toutes les gates actives, une ligne chacune.
4. **Gate rouge** : le dire, avec la cause. Jamais de test désactivé, de `skip`,
   de seuil ou de commande de gate modifié pour la faire passer.
5. **Test hors gate** : un test que la commande de test configurée ne lance pas
   ne prouve rien pour la gate. Le signaler.
6. **Action destructive** (`git stash -u`, `reset --hard`, suppression,
   migration) : demander avant, même si elle est réversible.
7. **Hors périmètre** d'un rôle : signaler, ne pas contourner
   (`.harness/memory/sessions/schema.md`, `handoff_requests`).
8. **BMAD** : si `_bmad-output/` ou `docs/prd*` existent, ils sont du contexte en
   lecture seule (`bash .harness/runner/bmad.sh`).
9. **Pas de récit** pendant la tâche : aucun commentaire de réflexion entre les
   appels d'outils. Sorties bornées (`head`, `tail`), pas de relecture du connu.
10. **Notes** : `.harness/context/notes.md` — objectif, décisions, fichiers,
    suite, blocages. 30 lignes max, réécrit. Le lire en premier après un reset.

## Codex

Ce fichier est lu par Codex ; il reprend CLAUDE.md. Première réponse de chaque
session : commencer par la ligne `harness-forge actif` (Codex n'a pas de hook
de démarrage, c'est la preuve que le harness est chargé).
