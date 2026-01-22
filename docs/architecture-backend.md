# Architecture - Backend

## Executive Summary

The Lelanation backend is a TypeScript/Express.js REST API server with Redis caching. It provides endpoints for build management, analytics, dictionary/translation management, tier lists, and YouTube video integration. The architecture follows a service-oriented pattern with middleware for caching and monitoring.

## Technology Stack

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Runtime | Node.js | 18+ | JavaScript runtime |
| Language | TypeScript | 5.6.3 | Type-safe development |
| Framework | Express.js | 4.21.1 | Web application framework |
| Cache | Redis | 5.0.1 | In-memory caching |
| Task Scheduler | node-cron | 3.0.3 | Scheduled tasks |

## Architecture Pattern

**Service-Oriented Architecture (SOA)**
- Business logic organized in service classes
- Express middleware for cross-cutting concerns
- RESTful API design
- Stateless request handling

## System Architecture

### Application Entry Point
- **File**: `src/app.ts`
- **Responsibilities**:
  - Express server initialization
  - Middleware configuration
  - Route registration
  - Cron job scheduling
  - Redis connection management

### Service Layer

Services handle business logic for specific domains:

1. **BuildService** (`src/service/BuildService.ts`)
   - Build creation, update, deletion
   - Build retrieval (regular and Lelariva)
   - File-based storage in `frontend/public/assets/files/build/`

2. **AnalyticsService** (`src/service/AnalyticsService.ts`)
   - Analytics data collection and retrieval
   - Short-lived cache (60s TTL)

3. **DictionnaireService** (`src/service/DictionnaireService.ts`)
   - Dictionary/translation management
   - Approval/rejection workflow
   - Long-lived cache (3600s TTL)

4. **ContactService** (`src/service/ContactService.ts`)
   - Contact form handling
   - Message storage and retrieval

5. **TierListService** (`src/service/TierListService.ts`)
   - Tier list file upload (ODS format)
   - File management (delete, toggle visibility)
   - Medium-lived cache (1800s TTL)

6. **AssetService** (`src/service/AssetService.ts`)
   - Asset file listing and management

7. **YoutubeService** (`src/service/YoutubeService.ts`)
   - YouTube video integration
   - Content creator management

8. **ImageService** (`src/services/ImageService.ts`)
   - Downloads game images from Data Dragon
   - Manages image storage and cleanup
   - Deletes old version images

9. **StaticAssetsService** (`src/services/StaticAssetsService.ts`)
   - Copies game data and images to frontend public directory
   - Copies YouTube data to frontend public directory
   - Deletes backend data after successful copy
   - Manages old version cleanup
   - Restarts frontend PM2 process

### Middleware Layer

1. **cacheMiddleware** (`src/middleware/cacheMiddleware.ts`)
   - Redis-based response caching
   - Configurable TTL per endpoint
   - Cache invalidation on mutations

2. **httpCacheMiddleware** (`src/middleware/httpCacheMiddleware.ts`)
   - HTTP cache headers
   - Different strategies for static assets vs API responses
   - Stale-while-revalidate support

3. **cacheMonitoringMiddleware** (`src/middleware/cacheMonitoringMiddleware.ts`)
   - Cache hit/miss metrics
   - Performance monitoring
   - Metrics endpoint (`/api/metrics/cache`)

### Utility Layer

1. **redisClient** (`src/utils/redisClient.ts`)
   - Redis connection management
   - Automatic reconnection logic
   - Health monitoring

2. **serverUtils** (`src/utils/serverUtils.ts`)
   - Server health checks
   - Redis status monitoring

### External Integrations

1. **DdragonAPI** (`src/DdragonAPI.ts`)
   - Riot Games Data Dragon API client
   - Version checking
   - Data synchronization (champions, items, runes, summoners, maps)
   - Multi-language support (FR, EN)

2. **Cron Jobs** (`src/Cron.ts`)
   - Daily data compilation (04:00)
   - Hourly data compilation
   - Daily execution (02:00)
   - Redis cache maintenance (04:00)

## Data Architecture

### Static-First Architecture

The backend implements a **static-first architecture** for optimal scalability:

1. **Sync Phase**: Data is synced from external APIs and stored temporarily in `backend/data/`
2. **Copy Phase**: Data is copied to `frontend/public/` for static serving
3. **Cleanup Phase**: Backend data is deleted after successful copy (saves disk space)
4. **Serving Phase**: Frontend serves data directly from static files (no API calls needed)
5. **Fallback**: API endpoints read from frontend public directory if backend data doesn't exist

### Storage Strategy
- **No Database**: File-based storage
- **Build Storage**: JSON files in `frontend/public/assets/files/build/`
- **Game Data**: JSON files in `frontend/public/data/game/{version}/{language}/` (static, served directly)
- **Game Images**: PNG files in `frontend/public/images/game/{version}/` (static, served directly)
- **YouTube Data**: JSON files in `frontend/public/data/youtube/` (static, served directly)
- **Backend Temporary**: `backend/data/` (deleted after copy, except config files)
- **Cache**: Redis for API responses (fallback only)

### Cache Strategy

**Three-Tier Caching**:
1. **Redis Cache**: API responses with configurable TTL
2. **HTTP Cache Headers**: Browser/CDN caching
3. **Static Asset Caching**: Long-lived cache for static files

**Cache TTLs**:
- Analytics: 60s (short-lived)
- Build lists: 300s (5 minutes)
- Individual builds: 3600s (1 hour)
- Dictionary: 3600s (1 hour)
- Tier lists: 1800s (30 minutes)

**Cache Invalidation**:
- Automatic on POST/PUT/DELETE operations
- Pattern-based invalidation (e.g., `builds:*`)
- Manual invalidation via `/api/metrics/cache/reset`

## API Design

### RESTful Endpoints
- **Base Path**: `/api/*`
- **Methods**: GET, POST, PUT, DELETE
- **Response Format**: JSON
- **Error Handling**: HTTP status codes with French error messages

### Endpoint Categories
1. **Builds**: `/api/builds`, `/api/build/:fileName`
2. **Analytics**: `/api/analytics`
3. **Dictionary**: `/api/dictionnaire`
4. **Contact**: `/api/contact`
5. **Tier Lists**: `/api/tierlist/*`
6. **Assets**: `/api/assets/list`
7. **Metrics**: `/api/metrics/cache`
8. **Health**: `/api/health`, `/api/status`

See [API Contracts - Backend](./api-contracts-backend.md) for detailed endpoint documentation.

## Security

### CORS Configuration
- Allowed origins configured in `src/config/index.ts`
- Methods: GET, POST, PUT, DELETE
- Headers: Content-Type

### Current Limitations
- No authentication system
- No rate limiting
- No input validation middleware (handled in services)

## Deployment Architecture

### Static Asset Serving
- Optional static file serving via `SERVE_STATIC` environment variable
- Served from `backend/public/` directory
- 24-hour cache for static assets

### Environment Configuration
- Environment variables via `.env` file
- Key variables:
  - `PORT`: Server port (default: 3500)
  - `REDIS_URL`: Redis connection URL
  - `REDIS_CACHE_TTL`: Default cache TTL
  - `SERVE_STATIC`: Enable static file serving

## Monitoring & Health

### Health Endpoints
- `/api/health`: Basic health check
- `/api/status`: Detailed status (Redis, uptime)

### Metrics
- `/api/metrics/cache`: Cache performance metrics
- Cache hit/miss ratios
- Response time tracking

## Development Workflow

### File Structure
```
backend/
├── src/
│   ├── app.ts              # Entry point
│   ├── config/             # Configuration
│   ├── service/             # Business logic
│   ├── middleware/         # Express middleware
│   ├── utils/              # Utilities
│   ├── scripts/             # Maintenance scripts
│   ├── Cron.ts             # Cron job definitions
│   ├── DdragonAPI.ts       # External API client
│   └── types.ts            # TypeScript types
├── docs/                    # Documentation
└── __tests__/              # Tests
```

### Testing
- **Framework**: Jest
- **HTTP Testing**: Supertest
- **Test Location**: `__tests__/` directory

## Scalability Considerations

### Current Architecture
- Single server instance
- File-based storage (not scalable)
- Redis cache for performance

### Future Improvements Needed
- Database migration for builds and data
- Horizontal scaling support
- Load balancing
- Rate limiting
- Authentication system

## Dependencies

### Production Dependencies
- express, cors, compression
- redis, node-cron
- multer (file uploads)
- xlsx-js-style (Excel processing)

### Development Dependencies
- typescript, @types/*
- jest, ts-jest, supertest
- eslint, prettier
