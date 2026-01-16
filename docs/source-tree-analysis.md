# Source Tree Analysis

## Project Structure Overview

```
/home/ubuntu/dev/Lelanation/
├── backend/              # Backend API (TypeScript/Express/Redis)
│   ├── src/
│   │   ├── app.ts       # Main application entry point
│   │   ├── config/      # Configuration files
│   │   ├── Cron.ts      # Cron job definitions
│   │   ├── DdragonAPI.ts # Riot Games Data Dragon API client
│   │   ├── FileManager.ts # File operations utilities
│   │   ├── OdsToJson.ts  # ODS to JSON conversion
│   │   ├── middleware/   # Express middleware
│   │   │   ├── cacheMiddleware.ts
│   │   │   ├── cacheMonitoringMiddleware.ts
│   │   │   └── httpCacheMiddleware.ts
│   │   ├── service/      # Business logic services
│   │   │   ├── AnalyticsService.ts
│   │   │   ├── AssetService.ts
│   │   │   ├── BuildService.ts
│   │   │   ├── ContactService.ts
│   │   │   ├── DictionnaireService.ts
│   │   │   ├── TierListService.ts
│   │   │   └── YoutubeService.ts
│   │   ├── scripts/      # Utility scripts
│   │   │   ├── redisCacheMaintenance.ts
│   │   │   └── cleanYoutubeJson.ts
│   │   ├── types.ts      # TypeScript type definitions
│   │   └── utils/        # Utility functions
│   │       ├── redisClient.ts
│   │       └── serverUtils.ts
│   ├── docs/             # Backend documentation
│   │   ├── REDIS.md
│   │   └── CACHE_DEPLOYMENT.md
│   ├── __tests__/        # Test files
│   ├── package.json
│   ├── tsconfig.json
│   └── jest.config.js
│
├── frontend/             # Frontend SPA (Vue 3/Vite)
│   ├── src/
│   │   ├── main.ts      # Application entry point
│   │   ├── App.vue      # Root component
│   │   ├── assets/       # Static assets (CSS, images)
│   │   ├── components/   # Vue components
│   │   │   ├── Admin/    # Admin components
│   │   │   ├── composants/ # Build-related components
│   │   │   │   ├── BuildRecap.vue
│   │   │   │   ├── SheetBuild.vue
│   │   │   │   ├── SkillUp.vue
│   │   │   │   ├── ExtraInfo.vue
│   │   │   │   ├── MenuBuild.vue
│   │   │   │   ├── InfosBuild.vue
│   │   │   │   └── StatistiquesBuild.vue
│   │   │   ├── Tooltip/  # Tooltip components
│   │   │   │   ├── ChampionTooltip.vue
│   │   │   │   └── ItemTooltip.vue
│   │   │   ├── Selection/ # Selection components
│   │   │   ├── Modal/    # Modal components
│   │   │   ├── home/     # Home page components
│   │   │   ├── script/   # Script components
│   │   │   ├── AlphabetNavigation.vue
│   │   │   ├── DictionaryPagination.vue
│   │   │   ├── FooterComponent.vue
│   │   │   ├── LanguageSwitcher.vue
│   │   │   └── MetaTags.vue
│   │   ├── views/         # Route views (pages)
│   │   │   ├── HomeView.vue
│   │   │   ├── BuildToolView.vue
│   │   │   ├── BuildRecapView.vue
│   │   │   ├── ChampionView.vue
│   │   │   ├── StatistiqueView.vue
│   │   │   ├── DictionnaireView.vue
│   │   │   ├── DictionnairePropositionView.vue
│   │   │   ├── ItemsView.vue
│   │   │   ├── RunesView.vue
│   │   │   ├── CommuBuildsView.vue
│   │   │   ├── MesBuildsView.vue
│   │   │   ├── ConnexionBuildView.vue
│   │   │   ├── ShortView.vue
│   │   │   ├── AdminView.vue
│   │   │   └── LegalView.vue
│   │   ├── router/       # Vue Router configuration
│   │   │   └── index.ts
│   │   ├── stores/        # Pinia stores (state management)
│   │   │   ├── buildStore.ts
│   │   │   ├── championStore.ts
│   │   │   ├── connexionStore.ts
│   │   │   ├── gameVersionStore.ts
│   │   │   ├── itemStore.ts
│   │   │   ├── roleStore.ts
│   │   │   ├── runeStore.ts
│   │   │   ├── shardStore.ts
│   │   │   ├── stepStore.ts
│   │   │   └── summonerStore.ts
│   │   ├── composables/   # Vue composables
│   │   ├── i18n/          # Internationalization
│   │   │   └── index.ts
│   │   ├── types/         # TypeScript type definitions
│   │   │   └── index.ts
│   │   ├── utils/         # Utility functions
│   │   ├── service-worker.ts # PWA service worker
│   │   ├── i18nCompat.ts  # i18n compatibility layer
│   │   └── i18nDebug.ts   # i18n debugging utilities
│   ├── public/            # Public static assets
│   ├── dist/              # Build output
│   ├── e2e/               # End-to-end tests (Playwright)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── README.md
│
├── load-test/             # Load testing scripts (k6)
│   ├── loadtest.js
│   ├── api-loadtest.js
│   ├── build-creation-loadtest.js
│   ├── redis-benchmark.js
│   ├── run-load-tests.sh
│   └── README.md
│
└── script/                # Utility scripts
    └── compare_translations.js
```

## Critical Directories

### Backend

#### `backend/src/service/`
**Purpose**: Business logic layer
- Contains all service classes that handle domain-specific operations
- Each service corresponds to a major feature area (builds, analytics, etc.)

#### `backend/src/middleware/`
**Purpose**: Express middleware for cross-cutting concerns
- Cache management
- Cache monitoring
- HTTP cache headers

#### `backend/src/utils/`
**Purpose**: Shared utility functions
- Redis client management
- Server health utilities

#### `backend/src/scripts/`
**Purpose**: Maintenance and utility scripts
- Redis cache maintenance
- Data cleanup scripts

### Frontend

#### `frontend/src/views/`
**Purpose**: Route-level page components
- Each view corresponds to a route in the router
- Main entry points for user interactions

#### `frontend/src/components/`
**Purpose**: Reusable UI components
- Organized by feature/domain
- Shared across multiple views

#### `frontend/src/stores/`
**Purpose**: State management (Pinia stores)
- Centralized application state
- One store per domain (builds, champions, items, etc.)

#### `frontend/src/router/`
**Purpose**: Client-side routing configuration
- Defines all application routes
- Route guards and navigation logic

## Entry Points

### Backend
- **Main Entry**: `backend/src/app.ts`
  - Initializes Express server
  - Configures middleware
  - Sets up routes
  - Starts cron jobs
  - Connects to Redis

### Frontend
- **Main Entry**: `frontend/src/main.ts`
  - Initializes Vue application
  - Configures Pinia stores
  - Sets up Vue Router
  - Configures i18n
  - Registers service worker (PWA)

## Integration Points

### Frontend → Backend
- API calls via axios to `/api/*` endpoints
- Vite dev server proxies API requests during development
- Production: Frontend served statically, API calls to backend server

### Data Flow
1. Frontend stores (Pinia) → API calls → Backend services
2. Backend services → Redis cache → File system (for builds)
3. Backend services → External APIs (Riot Games Data Dragon)

## File Storage

### Builds
- Location: `frontend/public/assets/files/build/`
- Format: JSON files
- Structure: Regular builds and Lelariva builds (subfolder)

### Static Assets
- Location: `frontend/public/`
- Served directly by frontend or backend (if `SERVE_STATIC=true`)
