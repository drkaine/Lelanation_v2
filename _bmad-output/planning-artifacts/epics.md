---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation']
status: 'complete'
readyForDevelopment: true
inputDocuments: 
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/planning-artifacts/architecture.md'
  - '_bmad-output/planning-artifacts/ux-design-specification.md'
completedAt: '2026-01-14T16:00:00+00:00'
---

# Lelanation_v2 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Lelanation_v2, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

**Build Creation & Management (FR1-FR14):**
- FR1: Users can create a new build by selecting a champion
- FR2: Users can select items for their build from the available item list
- FR3: Users can select primary and secondary runes for their build
- FR4: Users can select summoner spells for their build
- FR5: Users can select rune shards for their build
- FR6: Users can define the skill order (ability upgrade sequence) for their build
- FR7: Users can see calculated statistics update in real-time as they modify their build
- FR8: Users can save their build locally (browser storage)
- FR9: Users can modify an existing saved build
- FR10: Users can delete a saved build
- FR11: Users can share their build via a unique link
- FR12: Users can copy a build from a shared link
- FR13: Users can validate that their build configuration is correct before saving
- FR14: Users can see a warning when viewing or modifying an outdated build (created with old game version)

**Build Discovery & Search (FR15-FR23):**
- FR15: Users can search for builds by champion name
- FR16: Users can view a list of available builds for a specific champion
- FR17: Users can filter builds by role (top, jungle, mid, adc, support)
- FR18: Users can filter builds by main items
- FR19: Users can view build details including items, runes, summoner spells, and skill order
- FR20: Users can view calculated statistics for a build
- FR21: Users can compare 2 or more builds side-by-side
- FR22: Users can see which builds are most popular (by view count) or recently created (by creation date)
- FR23: Users can access builds shared by other users via unique links

**Theorycraft & Analysis (FR24-FR29):**
- FR24: Users can see detailed statistics calculated for their build (damage, resistances, attack speed, etc.)
- FR25: Users can see how statistics change when modifying items or runes
- FR26: Users can optimize their build by adjusting items based on calculated statistics
- FR27: Users can compare statistics between different builds
- FR28: Users can see advanced analysis of build statistics
- FR29: Users can see recommendations for build improvements based on statistics

**Data Synchronization (FR30-FR37):**
- FR30: The system can automatically synchronize game data (champions, items, runes, spells) from Riot Games Data Dragon API
- FR31: The system can detect new game versions from Data Dragon API
- FR32: The system can automatically synchronize YouTube videos from configured content creators
- FR33: The system can update video lists when new videos are published by content creators
- FR34: The system can handle synchronization errors and retry failed synchronizations
- FR35: The system can notify administrators when synchronization fails
- FR36: Users can see when game data was last synchronized
- FR37: Users can see if their build uses outdated game data

**Content Management (FR38-FR42):**
- FR38: Users can view YouTube videos from League of Legends content creators
- FR39: Users can see a list of videos organized by content creator
- FR40: Administrators can configure the list of content creators whose videos should be synchronized
- FR41: The system can automatically update the video list when new videos are available
- FR42: Users can access shared builds through unique links without authentication

**Administration & Monitoring (FR43-FR51):**
- FR43: Administrators can access an admin dashboard
- FR44: Administrators can view total number of builds created
- FR45: Administrators can view number of active users
- FR46: Administrators can view builds created today/this week
- FR47: Administrators can view the status of cron jobs (Data Dragon sync, YouTube sync, cache maintenance)
- FR48: Administrators can see when each cron job last executed
- FR49: Administrators can view system performance metrics (uptime, API response time, error rate)
- FR50: Administrators can receive Discord alerts when system errors occur
- FR51: Administrators can access detailed analytics through Matomo integration

**User Experience & Accessibility (FR52-FR58):**
- FR52: Users can access the application from mobile devices with a mobile-optimized interface
- FR53: Users can navigate the application using keyboard only
- FR54: Users with screen readers can access all application features
- FR55: Users can access the application in French language
- FR56: Users can access the application in English language
- FR57: Users can see cookie consent banner and manage cookie preferences
- FR58: Users can understand what data is collected and how it's used

**SEO & Discoverability (FR59-FR65):**
- FR59: Search engines can index all public pages (except admin pages)
- FR60: Search engines can access sitemap.xml with all indexable pages
- FR61: Search engines can read robots.txt configuration
- FR62: LLMs can index and understand page content through structured data
- FR63: Each build page has unique, SEO-friendly URL
- FR64: Each champion page has unique, SEO-friendly URL
- FR65: Each page includes appropriate meta tags for search engines and social sharing

**Build Archive & Version Management (FR66-FR70):**
- FR66: The system can archive builds created with old game versions
- FR67: Users can still access archived builds (created with old game versions)
- FR68: Users can see a warning banner on outdated builds
- FR69: Users can update an outdated build to use current game version data
- FR70: The system can maintain compatibility information for builds across game versions

### NonFunctional Requirements

**Performance:**
- Page load time must be < 2 seconds for any page (requirement from success criteria)
- API response time must be < 500ms for any API endpoint (requirement from success criteria)
- Real-time statistics calculations must complete within 500ms when users modify builds
- Initial page render must be < 1 second to provide immediate feedback
- System must support 1,000 concurrent users initially without performance degradation
- System must scale to support 10,000+ concurrent users (requirement from success criteria)
- Performance degradation must be < 10% when scaling from 1k to 10k users
- System must handle traffic spikes during major game patches, season start, and content creator video publications
- Performance must remain within acceptable limits (< 2s page load, < 500ms API) during traffic spikes
- Statistics calculations must be performed client-side for optimal performance
- Build creation and modification must feel responsive (< 100ms perceived latency)
- Mobile performance must be within 10% of desktop performance for page load time and API response time

**Scalability:**
- System must support 1,000 concurrent users at launch
- Architecture must be designed to scale horizontally to support 10x load increase
- System must scale to support 10,000+ concurrent users (requirement from success criteria)
- Scalability must support 20% monthly growth rate (requirement from success criteria)
- Scaling must not require changes to core architecture components
- Build storage must scale to support 10,000+ builds without performance impact
- Synchronization processes must scale to handle increasing data volumes
- File-based storage architecture must maintain < 500ms read/write latency as data grows
- System must scale compute resources independently from storage
- Caching system must scale to handle increased load
- Static assets must be delivered with optimal performance globally (page load time < 2s for 95th percentile users worldwide)

**Reliability:**
- System uptime must be ≥ 99.5% (requirement from success criteria)
- Planned maintenance windows must be minimal and scheduled during low-traffic periods
- Unplanned downtime must be < 4.38 hours per month (to maintain 99.5% uptime)
- System must handle up to 1 synchronization error per day without user impact
- Automatic retry mechanism must attempt failed operations up to 10 times
- Failed synchronizations must not prevent users from accessing the application
- Users must be able to use the application even if external APIs (Data Dragon, YouTube) are temporarily unavailable
- Build data must remain consistent even if synchronization fails
- Users must be able to access their saved builds even during synchronization failures
- System must gracefully degrade when external data sources are unavailable
- System must provide real-time monitoring of system health
- Discord alerts must be sent immediately when critical errors occur
- Cron job failures must be detected and reported within 5 minutes
- System must log all errors for investigation and resolution

**Integration:**
- Data Dragon API integration must handle rate limits and API changes gracefully
- YouTube API integration must handle API rate limits and quota restrictions
- Integration failures must not prevent core application functionality
- System must download and store data locally, eliminating need for real-time API calls during user interactions
- System must tolerate up to 1 integration error per day
- Automatic retry mechanism must attempt failed integrations up to 10 times before reporting failure
- Failed integrations must trigger Discord alerts for administrator notification
- System must continue operating with cached data when external APIs are unavailable
- Daily synchronization must complete successfully or report failure within 24 hours
- Synchronization failures must not affect user access to existing data
- System must maintain data versioning to support rollback if synchronization introduces errors

**Accessibility:**
- System must comply with WCAG 2.1 Level AA standards (requirement from web app requirements)
- All functionality must be accessible via keyboard navigation
- Screen readers must be able to access and understand all application features
- Color contrast ratios must meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- All interactive elements must be accessible via keyboard
- Focus indicators must be clearly visible
- Tab order must follow visual reading order (left-to-right, top-to-bottom) and be announced correctly by screen readers
- Keyboard shortcuts must not conflict with browser or assistive technology shortcuts
- All images must have descriptive alt text
- Form inputs must have associated labels
- ARIA labels and roles must be used appropriately
- Dynamic content updates must be announced to screen readers
- Touch targets must be at least 44x44 pixels
- Interface must be usable with assistive technologies on mobile devices
- Mobile interface must maintain accessibility features equivalent to desktop

**Security:**
- No personal data is collected or stored (no authentication system)
- Build data stored locally (localStorage) is user-controlled
- Shared builds use UUID-based links (sufficient security for non-sensitive data)
- No database means no risk of data breaches from database attacks
- Cookie consent banner must be displayed for localStorage and Matomo usage (RGPD requirement)
- Users must be able to accept or reject cookies
- Privacy policy must clearly explain data usage
- No tracking without user consent
- All API communications must use HTTPS
- API endpoints must validate input to prevent injection attacks
- Rate limiting must be implemented to prevent abuse
- CORS must be configured appropriately for security
- Shared build links (UUIDs) provide sufficient security for non-sensitive content
- No additional encryption needed for build data
- System must prevent malicious content injection in user-generated builds

**Browser & Device Support:**
- System must support all modern browsers (Chrome, Firefox, Safari, Edge - latest versions)
- System must support mobile browsers (Chrome Mobile, Safari Mobile, Firefox Mobile)
- Progressive enhancement must ensure core functionality works on older browsers
- JavaScript must degrade gracefully if disabled
- System must be fully functional on mobile devices (mobile-first design)
- Touch interactions must be supported and optimized
- Responsive design must adapt to all screen sizes (mobile, tablet, desktop)
- Performance must be equivalent across devices

### Additional Requirements

**From Architecture Document:**

**Starter Template:**
- **Nuxt 3 (Migration SPA → MPA)** : Initialisation du projet avec Nuxt 3 pour la migration SPA → MPA
- Initialisation via `npx nuxi@latest init frontend`
- Configuration Nuxt pour SSR/SSG/MPA dans `nuxt.config.ts`
- Routing automatique basé sur le système de fichiers (file-based routing)
- Support TypeScript natif et intégration Pinia

**Infrastructure & Deployment:**
- VPS traditionnel (DigitalOcean, Linode, etc.) pour l'hébergement
- GitHub Actions pour CI/CD pipeline
- Monitoring hybride (monitoring simple + alertes Discord + logs structurés)
- Scaling vertical initial (ressources VPS augmentables)
- Health checks simples pour monitoring
- Alertes Discord automatisées pour erreurs critiques et sync failures
- Logs structurés (JSON en production, simple en développement)

**Data Architecture:**
- File-based storage avec structure prefix-based (JSON files)
- Validation hybride (Zod schemas + validation manuelle)
- Migration automatique des builds lors des changements de version
- Cache-aside pattern avec Redis pour performance

**API & Communication:**
- REST API avec structure hybride (middleware + classes + monad error handling)
- Rate limiting avec Redis
- Documentation OpenAPI
- Result<T, E> pattern pour error handling

**Frontend Architecture:**
- Nuxt 3 file-based routing par domaine
- Pinia pour state management
- Calculs client-side avec Web Workers et memoization
- Performance optimization (lazy loading, code splitting)

**Security:**
- Helmet.js pour sécurité HTTP
- Authentification admin basique (URL spécifique avec nom admin dans .env)
- Validation input avec Zod
- HTTPS obligatoire

**From UX Design Document:**

**Responsive Design Requirements:**
- Mobile-First design approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Grille responsive: 1 colonne mobile, 2-3 tablet, 3-4 desktop, 4-6 large desktop
- Performance mobile équivalente à desktop (within 10%)
- Touch targets ≥ 44x44px

**Accessibility Requirements:**
- WCAG 2.1 Level AA compliance
- Navigation clavier complète
- Support lecteurs d'écran (ARIA labels, structure sémantique)
- Contraste couleurs ≥ 4.5:1 pour texte normal, ≥ 3:1 pour texte large
- Respect de `prefers-reduced-motion` pour animations

**Browser/Device Compatibility:**
- Support navigateurs modernes (Chrome, Firefox, Safari, Edge)
- Support navigateurs mobiles (Chrome Mobile, Safari Mobile, Firefox Mobile)
- Progressive enhancement pour navigateurs plus anciens
- Dégradation gracieuse si JavaScript désactivé

**Animation & Transition Requirements:**
- Transitions subtiles (200ms pour rapides, 300ms pour complexes)
- Easing `ease-in-out` pour transitions naturelles
- Glows subtils au hover pour feedback visuel
- Animations respectant `prefers-reduced-motion`

**User Interaction Patterns:**
- Feedback immédiat pour toutes les actions (< 100ms latence perçue)
- Un clic = une action visible
- Affichage progressif (minimal par défaut, détails sur demande)
- Recherche et filtrage instantanés (debounce 300ms)

### FR Coverage Map

**Build Creation & Management:**
- FR1: Epic 3 - Créer un build en sélectionnant un champion
- FR2: Epic 3 - Sélectionner des items pour le build
- FR3: Epic 3 - Sélectionner runes principales et secondaires
- FR4: Epic 3 - Sélectionner sorts d'invocateur
- FR5: Epic 3 - Sélectionner shards de runes
- FR6: Epic 3 - Définir ordre de montée des compétences
- FR7: Epic 3 - Voir stats calculées en temps réel
- FR8: Epic 3 - Sauvegarder build localement
- FR9: Epic 3 - Modifier un build sauvegardé
- FR10: Epic 3 - Supprimer un build sauvegardé
- FR11: Epic 7 - Partager build via lien unique
- FR12: Epic 7 - Copier build depuis lien partagé
- FR13: Epic 3 - Valider configuration avant sauvegarde
- FR14: Epic 7 - Avertissement pour builds obsolètes

**Build Discovery & Search:**
- FR15: Epic 4 - Rechercher builds par nom de champion
- FR16: Epic 4 - Voir liste de builds pour un champion
- FR17: Epic 4 - Filtrer builds par rôle
- FR18: Epic 4 - Filtrer builds par items principaux
- FR19: Epic 4 - Voir détails complets d'un build
- FR20: Epic 4 - Voir statistiques calculées d'un build
- FR21: Epic 4 - Comparer 2+ builds côte à côte
- FR22: Epic 4 - Voir builds populaires ou récents
- FR23: Epic 7 - Accéder builds partagés via liens

**Theorycraft & Analysis:**
- FR24: Epic 5 - Voir stats détaillées calculées
- FR25: Epic 5 - Voir changements de stats lors modifications
- FR26: Epic 5 - Optimiser build basé sur stats
- FR27: Epic 5 - Comparer stats entre builds
- FR28: Epic 5 - Voir analyses avancées de stats
- FR29: Epic 5 - Voir recommandations d'amélioration

**Data Synchronization:**
- FR30: Epic 2 - Synchroniser données de jeu depuis Data Dragon
- FR31: Epic 2 - Détecter nouvelles versions de jeu
- FR32: Epic 2 - Synchroniser vidéos YouTube automatiquement
- FR33: Epic 2 - Mettre à jour liste vidéos quand nouvelles publiées
- FR34: Epic 2 - Gérer erreurs de synchronisation avec retry
- FR35: Epic 2 - Notifier admins en cas d'échec sync
- FR36: Epic 2 - Afficher date dernière synchronisation
- FR37: Epic 2 - Indiquer si build utilise données obsolètes

**Content Management:**
- FR38: Epic 6 - Voir vidéos YouTube des créateurs
- FR39: Epic 6 - Voir liste vidéos organisée par créateur
- FR40: Epic 6 - Configurer liste créateurs à synchroniser (admin)
- FR41: Epic 6 - Mettre à jour liste vidéos automatiquement
- FR42: Epic 7 - Accéder builds partagés sans authentification

**Administration & Monitoring:**
- FR43: Epic 8 - Accéder dashboard admin
- FR44: Epic 8 - Voir nombre total de builds créés
- FR45: Epic 8 - Voir nombre d'utilisateurs actifs
- FR46: Epic 8 - Voir builds créés aujourd'hui/cette semaine
- FR47: Epic 8 - Voir statut cron jobs
- FR48: Epic 8 - Voir dernière exécution de chaque cron job
- FR49: Epic 8 - Voir métriques de performance système
- FR50: Epic 8 - Recevoir alertes Discord en cas d'erreur
- FR51: Epic 8 - Accéder analytics détaillées via Matomo

**User Experience & Accessibility:**
- FR52: Epic 9 - Accéder application depuis mobile
- FR53: Epic 9 - Naviguer avec clavier uniquement
- FR54: Epic 9 - Accès via lecteurs d'écran
- FR55: Epic 9 - Accès en français
- FR56: Epic 9 - Accès en anglais
- FR57: Epic 9 - Voir bannière consentement cookies
- FR58: Epic 9 - Comprendre données collectées

**SEO & Discoverability:**
- FR59: Epic 9 - Indexation pages publiques par moteurs
- FR60: Epic 9 - Accès sitemap.xml par moteurs
- FR61: Epic 9 - Lecture robots.txt par moteurs
- FR62: Epic 9 - Indexation par LLMs via structured data
- FR63: Epic 9 - URLs SEO-friendly pour pages builds
- FR64: Epic 9 - URLs SEO-friendly pour pages champions
- FR65: Epic 9 - Meta tags appropriés pour SEO et partage

**Build Archive & Version Management:**
- FR66: Epic 7 - Archiver builds créés avec anciennes versions
- FR67: Epic 7 - Accéder builds archivés
- FR68: Epic 7 - Voir bannière d'avertissement sur builds obsolètes
- FR69: Epic 7 - Mettre à jour build obsolète vers version actuelle
- FR70: Epic 7 - Maintenir compatibilité builds entre versions

## Epic List

### Epic 1: Foundation & Project Setup

**Goal:** Initialiser le projet Nuxt 3 avec la structure de base, la configuration TypeScript, ESLint, Prettier, et le pipeline CI/CD GitHub Actions. Cette fondation technique est nécessaire pour tous les développements ultérieurs.

**FRs covered:** Infrastructure (Starter Template Nuxt 3, structure projet, CI/CD)

**Implementation Notes:**
- Initialisation Nuxt 3 avec `npx nuxi@latest init frontend`
- Configuration Nuxt pour SSR/SSG/MPA dans `nuxt.config.ts`
- Structure de projet selon architecture (frontend/, backend/)
- Configuration TypeScript, ESLint, Prettier
- Setup GitHub Actions CI/CD
- Design tokens Tailwind CSS (couleurs League of Legends)

**Dependencies:** Aucune (épic de fondation)

**User Value:** Base technique solide pour le développement

---

### Epic 2: Data Synchronization & Game Data

**Goal:** Synchroniser automatiquement les données de jeu (champions, items, runes, sorts) depuis l'API Data Dragon de Riot Games et les vidéos YouTube depuis les créateurs configurés. Les utilisateurs peuvent voir quand les données ont été synchronisées et être alertés si leurs builds utilisent des données obsolètes.

**FRs covered:** FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37

**Implementation Notes:**
- Service DataDragonService pour synchronisation quotidienne
- Cron job pour synchronisation automatique Data Dragon
- Cron job pour synchronisation automatique YouTube
- Gestion d'erreurs avec retry (jusqu'à 10 tentatives)
- Alertes Discord pour échecs de synchronisation
- Stockage local des données synchronisées
- Indicateurs visuels de date de dernière synchronisation
- Détection automatique des nouvelles versions de jeu

**Dependencies:** Epic 1 (infrastructure de base)

**User Value:** Données de jeu toujours à jour pour créer et consulter des builds fiables

---

### Epic 3: Build Creation & Management

**Goal:** Permettre aux utilisateurs de créer, modifier et sauvegarder des builds complets avec calculs de statistiques en temps réel. Les utilisateurs peuvent sélectionner champion, items, runes, sorts d'invocateur, shards et définir l'ordre de montée des compétences. Les stats se mettent à jour instantanément lors des modifications.

**FRs covered:** FR1, FR2, FR3, FR4, FR5, FR6, FR7, FR8, FR9, FR10, FR13

**Implementation Notes:**
- Composants ChampionSelector, ItemSelector, RuneSelector
- Calculs de stats en temps réel côté client (< 500ms)
- Sauvegarde locale dans localStorage
- Validation de build avant sauvegarde
- Interface de création avec progression visuelle (champions → items → runes → infos)
- Feedback immédiat pour toutes les interactions

**Dependencies:** Epic 1 (infrastructure), Epic 2 (données de jeu)

**User Value:** Créer un build complet et fonctionnel en moins de 3 minutes avec calculs de stats précis

---

### Epic 4: Build Discovery & Search

**Goal:** Permettre aux utilisateurs de rechercher et découvrir des builds existants rapidement. Les utilisateurs peuvent rechercher par champion, filtrer par rôle ou items, voir les détails complets, comparer plusieurs builds, et identifier les builds populaires ou récents.

**FRs covered:** FR15, FR16, FR17, FR18, FR19, FR20, FR21, FR22

**Implementation Notes:**
- Barre de recherche avec résultats instantanés
- Filtres par version (bouton ON/OFF "À jour"), champion, rôle
- Grille de cartes de builds (build entier visible sur chaque carte)
- Page de détails de build avec toutes les informations
- Comparaison de builds côte à côte
- Tri par popularité (votes) ou date de création
- Navigation par scroll avec filtres instantanés

**Dependencies:** Epic 1 (infrastructure), Epic 2 (données de jeu), Epic 3 (création de builds)

**User Value:** Trouver un build pertinent en moins de 5-10 secondes (le temps de commencer une partie)

---

### Epic 5: Theorycraft & Analysis

**Goal:** Fournir des outils avancés d'analyse et d'optimisation de builds. Les utilisateurs peuvent voir des statistiques détaillées, comprendre comment les stats changent lors des modifications, optimiser leurs builds, comparer les stats entre différents builds, et recevoir des recommandations d'amélioration.

**FRs covered:** FR24, FR25, FR26, FR27, FR28, FR29

**Implementation Notes:**
- Affichage détaillé des statistiques calculées
- Visualisation des changements de stats en temps réel
- Outils d'optimisation basés sur les stats
- Comparaison de statistiques entre builds
- Analyses avancées avec recommandations
- Composant StatsDisplay avec toggle pour vue simple/détaillée

**Dependencies:** Epic 1 (infrastructure), Epic 2 (données de jeu), Epic 3 (création de builds)

**User Value:** Optimiser ses builds avec des analyses détaillées et des recommandations intelligentes

---

### Epic 6: Content Management & YouTube Integration

**Goal:** Afficher et synchroniser automatiquement les vidéos YouTube des créateurs de contenu League of Legends. Les utilisateurs peuvent voir les vidéos organisées par créateur, et les administrateurs peuvent configurer la liste des créateurs à synchroniser.

**FRs covered:** FR38, FR39, FR40, FR41

**Implementation Notes:**
- Service YouTubeService pour synchronisation automatique
- Cron job pour mise à jour automatique des vidéos
- Affichage des vidéos organisées par créateur
- Configuration admin des créateurs à synchroniser
- Gestion des erreurs et retry pour API YouTube

**Dependencies:** Epic 1 (infrastructure), Epic 2 (synchronisation de base), Epic 8 (dashboard admin pour FR40)

**User Value:** Accéder facilement aux vidéos des créateurs de contenu League of Legends

---

### Epic 7: Build Sharing & Version Management

**Goal:** Permettre aux utilisateurs de partager leurs builds via des liens uniques et gérer les versions de builds. Les utilisateurs peuvent partager des builds, copier des builds depuis des liens partagés, et être alertés si un build utilise des données obsolètes. Le système archive automatiquement les builds créés avec d'anciennes versions.

**FRs covered:** FR11, FR12, FR14, FR23, FR42, FR66, FR67, FR68, FR69, FR70

**Implementation Notes:**
- Génération de liens uniques (UUID) pour partage
- Page de build partagé accessible sans authentification
- Système d'archivage automatique des builds obsolètes
- Bannière d'avertissement pour builds obsolètes
- Fonctionnalité de mise à jour de build obsolète
- Gestion de compatibilité entre versions de builds
- Modal de partage avec lien copiable

**Dependencies:** Epic 1 (infrastructure), Epic 2 (gestion des versions), Epic 3 (création de builds)

**User Value:** Partager facilement ses builds avec la communauté et gérer les versions obsolètes

---

### Epic 8: Administration & Monitoring

**Goal:** Fournir un dashboard d'administration avec monitoring complet du système. Les administrateurs peuvent voir les métriques d'utilisation, surveiller l'état des cron jobs, consulter les performances système, recevoir des alertes Discord en cas d'erreur, et accéder aux analytics détaillées via Matomo.

**FRs covered:** FR43, FR44, FR45, FR46, FR47, FR48, FR49, FR50, FR51

**Implementation Notes:**
- Page admin avec authentification basique (URL spécifique avec nom admin dans .env)
- Dashboard avec métriques clés (builds créés, utilisateurs actifs, builds récents)
- Affichage du statut des cron jobs (Data Dragon sync, YouTube sync, cache maintenance)
- Métriques de performance (uptime, temps de réponse API, taux d'erreur)
- Intégration Discord pour alertes automatiques
- Intégration Matomo pour analytics détaillées

**Dependencies:** Epic 1 (infrastructure), Epic 2 (cron jobs à monitorer)

**User Value:** Surveiller efficacement la santé du système et détecter rapidement les problèmes (admin)

---

### Epic 9: UX, Accessibility & SEO

**Goal:** Fournir une expérience utilisateur optimale, accessible et découvrable. L'application est responsive (mobile-first), accessible (WCAG 2.1 Level AA), multilingue (FR/EN), et optimisée pour le SEO. Les utilisateurs peuvent naviguer au clavier, utiliser des lecteurs d'écran, et comprendre la gestion des données via consentement cookies.

**FRs covered:** FR52, FR53, FR54, FR55, FR56, FR57, FR58, FR59, FR60, FR61, FR62, FR63, FR64, FR65

**Implementation Notes:**
- Design responsive mobile-first avec breakpoints Tailwind
- Support navigation clavier complète
- Support lecteurs d'écran (ARIA labels, structure sémantique)
- Internationalisation (i18n) FR/EN
- Bannière consentement cookies RGPD
- SEO: sitemap.xml, robots.txt, structured data, meta tags
- URLs SEO-friendly pour pages builds et champions
- Conformité WCAG 2.1 Level AA

**Dependencies:** Epic 1 (infrastructure), Epic 3 (création de builds pour pages), Epic 4 (découverte pour pages)

**User Value:** Expérience utilisateur optimale, accessible à tous, et découvrable via moteurs de recherche

---

## Epic 1: Foundation & Project Setup

Initialiser le projet Nuxt 3 avec la structure de base, la configuration TypeScript, ESLint, Prettier, et le pipeline CI/CD GitHub Actions. Cette fondation technique est nécessaire pour tous les développements ultérieurs.

### Story 1.1: Initialize Nuxt 3 Project

As a developer,
I want to initialize a Nuxt 3 project with the correct structure,
So that I have a solid foundation for building the MPA application.

**Acceptance Criteria:**

**Given** the project root directory exists
**When** I run `npx nuxi@latest init frontend`
**Then** a Nuxt 3 project is created in the `frontend/` directory
**And** the project structure follows the architecture document (frontend/, backend/)
**And** `nuxt.config.ts` is configured for SSR/SSG/MPA mode
**And** TypeScript is enabled by default
**And** the project can be started with `npm run dev`

### Story 1.2: Configure TypeScript, ESLint, and Prettier

As a developer,
I want to configure TypeScript, ESLint, and Prettier for code quality,
So that the codebase maintains consistent style and catches errors early.

**Acceptance Criteria:**

**Given** the Nuxt 3 project is initialized
**When** I configure TypeScript, ESLint, and Prettier
**Then** `tsconfig.json` is properly configured for Nuxt 3
**And** ESLint rules are set up with Nuxt-specific rules
**And** Prettier configuration matches project standards
**And** pre-commit hooks (optional) can validate code quality
**And** all configuration files are committed to the repository

### Story 1.3: Setup Tailwind CSS with League of Legends Design Tokens

As a developer,
I want to configure Tailwind CSS with custom design tokens for League of Legends colors,
So that I can build a visually consistent UI that matches the game's aesthetic.

**Acceptance Criteria:**

**Given** the Nuxt 3 project is initialized
**When** I install and configure Tailwind CSS
**Then** Tailwind CSS is integrated with Nuxt 3
**And** custom design tokens are defined in CSS variables (LoL blue and gold palette)
**And** design tokens include: `--color-blue-*`, `--color-gold-*`, `--color-grey-*`
**And** design tokens are accessible via Tailwind config
**And** the color system supports primary, accent, background, surface, and text colors
**And** spacing system uses 8px base unit

### Story 1.4: Setup Project Structure (Frontend/Backend Separation)

As a developer,
I want to organize the project with clear frontend and backend separation,
So that the codebase is maintainable and follows the architecture.

**Acceptance Criteria:**

**Given** the Nuxt 3 project is initialized
**When** I set up the project structure
**Then** `frontend/` directory contains the Nuxt 3 application
**And** `backend/` directory is created for API services
**And** shared types/utilities are organized appropriately
**And** the structure matches the architecture document
**And** all directories follow naming conventions

### Story 1.5: Setup GitHub Actions CI/CD Pipeline

As a developer,
I want to configure GitHub Actions for CI/CD,
So that code quality checks and deployments are automated.

**Acceptance Criteria:**

**Given** the project is in a GitHub repository
**When** I configure GitHub Actions workflows
**Then** a CI workflow runs on pull requests and pushes
**And** the workflow runs TypeScript type checking
**And** the workflow runs ESLint checks
**And** the workflow runs Prettier formatting checks
**And** the workflow can build the Nuxt 3 application
**And** deployment workflow (optional) is prepared for VPS deployment

---

## Epic 2: Data Synchronization & Game Data

Synchroniser automatiquement les données de jeu (champions, items, runes, sorts) depuis l'API Data Dragon de Riot Games et les vidéos YouTube depuis les créateurs configurés. Les utilisateurs peuvent voir quand les données ont été synchronisées et être alertés si leurs builds utilisent des données obsolètes.

### Story 2.1: Create DataDragonService for Game Data Synchronization

As a developer,
I want to create a service to synchronize game data from Riot Games Data Dragon API,
So that the application has up-to-date champion, item, rune, and spell data.

**Acceptance Criteria:**

**Given** the backend structure exists
**When** I create the DataDragonService
**Then** the service can fetch champions data from Data Dragon API
**And** the service can fetch items data from Data Dragon API
**And** the service can fetch runes data from Data Dragon API
**And** the service can fetch summoner spells data from Data Dragon API
**And** the service stores data locally in JSON files
**And** the service handles API rate limits gracefully
**And** the service returns a Result<T, E> type for error handling

### Story 2.2: Implement Automatic Data Dragon Synchronization Cron Job

As a system administrator,
I want the system to automatically synchronize game data daily,
So that users always have access to the latest game data without manual intervention.

**Acceptance Criteria:**

**Given** the DataDragonService exists
**When** I implement a cron job for daily synchronization
**Then** the cron job runs automatically once per day
**And** the cron job calls DataDragonService to fetch latest data
**And** the cron job stores the synchronization timestamp
**And** the cron job logs success or failure
**And** the cron job handles errors and retries up to 10 times
**And** failed synchronizations trigger Discord alerts (FR35)

### Story 2.3: Detect and Handle New Game Versions

As a user,
I want the system to detect when new game versions are available,
So that I know if my builds use outdated data.

**Acceptance Criteria:**

**Given** the DataDragonService exists
**When** a new game version is released
**Then** the system detects the new version from Data Dragon API
**And** the system stores version information
**And** the system can compare current version with build versions
**And** the system marks builds as outdated if they use old versions
**And** users see a warning when viewing outdated builds (FR37)

### Story 2.4: Display Last Synchronization Date to Users

As a user,
I want to see when game data was last synchronized,
So that I know if the data is current.

**Acceptance Criteria:**

**Given** synchronization timestamps are stored
**When** I view any page that uses game data
**Then** I can see the last synchronization date
**And** the date is displayed in a user-friendly format
**And** the date updates automatically after successful synchronizations
**And** the date is visible but not intrusive (footer or info section)

### Story 2.5: Implement YouTube Video Synchronization Service

As a developer,
I want to create a service to synchronize YouTube videos from content creators,
So that users can access the latest videos from League of Legends creators.

**Acceptance Criteria:**

**Given** the backend structure exists
**When** I create the YouTubeService
**Then** the service can fetch videos from configured YouTube channels
**And** the service stores video metadata locally
**And** the service handles YouTube API rate limits
**And** the service returns a Result<T, E> type for error handling
**And** the service can filter videos by League of Legends relevance

### Story 2.6: Implement Automatic YouTube Synchronization Cron Job

As a system administrator,
I want the system to automatically synchronize YouTube videos daily,
So that users always see the latest content from creators.

**Acceptance Criteria:**

**Given** the YouTubeService exists
**When** I implement a cron job for daily YouTube synchronization
**Then** the cron job runs automatically once per day
**And** the cron job calls YouTubeService for each configured creator
**And** the cron job stores the synchronization timestamp
**And** the cron job logs success or failure
**And** the cron job handles errors and retries up to 10 times
**And** failed synchronizations trigger Discord alerts

### Story 2.7: Implement Error Handling and Retry Logic with Discord Alerts

As a system administrator,
I want failed synchronizations to retry automatically and alert me via Discord,
So that I can quickly address any synchronization issues.

**Acceptance Criteria:**

**Given** synchronization services exist
**When** a synchronization fails
**Then** the system retries up to 10 times with exponential backoff
**And** if all retries fail, a Discord alert is sent
**And** the Discord alert includes error details and context
**And** the system continues operating with cached data
**And** users are not blocked by synchronization failures
**And** failed operations are logged for investigation

---

## Epic 3: Build Creation & Management

Permettre aux utilisateurs de créer, modifier et sauvegarder des builds complets avec calculs de statistiques en temps réel. Les utilisateurs peuvent sélectionner champion, items, runes, sorts d'invocateur, shards et définir l'ordre de montée des compétences. Les stats se mettent à jour instantanément lors des modifications.

### Story 3.1: Create Champion Selection Component

As a user,
I want to select a champion when creating a build,
So that I can start building for a specific champion.

**Acceptance Criteria:**

**Given** champion data is available from Epic 2
**When** I navigate to the build creation page
**Then** I see a list or searchable grid of all champions
**And** I can search champions by name
**And** I can filter champions by role (optional)
**And** when I select a champion, it is set as the build's champion
**And** the champion image and name are displayed
**And** the selection provides immediate visual feedback

### Story 3.2: Create Item Selection Component with Real-time Stats

As a user,
I want to select items for my build and see stats update in real-time,
So that I can optimize my build choices immediately.

**Acceptance Criteria:**

**Given** item data is available and a champion is selected
**When** I select items for my build
**Then** I can search and browse available items
**And** I can select up to 6 items (standard build)
**And** when I add or remove an item, statistics recalculate within 500ms
**And** I see updated stats (damage, resistances, attack speed, etc.) immediately
**And** selected items are visually distinct
**And** I can remove items by clicking them again

### Story 3.3: Create Rune Selection Component (Primary and Secondary Trees)

As a user,
I want to select primary and secondary rune trees for my build,
So that I can customize my champion's rune setup.

**Acceptance Criteria:**

**Given** rune data is available and a champion is selected
**When** I configure runes for my build
**Then** I can select a primary rune tree
**And** I can select a keystone rune from the primary tree
**And** I can select minor runes from the primary tree
**And** I can select a secondary rune tree
**And** I can select minor runes from the secondary tree
**And** rune selections update statistics in real-time (< 500ms)
**And** the UI clearly shows primary vs secondary trees

### Story 3.4: Create Rune Shard Selection Component

As a user,
I want to select rune shards (adaptive, armor, magic resist, etc.),
So that I can fine-tune my build's defensive and offensive stats.

**Acceptance Criteria:**

**Given** rune data is available and rune trees are selected
**When** I configure rune shards
**Then** I can select shards for the three shard slots
**And** each shard slot has appropriate options (adaptive force, armor, magic resist, health, etc.)
**And** shard selections update statistics in real-time (< 500ms)
**And** the UI clearly shows which shards are selected

### Story 3.5: Create Summoner Spell Selection Component

As a user,
I want to select summoner spells for my build,
So that I can specify the spells I'll use in-game.

**Acceptance Criteria:**

**Given** summoner spell data is available
**When** I configure summoner spells
**Then** I can select two summoner spells
**And** I cannot select the same spell twice
**And** all available summoner spells are displayed
**And** spell icons and names are clearly visible
**And** selected spells are visually distinct

### Story 3.6: Create Skill Order Configuration Component

As a user,
I want to define the skill upgrade order for my build,
So that I can specify the optimal ability leveling sequence.

**Acceptance Criteria:**

**Given** a champion is selected
**When** I configure the skill order
**Then** I can specify the order of ability upgrades from levels 1-18
**And** the UI shows all 18 levels clearly
**And** I can drag-and-drop or click to set ability priorities
**And** the skill order is validated (all 18 levels must have an ability)
**And** the UI shows ability icons for visual clarity

### Story 3.7: Implement Real-time Statistics Calculation Engine

As a user,
I want to see my build's statistics update instantly when I make changes,
So that I can make informed decisions about my build.

**Acceptance Criteria:**

**Given** a build with champion, items, runes, and spells selected
**When** I modify any component of the build
**Then** statistics recalculate within 500ms
**And** calculations include: damage, resistances, attack speed, health, mana, cooldown reduction, etc.
**And** calculations use official game formulas from Data Dragon/wiki
**And** calculations are performed client-side for optimal performance
**And** the UI shows a loading state during calculation (if > 100ms)
**And** calculated stats are displayed clearly with proper formatting

### Story 3.8: Implement Local Build Storage (localStorage)

As a user,
I want to save my builds locally in my browser,
So that I can access them later without losing my work.

**Acceptance Criteria:**

**Given** I have created or modified a build
**When** I click "Save Build"
**Then** the build is validated (champion selected, items/runes configured)
**And** if valid, the build is saved to localStorage
**And** the build is assigned a unique ID
**And** the build includes metadata (name, creation date, game version)
**And** I receive confirmation that the build was saved
**And** if validation fails, I see clear error messages

### Story 3.9: Implement Build Modification Functionality

As a user,
I want to modify an existing saved build,
So that I can update it with new items or runes.

**Acceptance Criteria:**

**Given** I have saved builds in localStorage
**When** I select a saved build to edit
**Then** the build loads with all its components (champion, items, runes, spells, skill order)
**And** I can modify any component of the build
**And** statistics update in real-time as I make changes
**And** when I save, the existing build is updated (not duplicated)
**And** I receive confirmation that the build was updated

### Story 3.10: Implement Build Deletion Functionality

As a user,
I want to delete saved builds I no longer need,
So that I can manage my build collection.

**Acceptance Criteria:**

**Given** I have saved builds in localStorage
**When** I choose to delete a build
**Then** I am prompted to confirm the deletion
**And** if I confirm, the build is removed from localStorage
**And** I receive confirmation that the build was deleted
**And** if I cancel, the build remains unchanged
**And** the UI updates immediately to reflect the deletion

### Story 3.11: Implement Build Validation Before Save

As a user,
I want my build to be validated before saving,
So that I don't accidentally save incomplete or invalid builds.

**Acceptance Criteria:**

**Given** I am creating or modifying a build
**When** I attempt to save the build
**Then** the system validates that a champion is selected
**And** the system validates that items are selected (at least 1, up to 6)
**And** the system validates that runes are configured (primary tree, keystone, secondary tree)
**And** the system validates that summoner spells are selected (2 spells)
**And** the system validates that skill order is complete (all 18 levels)
**And** if validation fails, I see specific error messages for missing components
**And** if validation passes, the build is saved successfully

---

## Epic 4: Build Discovery & Search

Permettre aux utilisateurs de rechercher et découvrir des builds existants rapidement. Les utilisateurs peuvent rechercher par champion, filtrer par rôle ou items, voir les détails complets, comparer plusieurs builds, et identifier les builds populaires ou récents.

### Story 4.1: Create Build Search Interface with Instant Results

As a user,
I want to search for builds by champion name with instant results,
So that I can quickly find builds for the champion I'm playing.

**Acceptance Criteria:**

**Given** there are saved builds in the system
**When** I type in the search bar
**Then** search results appear instantly (debounced 300ms)
**And** results filter by champion name matching my input
**And** results update as I type
**And** the search is case-insensitive
**And** I see a count of matching results
**And** if no results match, I see a helpful "no results" message

### Story 4.2: Create Build Filtering System (Version, Champion, Role)

As a user,
I want to filter builds by version, champion, and role,
So that I can find builds that match my specific needs.

**Acceptance Criteria:**

**Given** there are saved builds in the system
**When** I apply filters
**Then** I can toggle "À jour" (up-to-date) filter to show only current version builds
**And** I can filter by specific champion
**And** I can filter by role (top, jungle, mid, adc, support)
**And** filters work in combination (AND logic)
**And** filter changes update results instantly (debounced 300ms)
**And** active filters are visually indicated
**And** I can clear all filters with one action

### Story 4.3: Create Build Grid Display with Build Cards

As a user,
I want to see builds displayed in a grid of cards,
So that I can quickly browse and compare multiple builds visually.

**Acceptance Criteria:**

**Given** search/filter results are available
**When** I view the build listing page
**Then** builds are displayed in a responsive grid (1 col mobile, 2-3 tablet, 3-4 desktop)
**And** each build card shows: champion, items (all 6 visible), runes (keystone visible), role
**And** build cards are visually distinct and follow LoL design system
**And** the grid supports infinite scroll or pagination
**And** cards are clickable to view full details
**And** cards show hover effects for better UX

### Story 4.4: Create Build Details Page

As a user,
I want to view complete details of a build,
So that I can see all items, runes, spells, skill order, and stats.

**Acceptance Criteria:**

**Given** I am viewing a build card or have a build ID
**When** I click to view build details
**Then** I see a dedicated build details page
**And** the page shows: champion, all 6 items, complete rune setup, summoner spells, skill order
**And** the page shows calculated statistics for the build
**And** the page has a clear, organized layout
**And** I can navigate back to the build listing
**And** the page URL is SEO-friendly (e.g., `/builds/{champion}/{build-id}`)

### Story 4.5: Implement Build Comparison Feature

As a user,
I want to compare 2 or more builds side-by-side,
So that I can evaluate different build options.

**Acceptance Criteria:**

**Given** I am viewing build details or the build listing
**When** I select builds to compare
**Then** I can select 2-4 builds for comparison
**And** builds are displayed side-by-side in a comparison view
**And** comparison shows: items, runes, stats differences
**And** stat differences are highlighted (higher/lower values)
**And** I can add or remove builds from comparison
**And** the comparison view is responsive (stacks on mobile)

### Story 4.6: Implement Build Sorting (Popularity, Recent)

As a user,
I want to sort builds by popularity or recency,
So that I can find the most relevant builds quickly.

**Acceptance Criteria:**

**Given** there are saved builds in the system
**When** I view the build listing
**Then** I can sort builds by "Most Popular" (by view count or votes)
**And** I can sort builds by "Most Recent" (by creation date)
**And** the default sort is configurable (e.g., most recent)
**And** sort options are clearly visible and accessible
**And** sorting updates results instantly

### Story 4.7: Create Champion-Specific Build Listing Page

As a user,
I want to see all available builds for a specific champion,
So that I can browse options for my champion.

**Acceptance Criteria:**

**Given** there are builds saved for various champions
**When** I navigate to a champion's build page (e.g., `/champions/ahri/builds`)
**Then** I see all builds for that champion
**And** I can still apply filters (version, role) on this page
**And** I can sort by popularity or recency
**And** the page shows the champion name and image
**And** the page URL is SEO-friendly
**And** the page includes proper meta tags for SEO

---

## Epic 5: Theorycraft & Analysis

Fournir des outils avancés d'analyse et d'optimisation de builds. Les utilisateurs peuvent voir des statistiques détaillées, comprendre comment les stats changent lors des modifications, optimiser leurs builds, comparer les stats entre différents builds, et recevoir des recommandations d'amélioration.

### Story 5.1: Create Detailed Statistics Display Component

As a user,
I want to see detailed statistics for my build,
So that I can understand the full impact of my item and rune choices.

**Acceptance Criteria:**

**Given** a build with items and runes selected
**When** I view the statistics display
**Then** I see all calculated stats: damage (AD/AP), resistances (armor/magic resist), health, mana, attack speed, cooldown reduction, etc.
**And** stats are organized in logical groups (offensive, defensive, utility)
**And** stats show both base values and final calculated values
**And** I can toggle between "simple" and "detailed" views
**And** the detailed view shows stat breakdowns and sources
**And** stats update in real-time when I modify the build

### Story 5.2: Implement Real-time Stat Change Visualization

As a user,
I want to see how statistics change when I modify items or runes,
So that I can make informed decisions about build adjustments.

**Acceptance Criteria:**

**Given** I am viewing or editing a build
**When** I add, remove, or change an item or rune
**Then** statistics recalculate within 500ms
**And** changed stats are highlighted (e.g., green for increase, red for decrease)
**And** I can see the delta (difference) for each stat
**And** stat changes are animated smoothly
**And** the visualization is clear and not overwhelming

### Story 5.3: Create Build Optimization Suggestions

As a user,
I want to receive recommendations for improving my build,
So that I can optimize my build's effectiveness.

**Acceptance Criteria:**

**Given** I have a build with calculated statistics
**When** I view optimization suggestions
**Then** the system analyzes my current build
**And** the system suggests alternative items that might improve key stats
**And** suggestions are based on champion role and current build composition
**And** suggestions explain why they might be beneficial
**And** I can apply suggestions with one click
**And** suggestions are optional and don't force changes

### Story 5.4: Implement Advanced Statistics Analysis

As a user,
I want to see advanced analysis of my build's statistics,
So that I can understand build synergies and trade-offs.

**Acceptance Criteria:**

**Given** a build with calculated statistics
**When** I view advanced analysis
**Then** I see analysis of stat synergies (e.g., attack speed + on-hit items)
**And** I see analysis of stat balance (e.g., too much offense, not enough defense)
**And** I see power spikes (when build becomes strongest)
**And** I see weaknesses or gaps in the build
**And** analysis is presented in an understandable format
**And** analysis updates when I modify the build

### Story 5.5: Create Statistics Comparison Between Builds

As a user,
I want to compare statistics between different builds,
So that I can evaluate which build performs better in specific areas.

**Acceptance Criteria:**

**Given** I have 2 or more builds to compare
**When** I view statistics comparison
**Then** I see side-by-side stat comparison
**And** stats are aligned for easy comparison
**And** differences are highlighted (higher/lower values)
**And** I can see percentage differences
**And** comparison includes all major stats (damage, resistances, health, etc.)
**And** the comparison view is clear and scannable

---

## Epic 6: Content Management & YouTube Integration

Afficher et synchroniser automatiquement les vidéos YouTube des créateurs de contenu League of Legends. Les utilisateurs peuvent voir les vidéos organisées par créateur, et les administrateurs peuvent configurer la liste des créateurs à synchroniser.

### Story 6.1: Create YouTube Video Display Component

As a user,
I want to view YouTube videos from League of Legends content creators,
So that I can access educational and entertainment content.

**Acceptance Criteria:**

**Given** YouTube videos are synchronized (from Epic 2)
**When** I navigate to the videos section
**Then** I see a list of videos organized by content creator
**And** each video shows: thumbnail, title, creator name, publish date
**And** I can click a video to watch it (embedded or link to YouTube)
**And** videos are filtered to League of Legends relevance
**And** the UI follows the minimalist design system

### Story 6.2: Create Content Creator Organization View

As a user,
I want to see videos organized by content creator,
So that I can easily find videos from my favorite creators.

**Acceptance Criteria:**

**Given** YouTube videos are synchronized for multiple creators
**When** I view the videos section
**Then** videos are grouped by creator
**And** each creator section shows the creator's name and channel info
**And** I can expand/collapse creator sections
**And** I can see how many videos each creator has
**And** I can navigate directly to a specific creator's videos

### Story 6.3: Implement Admin Configuration for Content Creators

As an administrator,
I want to configure which content creators' videos should be synchronized,
So that I can control which creators appear on the platform.

**Acceptance Criteria:**

**Given** I have admin access (from Epic 8)
**When** I navigate to the creator configuration page
**Then** I can see the list of currently configured creators
**And** I can add a new creator by YouTube channel ID or username
**And** I can remove a creator from the synchronization list
**And** I can see the last synchronization date for each creator
**And** changes are saved and take effect on the next sync cycle
**And** I receive confirmation when creators are added/removed

### Story 6.4: Implement Automatic Video List Updates

As a user,
I want the video list to update automatically when new videos are published,
So that I always see the latest content without manual refresh.

**Acceptance Criteria:**

**Given** the YouTube synchronization cron job is running (from Epic 2)
**When** a content creator publishes a new video
**Then** the video is automatically added to the system within 24 hours
**And** the video appears in the creator's section
**And** new videos are marked or highlighted (optional)
**And** the video list updates without requiring user action
**And** users see the latest videos when they visit the videos section

---

## Epic 7: Build Sharing & Version Management

Permettre aux utilisateurs de partager leurs builds via des liens uniques et gérer les versions de builds. Les utilisateurs peuvent partager des builds, copier des builds depuis des liens partagés, et être alertés si un build utilise des données obsolètes. Le système archive automatiquement les builds créés avec d'anciennes versions.

### Story 7.1: Implement Build Sharing with Unique Links

As a user,
I want to share my build via a unique link,
So that I can share my build with friends or the community.

**Acceptance Criteria:**

**Given** I have created and saved a build
**When** I click "Share Build"
**Then** a unique UUID-based link is generated
**And** the link is displayed in a shareable format
**And** I can copy the link to clipboard with one click
**And** the link includes the build ID and is SEO-friendly
**And** I receive confirmation that the link was copied
**And** the link works without authentication

### Story 7.2: Create Shared Build View Page

As a user,
I want to view builds shared by others via links,
So that I can see and use builds created by the community.

**Acceptance Criteria:**

**Given** I have a shared build link
**When** I visit the link
**Then** I can view the complete build details (champion, items, runes, spells, skill order, stats)
**And** I can see the build without authentication
**And** I can copy the build to my own saved builds
**And** the page is SEO-optimized with proper meta tags
**And** the page URL is clean and shareable

### Story 7.3: Implement Build Copying from Shared Links

As a user,
I want to copy a shared build to my saved builds,
So that I can use and modify builds shared by others.

**Acceptance Criteria:**

**Given** I am viewing a shared build
**When** I click "Copy Build"
**Then** the build is copied to my localStorage as a new build
**And** I receive confirmation that the build was copied
**And** I am redirected to my builds or the build editor
**And** the copied build has a new unique ID
**And** I can modify the copied build independently

### Story 7.4: Implement Outdated Build Warning System

As a user,
I want to be warned when viewing a build that uses outdated game data,
So that I know the build might not be optimal for the current patch.

**Acceptance Criteria:**

**Given** a build was created with an old game version
**When** I view the build (shared or saved)
**Then** I see a warning banner indicating the build uses outdated data
**And** the warning shows which game version the build was created for
**And** the warning shows the current game version
**And** the warning is visually distinct but not intrusive
**And** I can dismiss the warning (optional)

### Story 7.5: Implement Automatic Build Archiving

As a system,
I want to automatically archive builds created with old game versions,
So that the system maintains data integrity while preserving historical builds.

**Acceptance Criteria:**

**Given** builds exist with various game versions
**When** a new game version is detected
**Then** builds created with versions older than the current are marked as archived
**And** archived builds are still accessible
**And** archived builds show the warning banner
**And** the archiving process runs automatically
**And** archiving doesn't delete builds, only marks them

### Story 7.6: Implement Build Version Update Functionality

As a user,
I want to update an outdated build to use current game version data,
So that I can modernize old builds without recreating them.

**Acceptance Criteria:**

**Given** I am viewing an outdated build
**When** I click "Update to Current Version"
**Then** the system attempts to migrate the build to current version
**And** items/runes that no longer exist are replaced with closest equivalents or removed
**And** the build's version metadata is updated
**And** I receive confirmation of the update
**And** if migration fails, I see clear error messages
**And** the updated build is saved as a new version (or updates existing)

### Story 7.7: Implement Build Version Compatibility System

As a system,
I want to maintain compatibility information for builds across versions,
So that builds can be properly migrated and displayed.

**Acceptance Criteria:**

**Given** builds exist across multiple game versions
**When** the system needs to handle version differences
**Then** the system tracks which items/runes existed in which versions
**And** the system can map old items/runes to new equivalents
**And** the system maintains a compatibility matrix
**And** migration logic uses this compatibility information
**And** the system handles edge cases (items removed, items changed)

---

## Epic 8: Administration & Monitoring

Fournir un dashboard d'administration avec monitoring complet du système. Les administrateurs peuvent voir les métriques d'utilisation, surveiller l'état des cron jobs, consulter les performances système, recevoir des alertes Discord en cas d'erreur, et accéder aux analytics détaillées via Matomo.

### Story 8.1: Create Admin Dashboard Page with Basic Authentication

As an administrator,
I want to access a secure admin dashboard,
So that I can monitor and manage the system.

**Acceptance Criteria:**

**Given** I am an administrator
**When** I navigate to the admin URL (configured in .env)
**Then** I am prompted for basic authentication (username/password from .env)
**And** upon successful authentication, I access the admin dashboard
**And** the dashboard is not accessible to regular users
**And** authentication is secure (HTTPS required)
**And** failed login attempts are logged

### Story 8.2: Display Build Creation Metrics

As an administrator,
I want to see metrics about build creation,
So that I can understand platform usage.

**Acceptance Criteria:**

**Given** I have access to the admin dashboard
**When** I view the dashboard
**Then** I see total number of builds created (all time)
**And** I see number of builds created today
**And** I see number of builds created this week
**And** metrics are displayed clearly with appropriate visualizations
**And** metrics update in real-time or on refresh

### Story 8.3: Display User Activity Metrics

As an administrator,
I want to see metrics about user activity,
So that I can understand how many users are actively using the platform.

**Acceptance Criteria:**

**Given** I have access to the admin dashboard
**When** I view the dashboard
**Then** I see number of active users (defined by recent activity, e.g., last 7 days)
**And** I see user activity trends (optional: charts)
**And** metrics help me understand platform growth
**And** metrics are displayed clearly

### Story 8.4: Display Cron Job Status and Execution History

As an administrator,
I want to see the status of all cron jobs,
So that I can ensure automated tasks are running correctly.

**Acceptance Criteria:**

**Given** I have access to the admin dashboard
**When** I view the cron jobs section
**Then** I see status of each cron job (Data Dragon sync, YouTube sync, cache maintenance)
**And** I see when each cron job last executed successfully
**And** I see when each cron job last failed (if applicable)
**And** I see execution history (last 10 runs) for each job
**And** failed jobs are highlighted
**And** I can see error messages for failed jobs

### Story 8.5: Display System Performance Metrics

As an administrator,
I want to see system performance metrics,
So that I can identify performance issues early.

**Acceptance Criteria:**

**Given** I have access to the admin dashboard
**When** I view the performance section
**Then** I see system uptime
**And** I see average API response time
**And** I see error rate (percentage of failed requests)
**And** I see request volume trends
**And** metrics are displayed with appropriate visualizations
**And** metrics help identify performance degradation

### Story 8.6: Implement Discord Alert Integration for System Errors

As an administrator,
I want to receive Discord alerts when system errors occur,
So that I can quickly respond to critical issues.

**Acceptance Criteria:**

**Given** the system is running
**When** a critical error occurs (synchronization failure, API error, etc.)
**Then** a Discord message is sent to the configured channel
**And** the message includes error details, timestamp, and context
**And** alerts are sent immediately (not batched)
**And** alerts are formatted clearly for quick understanding
**And** non-critical errors don't trigger alerts (configurable threshold)

### Story 8.7: Integrate Matomo Analytics Access

As an administrator,
I want to access detailed analytics through Matomo,
So that I can analyze user behavior and platform usage in depth.

**Acceptance Criteria:**

**Given** Matomo is configured for the platform
**When** I view the analytics section in the admin dashboard
**Then** I can access Matomo analytics (embedded or link)
**And** Matomo tracking is properly configured
**And** analytics respect cookie consent (from Epic 9)
**And** I can see detailed user behavior data
**And** analytics help inform product decisions

---

## Epic 9: UX, Accessibility & SEO

Fournir une expérience utilisateur optimale, accessible et découvrable. L'application est responsive (mobile-first), accessible (WCAG 2.1 Level AA), multilingue (FR/EN), et optimisée pour le SEO. Les utilisateurs peuvent naviguer au clavier, utiliser des lecteurs d'écran, et comprendre la gestion des données via consentement cookies.

### Story 9.1: Implement Mobile-First Responsive Design

As a user,
I want to access the application from my mobile device with an optimized interface,
So that I can use the platform on any device.

**Acceptance Criteria:**

**Given** I access the application from a mobile device
**When** I view any page
**Then** the layout adapts to mobile screen sizes
**And** touch targets are at least 44x44 pixels
**And** text is readable without zooming
**And** navigation is mobile-friendly
**And** performance is within 10% of desktop performance
**And** the design follows mobile-first principles (starts with mobile, enhances for larger screens)

### Story 9.2: Implement Complete Keyboard Navigation

As a user,
I want to navigate the entire application using only my keyboard,
So that I can use the platform efficiently without a mouse.

**Acceptance Criteria:**

**Given** I am using keyboard navigation
**When** I navigate through the application
**Then** all interactive elements are accessible via Tab key
**And** Tab order follows visual reading order (left-to-right, top-to-bottom)
**And** focus indicators are clearly visible
**And** I can activate buttons/links with Enter/Space
**And** I can close modals with Escape
**And** keyboard shortcuts don't conflict with browser shortcuts
**And** all functionality is accessible via keyboard

### Story 9.3: Implement Screen Reader Support (WCAG 2.1 Level AA)

As a user with a screen reader,
I want to access all application features via my screen reader,
So that I can use the platform regardless of my abilities.

**Acceptance Criteria:**

**Given** I am using a screen reader
**When** I navigate the application
**Then** all images have descriptive alt text
**And** form inputs have associated labels
**And** ARIA labels and roles are used appropriately
**And** dynamic content updates are announced
**And** the page structure is semantic (header, nav, main, footer)
**And** the application is fully usable with screen readers
**And** color contrast meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)

### Story 9.4: Implement French and English Internationalization

As a user,
I want to access the application in my preferred language (French or English),
So that I can use the platform comfortably.

**Acceptance Criteria:**

**Given** the application supports i18n
**When** I select my language preference
**Then** all UI text is displayed in my selected language
**And** I can switch between French and English
**And** my language preference is saved (localStorage or cookie)
**And** URLs can include language prefix (optional: /fr/, /en/)
**And** content is properly translated (no hardcoded strings)

### Story 9.5: Implement Cookie Consent Banner (RGPD Compliance)

As a user,
I want to understand and control what data is collected,
So that I can make informed decisions about my privacy.

**Acceptance Criteria:**

**Given** I visit the application for the first time
**When** the page loads
**Then** I see a cookie consent banner
**And** the banner explains what data is collected (localStorage, Matomo analytics)
**And** I can accept or reject cookies
**And** my choice is saved and respected
**And** the banner can be dismissed but reappears if I haven't made a choice
**And** the banner follows RGPD requirements

### Story 9.6: Implement Privacy Policy and Data Usage Information

As a user,
I want to understand how my data is used,
So that I can trust the platform with my information.

**Acceptance Criteria:**

**Given** I want to understand data usage
**When** I view the privacy policy
**Then** I see clear explanation of what data is collected
**And** I see how data is used (localStorage for builds, Matomo for analytics)
**And** I see that no personal data is stored on servers
**And** I see information about cookie usage
**And** the privacy policy is accessible from the cookie banner and footer
**And** the policy is written in clear, understandable language

### Story 9.7: Implement SEO Optimization (Sitemap, Robots.txt, Meta Tags)

As a search engine,
I want to properly index the application's pages,
So that users can discover the platform via search.

**Acceptance Criteria:**

**Given** the application has public pages
**When** search engines crawl the site
**Then** `sitemap.xml` is accessible and includes all indexable pages
**And** `robots.txt` is properly configured
**And** each page has appropriate meta tags (title, description, Open Graph)
**And** meta tags are unique per page
**And** structured data (JSON-LD) is included for better indexing
**And** admin pages are excluded from indexing

### Story 9.8: Implement SEO-Friendly URLs for Builds and Champions

As a user and search engine,
I want URLs to be descriptive and SEO-friendly,
So that pages are easily discoverable and shareable.

**Acceptance Criteria:**

**Given** I am viewing a build or champion page
**When** I look at the URL
**Then** build pages have URLs like `/builds/{champion-name}/{build-id}` or `/builds/{build-id}`
**And** champion pages have URLs like `/champions/{champion-name}`
**And** URLs use lowercase and hyphens (not underscores or spaces)
**And** URLs are human-readable
**And** URLs work without query parameters for core content
**And** URLs are properly canonicalized

### Story 9.9: Implement Accessibility Color Contrast and Visual Indicators

As a user,
I want the interface to have sufficient color contrast and clear visual indicators,
So that I can use the platform regardless of visual abilities.

**Acceptance Criteria:**

**Given** I am viewing any page
**When** I examine the interface
**Then** text color contrast meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
**And** interactive elements have clear visual states (hover, focus, active)
**And** focus indicators are visible and distinct
**And** error states are indicated by more than just color (also icons/text)
**And** the interface works in grayscale (information not conveyed only by color)
**And** animations respect `prefers-reduced-motion` setting

### Story 9.10: Implement Progressive Enhancement and Browser Compatibility

As a user,
I want the application to work on my browser,
So that I can access the platform regardless of my browser choice.

**Acceptance Criteria:**

**Given** I am using a modern browser (Chrome, Firefox, Safari, Edge)
**When** I access the application
**Then** all core functionality works
**And** the application degrades gracefully on older browsers
**And** JavaScript is required but the application handles JS errors gracefully
**And** the application works with JavaScript disabled for basic content (progressive enhancement)
**And** browser-specific issues are handled
**And** the application is tested on major browsers
