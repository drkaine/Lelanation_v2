# Technology Stack Analysis

## Backend (TypeScript/Express/Redis)

### Core Technologies
| Category | Technology | Version | Justification |
|----------|-----------|---------|---------------|
| Runtime | Node.js | 18+ | JavaScript runtime |
| Language | TypeScript | 5.6.3 | Type-safe JavaScript |
| Framework | Express.js | 4.21.1 | Web application framework |
| Cache | Redis | 5.0.1 | In-memory data store |
| Task Scheduler | node-cron | 3.0.3 | Cron job scheduling |

### Key Dependencies
- **compression**: HTTP response compression
- **cors**: Cross-Origin Resource Sharing
- **multer**: File upload handling
- **xlsx-js-style**: Excel file processing
- **dotenv**: Environment variable management

### Development Tools
- **Jest**: Testing framework
- **supertest**: HTTP assertion library
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type checking

### Architecture Pattern
- **Service-Oriented Architecture**: Business logic organized in services
- **Middleware Pattern**: Express middleware for caching, CORS, compression
- **RESTful API**: REST endpoints for data operations

## Frontend (Vue 3/Vite)

### Core Technologies
| Category | Technology | Version | Justification |
|----------|-----------|---------|---------------|
| Framework | Vue 3 | 3.5.12 | Progressive JavaScript framework |
| Language | TypeScript | ~5.5.4 | Type-safe JavaScript |
| Build Tool | Vite | 6.3.5 | Next-generation frontend tooling |
| State Management | Pinia | 2.2.4 | Vue state management |
| Routing | Vue Router | 4.4.5 | Client-side routing |
| Internationalization | vue-i18n | 12.0.0-alpha.2 | Multi-language support |

### Key Dependencies
- **axios**: HTTP client
- **chart.js**: Data visualization
- **vue-chartjs**: Vue wrapper for Chart.js
- **dom-to-image-more**: DOM to image conversion
- **html2canvas**: HTML to canvas rendering
- **vuedraggable**: Drag and drop functionality
- **uuid**: Unique identifier generation
- **@iconify/vue**: Icon library
- **@vue-office/excel**: Excel file handling
- **workbox-***: Service worker caching strategies

### Development Tools
- **Vitest**: Unit testing framework
- **Playwright**: End-to-end testing
- **Vue DevTools**: Development debugging
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **vue-tsc**: TypeScript type checking for Vue

### Architecture Pattern
- **Component-Based Architecture**: Reusable Vue components
- **Single Page Application (SPA)**: Client-side routing
- **Progressive Web App (PWA)**: Service worker for offline support
- **State Management**: Centralized state with Pinia stores

## Project Structure

### Backend Services
- `AnalyticsService.ts`: Analytics data management
- `AssetService.ts`: Asset file management
- `BuildService.ts`: Build creation and management
- `ContactService.ts`: Contact form handling
- `DictionnaireService.ts`: Dictionary/translation management
- `TierListService.ts`: Tier list upload and management
- `YoutubeService.ts`: YouTube video integration

### Frontend Views
- `HomeView.vue`: Landing page
- `BuildToolView.vue`: Build configuration tool
- `BuildRecapView.vue`: Build summary/review
- `ChampionView.vue`: Champion information
- `StatistiqueView.vue`: Statistics dashboard
- `DictionnaireView.vue`: Dictionary interface
- `ItemsView.vue`: Items catalog
- `RunesView.vue`: Runes interface
- `CommuBuildsView.vue`: Community builds
- `MesBuildsView.vue`: User builds
- `AdminView.vue`: Admin panel
- `LegalView.vue`: Legal information

## Integration Points
- **REST API**: Frontend communicates with backend via `/api/*` endpoints
- **Proxy Configuration**: Vite dev server proxies API requests to backend
- **Caching Strategy**: Redis cache on backend, HTTP cache headers, Service Worker cache on frontend
