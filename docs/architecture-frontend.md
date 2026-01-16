# Architecture - Frontend

## Executive Summary

The Lelanation frontend is a Vue 3 Single Page Application (SPA) built with Vite, using Pinia for state management and Vue Router for navigation. It features a Progressive Web App (PWA) with service worker support, internationalization (i18n), and a component-based architecture optimized for mobile-first design.

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Vue 3 | 3.5.12 | Progressive JavaScript framework |
| Language | TypeScript | ~5.5.4 | Type-safe development |
| Build Tool | Vite | 6.3.5 | Next-generation frontend tooling |
| State Management | Pinia | 2.2.4 | Vue state management |
| Routing | Vue Router | 4.4.5 | Client-side routing |
| i18n | vue-i18n | 12.0.0-alpha.2 | Multi-language support |

## Architecture Pattern

**Component-Based Single Page Application (SPA)**
- Reusable Vue components
- Client-side routing
- Centralized state management
- Progressive Web App (PWA) capabilities

## System Architecture

### Application Entry Point
- **File**: `src/main.ts`
- **Responsibilities**:
  - Vue application initialization
  - Pinia store registration
  - Vue Router setup
  - i18n configuration
  - Service worker registration (PWA)

### Component Architecture

#### Views (Pages)
Located in `src/views/`, each view corresponds to a route:

1. **HomeView.vue**: Landing page
2. **BuildToolView.vue**: Build configuration tool
3. **BuildRecapView.vue**: Build summary/review
4. **ChampionView.vue**: Champion information display
5. **StatistiqueView.vue**: Statistics dashboard
6. **DictionnaireView.vue**: Dictionary interface
7. **DictionnairePropositionView.vue**: Dictionary proposal submission
8. **ItemsView.vue**: Items catalog
9. **RunesView.vue**: Runes interface
10. **CommuBuildsView.vue**: Community builds browser
11. **MesBuildsView.vue**: User's saved builds
12. **ConnexionBuildView.vue**: Build connection/sharing view
13. **ShortView.vue**: Short content view
14. **AdminView.vue**: Admin panel
15. **LegalView.vue**: Legal information

#### Components
Located in `src/components/`, organized by feature:

- **composants/**: Build-related components
  - BuildRecap.vue, SheetBuild.vue, SkillUp.vue
  - ExtraInfo.vue, MenuBuild.vue, InfosBuild.vue
  - StatistiquesBuild.vue
- **Tooltip/**: Tooltip components
  - ChampionTooltip.vue, ItemTooltip.vue
- **Selection/**: Selection components
- **Modal/**: Modal dialogs
- **Admin/**: Admin-specific components
- **home/**: Home page components
- **script/**: Script/calculation components
- **Shared**: AlphabetNavigation.vue, DictionaryPagination.vue
- **UI**: FooterComponent.vue, LanguageSwitcher.vue, MetaTags.vue

### State Management (Pinia Stores)

Located in `src/stores/`, one store per domain:

1. **buildStore.ts**: Build creation, editing, saving
2. **championStore.ts**: Champion selection and data
3. **connexionStore.ts**: Build connection/sharing
4. **gameVersionStore.ts**: Game version management
5. **itemStore.ts**: Items data and selection
6. **roleStore.ts**: Role/champion role data
7. **runeStore.ts**: Runes data and selection
8. **shardStore.ts**: Shard data
9. **stepStore.ts**: Build step management
10. **summonerStore.ts**: Summoner spells data

### Routing

**File**: `src/router/index.ts`

**Routes**:
- `/`: Home
- `/build`: Build tool (create)
- `/build/edit`: Build tool (edit mode)
- `/builds`: User builds
- `/builds-publics`: Community builds
- `/:name`: Build connection/sharing
- `/dictionnaire`: Dictionary
- `/dictionnaire/proposition`: Dictionary proposal
- `/champion/:name`: Champion view
- `/items`: Items view
- `/runes`: Runes view
- `/statistiques`: Statistics
- `/admin`: Admin panel
- `/legal`: Legal information

### Internationalization (i18n)

**File**: `src/i18n/index.ts`

**Supported Languages**:
- French (default)
- English

**Features**:
- Dynamic locale switching
- Lazy-loaded translations
- Compatibility layer for legacy code
- Debug utilities

**Translation Files**: Located in `src/i18n/locales/`

### Data Architecture

#### Data Sources
1. **Static JSON Files**: Located in `src/assets/files/data/`
   - Champion data (`championFull.json`)
   - Items data (`item.json`)
   - Runes data (`runesReforged.json`)
   - Summoner spells (`summoner.json`)
   - Map data (`map.json`)
   - Multi-language support (FR/EN)

2. **API Integration**: Backend REST API
   - Builds: `/api/builds`, `/api/build/:fileName`
   - Analytics: `/api/analytics`
   - Dictionary: `/api/dictionnaire`
   - Tier lists: `/api/tierlist/*`

3. **Local Storage**: User builds stored in browser localStorage

#### Data Flow
1. **Initial Load**: Static JSON files loaded into stores
2. **User Actions**: API calls to backend for builds/analytics
3. **Build Creation**: Local calculation → API save
4. **Caching**: Service worker caches API responses

### Build System (Vite)

**Configuration**: `vite.config.ts`

**Features**:
- Code splitting by feature (vue-i18n, champion data, locales)
- Asset optimization (images, CSS)
- Source maps for debugging
- Proxy configuration for API during development
- Build target: ES2020

**Build Output**:
- `dist/`: Production build
- Optimized chunks
- Hashed filenames for cache busting

### Progressive Web App (PWA)

**Service Worker**: `src/service-worker.ts`

**Features**:
- Offline support
- Cache strategies (Workbox)
- Automatic cache updates
- Build ID-based cache invalidation

**Workbox Modules**:
- `workbox-precaching`: Pre-cache static assets
- `workbox-routing`: Route-based caching
- `workbox-strategies`: Cache strategies (stale-while-revalidate)
- `workbox-cacheable-response`: Response validation
- `workbox-expiration`: Cache expiration

### UI/UX Architecture

#### Design System
- **Style**: Clean, minimalist, League of Legends themed
- **Approach**: Mobile-first responsive design
- **Components**: Reusable, composable Vue components
- **State**: Centralized with Pinia stores

#### Key UI Features
- **Tooltips**: Champion and item tooltips
- **Modals**: Dialog components for interactions
- **Navigation**: Alphabet-based navigation for lists
- **Pagination**: Dictionary pagination
- **Language Switcher**: i18n language selection

### API Integration

**HTTP Client**: Axios

**Configuration**:
- Base URL: `/api` (proxied to backend in dev)
- Request/response interceptors
- Error handling

**Endpoints Used**:
- Builds: Create, read, update, delete
- Analytics: Save and retrieve
- Dictionary: CRUD operations
- Tier lists: Upload and manage
- Assets: List files

### Testing

**Unit Tests**: Vitest
- Test files: `*.spec.ts`, `*.test.ts`
- Location: `src/**/__tests__/`

**E2E Tests**: Playwright
- Test files: `e2e/**/*.spec.ts`
- Configuration: `playwright.config.ts`

### Development Workflow

**File Structure**:
```
frontend/
├── src/
│   ├── main.ts            # Entry point
│   ├── App.vue           # Root component
│   ├── assets/           # Static assets
│   ├── components/       # Vue components
│   ├── views/            # Route views
│   ├── stores/           # Pinia stores
│   ├── router/           # Vue Router
│   ├── composables/      # Vue composables
│   ├── i18n/             # Internationalization
│   ├── types/            # TypeScript types
│   └── utils/            # Utilities
├── public/               # Public assets
├── dist/                 # Build output
└── e2e/                  # E2E tests
```

**Development Commands**:
- `npm run dev`: Development server
- `npm run build`: Production build
- `npm run test:unit`: Unit tests
- `npm run test:e2e`: E2E tests
- `npm run lint`: Code linting
- `npm run format`: Code formatting

## Scalability Considerations

### Current Architecture
- Client-side rendering (SPA)
- Static asset optimization
- Service worker caching
- Code splitting

### Performance Optimizations
- Lazy-loaded routes
- Code splitting by feature
- Image optimization
- CSS optimization
- Service worker caching strategies

### Future Improvements Needed
- Server-side rendering (SSR) for SEO
- Image CDN integration
- Advanced caching strategies
- Bundle size optimization
- Performance monitoring

## Dependencies

### Production Dependencies
- vue, vue-router, pinia
- axios, chart.js, vue-chartjs
- vue-i18n, uuid
- dom-to-image-more, html2canvas
- vuedraggable, @iconify/vue
- workbox-* (PWA)

### Development Dependencies
- vite, @vitejs/plugin-vue
- typescript, vue-tsc
- vitest, @vue/test-utils
- playwright
- eslint, prettier
