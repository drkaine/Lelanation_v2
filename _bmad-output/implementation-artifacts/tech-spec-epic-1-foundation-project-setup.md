---
title: 'Epic 1: Foundation & Project Setup'
slug: 'epic-1-foundation-project-setup'
created: '2026-01-14T16:30:00+00:00'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Nuxt 3 (latest)', 'TypeScript 5.6.3+', 'Express.js 4.21.1', 'Tailwind CSS', 'ESLint', 'Prettier', 'Husky', 'lint-staged', 'GitHub Actions', 'Node.js 18+']
files_to_modify: []
files_to_create: ['frontend/', 'backend/', 'frontend/nuxt.config.ts', 'frontend/tsconfig.json', 'frontend/.eslintrc.cjs', 'frontend/.prettierrc', 'frontend/tailwind.config.ts', 'frontend/assets/css/tokens.css', 'frontend/assets/css/main.css', 'backend/tsconfig.json', 'backend/package.json', 'backend/src/index.ts', '.husky/pre-commit', '.github/workflows/ci.yml', '.gitignore', 'package.json']
code_patterns: ['TypeScript strict mode', 'Result<T, E> pattern (backend)', 'Named exports', 'Composition API only (Nuxt)', 'File-based routing (Nuxt)', 'Auto-imports (Nuxt)', 'PascalCase components', 'PascalCase services/stores']
test_patterns: ['Vitest (frontend)', 'Jest (backend)', 'Co-located unit tests', 'Separate E2E tests']
---

# Tech-Spec: Epic 1: Foundation & Project Setup

**Created:** 2026-01-14T16:30:00+00:00

## Overview

### Problem Statement

Le projet Lelanation_v2 nécessite une fondation technique solide pour démarrer le développement. Il s'agit d'un nouveau projet (pas de code existant) qui doit être initialisé avec Nuxt 3 pour la migration SPA → MPA, avec une séparation claire frontend/backend, des outils de qualité de code (TypeScript, ESLint, Prettier), un système de design avec Tailwind CSS et des design tokens League of Legends, et un pipeline CI/CD GitHub Actions.

### Solution

Initialiser le projet Nuxt 3 dans `frontend/`, créer la structure backend séparée dans `backend/`, configurer TypeScript strict pour frontend et backend, installer et configurer ESLint et Prettier avec règles Nuxt, intégrer Tailwind CSS avec design tokens LoL dans un fichier CSS, configurer Husky + lint-staged pour pre-commit hooks, et créer le pipeline CI/CD GitHub Actions pour validation du code.

### Scope

**In Scope:**
- Initialisation Nuxt 3 (latest) dans `frontend/` avec configuration SSR/SSG/MPA
- Installation et configuration TypeScript strict pour frontend (Nuxt) et backend (Express)
- Configuration ESLint avec règles Nuxt 3 et Prettier
- Installation et configuration Tailwind CSS avec design tokens League of Legends (fichier CSS)
- Structure de projet avec séparation frontend/backend
- Configuration Husky + lint-staged pour pre-commit hooks
- Pipeline CI/CD GitHub Actions (CI seulement : type checking, lint, format, build)

**Out of Scope:**
- Déploiement automatique (workflow de déploiement préparé mais non configuré)
- Configuration des stores Pinia (sera dans Epic 3)
- Configuration des pages/composants (sera dans Epic 3+)
- Configuration backend Express complète (sera dans Epic 2+)
- Tests unitaires/E2E (sera dans les épics suivants)

## Context for Development

### Codebase Patterns

**TypeScript Configuration:**
- Strict mode enabled pour frontend et backend (tsconfig.json strict: true)
- No `any` types - utiliser `unknown` avec type guards si nécessaire
- Explicit return types pour fonctions publiques (surtout APIs)
- Result<T, E> pattern pour error handling (backend uniquement, pas frontend)
- Type-only imports: `import type { ... }` pour types uniquement

**Import/Export Patterns:**
- Named exports preferred (meilleur tree-shaking, pas de default exports)
- Barrel exports via `index.ts` pour répertoires (clean imports)
- Import organization: external → internal → types → relative

**Nuxt 3 Patterns:**
- Composition API only (`<script setup>` syntax, pas Options API)
- File-based routing via `pages/` directory (automatic routing)
- Auto-imports pour composants (`components/`), composables (`composables/`), stores (`stores/`), utils (`utils/`)
- SSR/SSG/MPA configuré dans `nuxt.config.ts` (rendering mode)
- Direct mutation in Pinia stores (Pinia handles reactivity)

**Naming Conventions:**
- Components: PascalCase (`UserCard.vue`, pas `user-card.vue`)
- Services: PascalCase (`BuildService.ts`)
- Stores: PascalCase with "Store" suffix (`ChampionsStore.ts`)
- Files: PascalCase pour code, camelCase pour utils

**Project Structure:**
- `frontend/` : Application Nuxt 3 (root du projet Nuxt)
- `backend/` : API Express.js séparée (structure indépendante)
- Design tokens dans `frontend/assets/css/tokens.css`
- Pages organisées par domaine: `frontend/pages/{domain}/index.vue`
- Components partagés: `frontend/components/` (auto-importés)
- Stores: `frontend/stores/` (auto-importés)
- Utils: `frontend/utils/` (auto-importés)

**ESLint/Prettier Patterns:**
- ESLint avec règles Nuxt 3 (@nuxtjs/eslint-config)
- Prettier configuré pour formatage cohérent
- Pre-commit hooks (Husky + lint-staged) pour validation automatique
- Pas d'overrides sans discussion

**CI/CD Patterns:**
- GitHub Actions workflow pour CI
- Jobs séquentiels: type check → lint → format → build
- Build doit réussir pour merge
- Pas de déploiement automatique (préparé mais non configuré)

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `_bmad-output/planning-artifacts/architecture.md` | Décisions architecturales, structure projet, patterns, file-based routing |
| `_bmad-output/planning-artifacts/epics.md` | Stories Epic 1 avec acceptance criteria détaillées |
| `_bmad-output/planning-artifacts/ux-design-specification.md` | Design tokens LoL (couleurs exactes, spacing 8px) |
| `_bmad-output/project-context.md` | Règles de code critiques, patterns, conventions, anti-patterns |
| `docs/technology-stack.md` | Versions exactes des dépendances (si disponible) |

### Investigation Results

**Clean Slate Confirmed:**
- Aucun code existant dans le projet
- Pas de migration depuis code legacy
- Structure complète à créer depuis zéro

**Target Directories Identified:**
- `frontend/` : Application Nuxt 3 (à créer)
- `backend/` : API Express.js (à créer)
- `.husky/` : Git hooks (à créer)
- `.github/workflows/` : CI/CD workflows (à créer)

**Key Patterns from project-context.md:**
- TypeScript strict mode (no `any`, explicit return types)
- Result<T, E> pattern pour error handling (backend uniquement)
- Named exports preferred (pas de default exports)
- Composition API only (`<script setup>`)
- PascalCase pour composants/services/stores
- File-based routing Nuxt (`pages/` directory)
- Auto-imports Nuxt (composants, composables, stores, utils)
- ESLint + Prettier configurés avec règles Nuxt
- Husky + lint-staged pour pre-commit validation

### Technical Decisions

**1. Structure Projet:**
- Frontend Nuxt 3 dans `frontend/` (pas à la racine)
- Backend Express séparé dans `backend/` (pas dans Nuxt server/api/)
- Séparation claire pour maintenir l'indépendance des deux parties

**2. Versions:**
- Nuxt 3 latest (pas de version fixe, utiliser `npx nuxi@latest`)
- TypeScript 5.6.3+ (strict mode)
- Node.js 18+ requis (Helmet v8 requirement)

**3. Design Tokens:**
- Fichier CSS unique: `frontend/assets/css/tokens.css`
- Variables CSS pour couleurs LoL (`--color-blue-*`, `--color-gold-*`, `--color-grey-*`)
- Intégration dans Tailwind config pour utilisation via classes
- Spacing system basé sur 8px

**4. Pre-commit Hooks:**
- Husky pour gestion des git hooks
- lint-staged pour exécuter ESLint et Prettier uniquement sur fichiers modifiés
- Validation avant commit (TypeScript, ESLint, Prettier)

**5. CI/CD:**
- GitHub Actions workflow pour CI seulement
- Jobs: type checking, ESLint, Prettier, build Nuxt
- Pas de déploiement automatique pour le moment (workflow préparé)

## Implementation Plan

### Tasks

#### Story 1.1: Initialize Nuxt 3 Project

- [ ] Task 1.1.1: Initialize Nuxt 3 project in frontend directory
  - Command: `npx nuxi@latest init frontend`
  - Action: Run command from project root to create Nuxt 3 project in `frontend/` directory
  - Notes: This will create the base Nuxt 3 structure with TypeScript enabled by default. If command fails (network, permissions), verify Node.js 18+ is installed and try again with `--force` flag if needed.

- [ ] Task 1.1.2: Configure nuxt.config.ts for SSR/SSG/MPA mode
  - File: `frontend/nuxt.config.ts`
  - Action: Configure `ssr: true` (SSR enabled by default in Nuxt 3 for MPA). For MPA with multiple entry points, ensure file-based routing is properly configured via `pages/` directory. No additional `nitro.preset` needed - Nuxt 3 handles MPA routing automatically through file-based routing.
  - Notes: Nuxt 3 supports SSR by default which enables MPA. The `pages/` directory structure automatically creates routes. Verify `ssr: true` is set (or omitted, as it's the default).

- [ ] Task 1.1.3: Verify TypeScript is enabled
  - File: `frontend/tsconfig.json` (auto-generated)
  - Action: Verify `tsconfig.json` exists and has proper Nuxt 3 TypeScript configuration
  - Notes: Nuxt 3 includes TypeScript support by default. Verify strict mode will be enabled in Task 1.2.

- [ ] Task 1.1.4: Install dependencies and test project initialization
  - Command: `cd frontend && npm install && npm run dev`
  - Action: Install npm dependencies first, then verify the project starts successfully and displays default Nuxt welcome page
  - Notes: This confirms the base setup is working before proceeding to configuration. Ensure `node_modules/` is created and all dependencies are installed.

#### Story 1.2: Configure TypeScript, ESLint, and Prettier

- [ ] Task 1.2.1: Configure TypeScript strict mode for frontend
  - File: `frontend/tsconfig.json`
  - Action: Add/update `compilerOptions` with `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, and other strict options
  - Notes: Follow project-context.md rules: no `any` types, explicit return types for public APIs

- [ ] Task 1.2.2: Install and configure ESLint with Nuxt 3 rules
  - Files: `frontend/.eslintrc.cjs`, `frontend/package.json`
  - Action: Install `@nuxtjs/eslint-config-typescript`, `eslint`, and `eslint-config-prettier` (to disable ESLint rules that conflict with Prettier). Create `.eslintrc.cjs` (CommonJS format, not JSON) with Nuxt 3 configuration.
  - Notes: Use `.eslintrc.cjs` format (not `.eslintrc.json`) for better compatibility. Configure `extends: ['@nuxtjs/eslint-config-typescript', 'prettier']` to include Nuxt recommended rules and disable conflicting Prettier rules. Add `prettier` last in extends array.

- [ ] Task 1.2.3: Install and configure Prettier
  - Files: `frontend/.prettierrc`, `frontend/package.json`
  - Action: Install `prettier` and `prettier-plugin-tailwindcss` (for Tailwind class sorting), create `.prettierrc` with project standards
  - Notes: Configure Prettier to work with ESLint (install `eslint-config-prettier` to avoid conflicts)

- [ ] Task 1.2.4: Create backend TypeScript configuration
  - File: `backend/tsconfig.json`
  - Action: Create `backend/` directory and `tsconfig.json` with strict mode enabled, targeting Node.js 18+
  - Notes: Backend TypeScript config should target ES2022 or higher, module: "commonjs" or "ESNext" depending on Express setup

- [ ] Task 1.2.5: Initialize backend package.json (structure only)
  - File: `backend/package.json`
  - Action: Create minimal `package.json` with basic structure: name, version, type: "module" or "commonjs", and placeholder for future dependencies. Do NOT install Express.js or other backend dependencies yet (that's Epic 2 scope).
  - Notes: This is structure setup only. Include only TypeScript 5.6.3+ as devDependency for now. Express.js and other backend dependencies will be added in Epic 2. This aligns with Story 1.4 scope (structure only, not full implementation).

- [ ] Task 1.2.6: Create root package.json if needed
  - File: `package.json` (root)
  - Action: Create root `package.json` if it doesn't exist (for Husky/lint-staged configuration). Include basic structure: name, version, and prepare for Husky/lint-staged config.
  - Notes: Root package.json is needed for Husky and lint-staged configuration. If monorepo structure is used, this may already exist.

- [ ] Task 1.2.7: Install and initialize Husky
  - Files: `.husky/pre-commit`, `package.json` (root)
  - Action: Install `husky` as devDependency, run `npx husky install` to initialize Husky, create `.husky/pre-commit` hook that runs lint-staged
  - Notes: Husky must be initialized with `npx husky install` before creating hooks. Add `"prepare": "husky install"` script to root package.json for automatic initialization.

- [ ] Task 1.2.8: Configure lint-staged
  - File: `package.json` (root)
  - Action: Install `lint-staged` as devDependency, add `lint-staged` configuration to run ESLint and Prettier on staged files
  - Notes: Configure `lint-staged` in root package.json to run `eslint --fix` and `prettier --write` on staged files matching patterns `*.{ts,vue,js}` in `frontend/` directory.


#### Story 1.3: Setup Tailwind CSS with League of Legends Design Tokens

- [ ] Task 1.3.1: Install Tailwind CSS and dependencies
  - Files: `frontend/package.json`
  - Action: Install `tailwindcss`, `postcss`, `autoprefixer`, and `@nuxtjs/tailwindcss` module
  - Notes: Use `@nuxtjs/tailwindcss` Nuxt module for seamless integration

- [ ] Task 1.3.2: Initialize Tailwind configuration
  - File: `frontend/tailwind.config.ts`
  - Action: Run `npx tailwindcss init` or create `tailwind.config.ts` manually, configure content paths for Nuxt 3
  - Notes: Configure `content` to include `components/**/*.{vue,js,ts}`, `pages/**/*.{vue,js,ts}`, `layouts/**/*.{vue,js,ts}`, `app.vue`, `error.vue`

- [ ] Task 1.3.3: Create design tokens CSS file
  - File: `frontend/assets/css/tokens.css`
  - Action: Create CSS file with all League of Legends color variables from ux-design-specification.md (lines 990-1031). Include all `--color-blue-*` (50-600), `--color-gold-*` (50-600), `--color-grey-*` (50-500) variables, plus semantic mappings (`--color-primary`, `--color-accent`, `--color-background`, `--color-surface`, `--color-text`). Include state colors (success: green, error: red, warning: orange, info: blue) as documented in ux-design-specification.md.
  - Notes: Include ALL color variables from the specification, including state colors. Reference exact hex values from ux-design-specification.md to ensure accuracy.

- [ ] Task 1.3.4: Configure Tailwind to use design tokens
  - File: `frontend/tailwind.config.ts`
  - Action: Extend Tailwind theme with custom colors using CSS variables from tokens.css
  - Notes: Map Tailwind color names to CSS variables (e.g., `primary: 'var(--color-primary)'`, `accent: 'var(--color-accent)'`)

- [ ] Task 1.3.5: Configure Tailwind spacing system (8px base)
  - File: `frontend/tailwind.config.ts`
  - Action: Extend Tailwind `theme.extend.spacing` to use 8px (0.5rem) as base unit. Override default spacing scale: `spacing: { ...defaultTheme.spacing, ...custom8pxSpacing }` where custom spacing uses 0.5rem increments (0.5rem = 8px, 1rem = 16px, 1.5rem = 24px, etc.)
  - Notes: Tailwind default is 4px (0.25rem). For 8px base, create custom spacing object with 0.5rem increments. Example: `'1': '0.5rem'` (8px), `'2': '1rem'` (16px), `'3': '1.5rem'` (24px), etc. Merge with defaultTheme.spacing to keep other values.

- [ ] Task 1.3.6: Import tokens.css in Nuxt (with @nuxtjs/tailwindcss)
  - Files: `frontend/assets/css/main.css`, `frontend/nuxt.config.ts`
  - Action: Create `frontend/assets/css/main.css` with `@tailwind` directives (`@tailwind base;`, `@tailwind components;`, `@tailwind utilities;`) and import tokens.css FIRST before Tailwind directives: `@import './tokens.css';` then `@tailwind` directives. Configure `css: ['~/assets/css/main.css']` in `nuxt.config.ts`.
  - Notes: With `@nuxtjs/tailwindcss`, use `main.css` approach. Import tokens.css BEFORE Tailwind directives to ensure CSS variables are available when Tailwind classes are generated. Order matters: tokens.css → @tailwind base → @tailwind components → @tailwind utilities.

#### Story 1.4: Setup Project Structure (Frontend/Backend Separation)

- [ ] Task 1.4.1: Verify frontend structure
  - Directory: `frontend/`
  - Action: Verify `frontend/` contains Nuxt 3 structure: `pages/`, `components/`, `composables/`, `stores/`, `utils/`, `assets/`, `public/`
  - Notes: Nuxt 3 auto-generates this structure. Verify all directories exist and follow naming conventions.

- [ ] Task 1.4.2: Create backend directory structure
  - Directory: `backend/`
  - Action: Create `backend/src/` with subdirectories: `services/`, `middleware/`, `utils/`, `types/`, `config/`
  - Notes: Follow architecture document structure. Create placeholder directories for future use.

- [ ] Task 1.4.3: Create backend entry point (minimal structure)
  - File: `backend/src/index.ts`
  - Action: Create minimal TypeScript entry point with: `import express from 'express'; const app = express(); const PORT = process.env.PORT || 3001; app.get('/health', (req, res) => { res.json({ status: 'ok' }); }); app.listen(PORT, () => { console.log(`Server running on port ${PORT}`); }); export default app;`
  - Notes: This is structure-only setup. Minimal Express app with health check endpoint. Full Express configuration (middleware, routes, error handling) will be added in Epic 2. Use `index.ts` (not `app.ts`) as entry point for consistency.

- [ ] Task 1.4.4: Update .gitignore
  - File: `.gitignore`
  - Action: Add entries for `node_modules/`, `.nuxt/`, `.output/`, `.env.local`, `.DS_Store`, and other common ignores
  - Notes: Include both frontend and backend ignores, plus root-level ignores.

#### Story 1.5: Setup GitHub Actions CI/CD Pipeline

- [ ] Task 1.5.1: Add npm scripts to frontend package.json (BEFORE CI workflow)
  - File: `frontend/package.json`
  - Action: Add scripts: `typecheck: "vue-tsc --noEmit"` (or `tsc --noEmit`), `lint: "eslint ."`, `format: "prettier --write ."`, `format:check: "prettier --check ."`, `build: "nuxt build"`, `dev: "nuxt dev"`
  - Notes: These scripts must exist BEFORE creating CI workflow (Task 1.5.3-1.5.6 reference them). Use `vue-tsc` for Nuxt 3 TypeScript checking if available, otherwise `tsc --noEmit`.

- [ ] Task 1.5.2: Create GitHub Actions workflow directory
  - Directory: `.github/workflows/`
  - Action: Create `.github/workflows/` directory if it doesn't exist
  - Notes: Standard GitHub Actions directory structure

- [ ] Task 1.5.3: Create CI workflow file
  - File: `.github/workflows/ci.yml`
  - Action: Create workflow YAML file with jobs for type checking, linting, formatting, and build
  - Notes: Configure workflow to run on push and pull_request events, use Node.js 18+, run jobs sequentially

- [ ] Task 1.5.4: Configure TypeScript type checking job
  - File: `.github/workflows/ci.yml`
  - Action: Add job step to run `cd frontend && npm install && npm run typecheck`
  - Notes: Ensure TypeScript compilation succeeds without emitting files (type checking only). Install dependencies first.

- [ ] Task 1.5.5: Configure ESLint job
  - File: `.github/workflows/ci.yml`
  - Action: Add job step to run `cd frontend && npm install && npm run lint`
  - Notes: ESLint should fail the build if errors are found. Install dependencies first.

- [ ] Task 1.5.6: Configure Prettier formatting check job
  - File: `.github/workflows/ci.yml`
  - Action: Add job step to run `cd frontend && npm install && npm run format:check`
  - Notes: Prettier should check formatting without modifying files (read-only check). Install dependencies first.

- [ ] Task 1.5.7: Configure build job
  - File: `.github/workflows/ci.yml`
  - Action: Add job step to run `cd frontend && npm install && npm run build`
  - Notes: Build should succeed to verify the project compiles correctly. Install dependencies first.

### Acceptance Criteria

#### Story 1.1 Acceptance Criteria

- [ ] AC 1.1.1: Given the project root exists and Node.js 18+ is installed, when I run `npx nuxi@latest init frontend`, then the `frontend/` directory is created with Nuxt 3 project structure (or error is displayed if command fails)
- [ ] AC 1.1.2: Given Nuxt 3 is initialized, when I check `frontend/nuxt.config.ts`, then it exists and contains Nuxt 3 configuration
- [ ] AC 1.1.3: Given Nuxt 3 is initialized, when I check `frontend/tsconfig.json`, then it exists and TypeScript is configured
- [ ] AC 1.1.4: Given Nuxt 3 is initialized, when I run `cd frontend && npm run dev`, then the dev server starts successfully on default port (usually 3000)
- [ ] AC 1.1.5: Given the dev server is running, when I open `http://localhost:3000`, then I see the default Nuxt welcome page

#### Story 1.2 Acceptance Criteria

- [ ] AC 1.2.1: Given TypeScript is configured, when I check `frontend/tsconfig.json`, then `compilerOptions.strict` is `true`
- [ ] AC 1.2.2: Given ESLint is configured, when I run `npm run lint` in frontend, then ESLint executes without errors on the codebase
- [ ] AC 1.2.3: Given Prettier is configured, when I run `npm run format:check`, then Prettier validates formatting without errors
- [ ] AC 1.2.4: Given backend TypeScript is configured, when I check `backend/tsconfig.json`, then it exists with strict mode enabled
- [ ] AC 1.2.5: Given Husky is installed and initialized, when I check `.husky/pre-commit`, then it exists and contains `npx lint-staged`
- [ ] AC 1.2.6: Given Husky is configured, when I make a commit, then the pre-commit hook runs lint-staged
- [ ] AC 1.2.7: Given lint-staged is configured, when I commit a file with linting errors, then the commit is blocked and errors are displayed
- [ ] AC 1.2.8: Given all config files exist, when I check the repository, then all configuration files are committed (no uncommitted config files)

#### Story 1.3 Acceptance Criteria

- [ ] AC 1.3.1: Given Tailwind CSS is installed, when I check `frontend/package.json`, then `tailwindcss` and `@nuxtjs/tailwindcss` are in dependencies
- [ ] AC 1.3.2: Given Tailwind config exists, when I check `frontend/tailwind.config.ts`, then it exists and content paths include Nuxt 3 directories
- [ ] AC 1.3.3: Given tokens.css exists, when I check `frontend/assets/css/tokens.css`, then it contains all LoL color variables (`--color-blue-*`, `--color-gold-*`, `--color-grey-*`)
- [ ] AC 1.3.4: Given tokens.css exists, when I check the file, then semantic color mappings exist (`--color-primary`, `--color-accent`, `--color-background`, `--color-surface`, `--color-text`)
- [ ] AC 1.3.5: Given Tailwind is configured, when I check `frontend/tailwind.config.ts`, then custom colors reference CSS variables from tokens.css
- [ ] AC 1.3.6: Given tokens.css is imported BEFORE Tailwind directives in main.css, when I use Tailwind classes like `bg-primary` or `text-accent`, then the colors from tokens.css are applied correctly
- [ ] AC 1.3.7: Given spacing is configured, when I use Tailwind spacing utilities (e.g., `p-1`, `m-2`), then spacing follows 8px base unit (p-1 = 8px, p-2 = 16px, etc.)

#### Story 1.4 Acceptance Criteria

- [ ] AC 1.4.1: Given the project structure is set up, when I check `frontend/`, then it contains Nuxt 3 directories: `pages/`, `components/`, `composables/`, `stores/`, `utils/`, `assets/`, `public/`
- [ ] AC 1.4.2: Given backend structure exists, when I check `backend/src/`, then it contains: `services/`, `middleware/`, `utils/`, `types/`, `config/`
- [ ] AC 1.4.3: Given backend entry point exists, when I check `backend/src/app.ts` (or `index.ts`), then it exists with basic Express.js setup
- [ ] AC 1.4.4: Given .gitignore is updated, when I check `.gitignore`, then it includes ignores for `node_modules/`, `.nuxt/`, `.output/`, `.env.local`
- [ ] AC 1.4.5: Given the structure matches architecture, when I compare with architecture.md, then the structure aligns with documented patterns

#### Story 1.5 Acceptance Criteria

- [ ] AC 1.5.1: Given CI workflow exists, when I check `.github/workflows/ci.yml`, then it exists and is valid YAML
- [ ] AC 1.5.2: Given CI workflow is configured, when a push or PR is made, then the workflow runs automatically
- [ ] AC 1.5.3: Given type checking job exists, when CI runs, then TypeScript type checking executes and fails if types are invalid
- [ ] AC 1.5.4: Given ESLint job exists, when CI runs, then ESLint executes and fails if linting errors are found
- [ ] AC 1.5.5: Given Prettier job exists, when CI runs, then Prettier formatting check executes and fails if files are not formatted
- [ ] AC 1.5.6: Given build job exists, when CI runs, then the Nuxt build executes and fails if build errors occur
- [ ] AC 1.5.7: Given all jobs pass, when CI completes, then the workflow shows all jobs as successful (green checkmarks)

## Additional Context

### Dependencies

**Prerequisites:**
- Node.js 18+ installé et vérifié (`node --version`)
- Git repository initialisé (`git init` ou repository existant)
- GitHub repository créé et configuré (pour CI/CD workflows)
- npm ou yarn installé (pour gestion des dépendances)

**External Libraries:**
- Nuxt 3 (via `npx nuxi@latest` - latest version)
- TypeScript 5.6.3+ (included with Nuxt, separate for backend)
- Express.js 4.21.1 (backend only, not in this epic but structure prepared)
- Tailwind CSS + @nuxtjs/tailwindcss module
- ESLint + @nuxtjs/eslint-config-typescript
- Prettier + prettier-plugin-tailwindcss
- Husky + lint-staged

**No code dependencies** - Ceci est l'initialisation du projet depuis zéro.

### Testing Strategy

**No automated tests in this epic** - Les tests seront ajoutés dans les épics suivants lors de l'implémentation des fonctionnalités.

**Manual verification steps:**
- Verify Nuxt dev server starts: `cd frontend && npm run dev`
- Verify TypeScript compilation: `npm run typecheck`
- Verify ESLint: `npm run lint`
- Verify Prettier: `npm run format:check`
- Verify build: `npm run build`
- Verify pre-commit hooks work by attempting a commit with linting errors

### Notes

**Implementation Notes:**
- Le projet est nouveau (pas de migration de code existant) - clean slate confirmed
- Toutes les configurations doivent suivre les patterns définis dans `project-context.md`
- Les design tokens LoL doivent correspondre exactement aux couleurs définies dans `ux-design-specification.md` (lignes 990-1031)
- La structure frontend/backend séparée permet une évolution indépendante des deux parties
- Nuxt 3 latest version - utiliser `npx nuxi@latest` pour obtenir la dernière version stable

**Known Limitations:**
- Backend Express.js n'est pas complètement configuré (seulement structure de base) - sera complété dans Epic 2
- Pas de déploiement automatique configuré (CI seulement) - workflow de déploiement préparé mais non activé
- Pas de tests automatisés dans cet épic - tests ajoutés dans épics suivants

**Future Considerations:**
- Déploiement automatique vers VPS (préparé mais non configuré)
- Configuration complète du backend Express (Epic 2)
- Configuration des stores Pinia (Epic 3)
- Configuration des pages et composants (Epic 3+)
- Tests unitaires et E2E (épics suivants)

**High-Risk Items:**
- Design tokens doivent correspondre exactement aux couleurs LoL - vérifier avec ux-design-specification.md
- TypeScript strict mode peut causer des erreurs si non configuré correctement - tester après configuration
- Pre-commit hooks peuvent bloquer les commits si mal configurés - tester avec un commit de test
- CI/CD workflow doit être testé avec un push réel pour vérifier qu'il s'exécute correctement
- Ordre d'import CSS critique: tokens.css doit être importé AVANT les directives @tailwind dans main.css
- Husky doit être initialisé avec `npx husky install` avant de créer les hooks

**Adversarial Review Corrections Applied:**
- F1 (CRITICAL): Clarified MPA configuration in Task 1.1.2 - Nuxt 3 SSR by default enables MPA via file-based routing
- F2 (HIGH): Specified `.eslintrc.cjs` format (not JSON) and added `eslint-config-prettier` configuration details
- F3 (HIGH): Clarified Task 1.2.5 is structure-only, Express.js will be added in Epic 2
- F4 (HIGH): Added detailed 8px spacing configuration with specific rem values in Task 1.3.5
- F5 (MEDIUM): Specified `main.css` approach with import order (tokens.css before @tailwind) in Task 1.3.6
- F6 (MEDIUM): Added explicit Husky initialization task (Task 1.2.7) with `npx husky install`
- F7 (MEDIUM): Reordered tasks - npm scripts (Task 1.5.1) now before CI workflow tasks
- F8 (MEDIUM): Clarified `eslint-config-prettier` integration in Task 1.2.2
- F9 (MEDIUM): Added import order verification in AC 1.3.6
- F10 (LOW): Added specific Express.js code example in Task 1.4.3
- F11 (LOW): Added Task 1.2.6 to create root package.json if needed
- F12 (LOW): Clarified AC 1.4.5 with specific architecture.md sections to check
- F13 (LOW): Added `npm install` step in Task 1.1.4
- F14 (LOW): Added error handling note in Task 1.1.1
- F15 (LOW): Clarified scope includes state colors in Task 1.3.3
