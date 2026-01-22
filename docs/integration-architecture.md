# Integration Architecture

## Overview

Lelanation is a multi-part application with separate backend and frontend components that communicate via REST API. This document describes how the parts integrate and communicate.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                     User Browser                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Frontend (Vue 3 SPA)                     │   │
│  │  - Vue Router (Client-side routing)              │   │
│  │  - Pinia Stores (State management)               │   │
│  │  - Components & Views                            │   │
│  │  - Service Worker (PWA caching)                 │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ HTTPS/REST API
                       │ /api/*
                       │
┌──────────────────────▼──────────────────────────────────┐
│              Nginx (Reverse Proxy)                      │
│  - SSL Termination                                     │
│  - Static File Serving                                 │
│  - API Proxy                                           │
│  - Caching                                             │
└──────────────────────┬──────────────────────────────────┘
                       │
                       │ HTTP (localhost)
                       │
┌──────────────────────▼──────────────────────────────────┐
│         Backend (Express.js API)                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Services                                        │   │
│  │  - BuildService                                  │   │
│  │  - AnalyticsService                              │   │
│  │  - DictionnaireService                           │   │
│  │  - TierListService                               │   │
│  │  - YoutubeService                                │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Middleware                                      │   │
│  │  - Cache Middleware (Redis)                      │   │
│  │  - HTTP Cache Headers                            │   │
│  │  - CORS                                          │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
┌───────▼──────┐ ┌─────▼──────┐ ┌────▼──────────┐
│   Redis      │ │ File System│ │ Riot Games    │
│   (Cache)    │ │ (Storage)  │ │ Data Dragon   │
│              │ │            │ │ API           │
└──────────────┘ └────────────┘ └───────────────┘
```

## Integration Points

### Frontend → Backend

#### Communication Protocol
- **Protocol**: HTTP/HTTPS
- **Method**: REST API
- **Base Path**: `/api/*`
- **Data Format**: JSON
- **Authentication**: None (stateless)

#### API Client
- **Library**: Axios
- **Configuration**: Base URL `/api` (proxied in dev)
- **Error Handling**: Try/catch with user-friendly messages

#### Request Flow (Static-First Architecture)

**For Game Data & YouTube Data**:
1. Frontend tries to load from static files first (`/data/game/...`, `/data/youtube/...`)
2. If static files exist: Load directly (no API call, faster)
3. If static files don't exist: Fallback to API (`/api/game-data/*`, `/api/youtube/*`)
4. API tries backend first, then frontend public directory as fallback
5. Store updates state
6. UI re-renders

**For Builds & Other Dynamic Data**:
1. User action in frontend
2. Pinia store dispatches action
3. Axios makes HTTP request to `/api/*`
4. Nginx proxies to backend (localhost:3500)
5. Backend processes request
6. Response returned to frontend
7. Store updates state
8. UI re-renders

### Backend → External Services

#### Riot Games Data Dragon API
- **Purpose**: Game data synchronization
- **Endpoint**: `https://ddragon.leagueoflegends.com/cdn/`
- **Frequency**: Daily cron jobs
- **Data**: Champions, items, runes, summoners, maps
- **Languages**: French (FR), English (EN)

**Integration Flow**:
1. Cron job triggers (02:00 daily)
2. `DdragonAPI` checks for new version
3. Downloads updated JSON files
4. Saves to `frontend/src/assets/files/data/`
5. Updates version file

#### YouTube API
- **Purpose**: Content creator video management
- **Service**: `YoutubeService`
- **Frequency**: Cron-based updates
- **Storage**: File-based (JSON)

### Data Flow

#### Build Creation Flow
```
User Input (Frontend)
    ↓
Build Calculation (Frontend - local)
    ↓
POST /api/save/:filename
    ↓
Backend: BuildService.saveBuild()
    ↓
File System: Save JSON file
    ↓
Cache Invalidation: builds:*
    ↓
Response: 200 OK
    ↓
Frontend: Update UI
```

#### Build Retrieval Flow
```
User Request (Frontend)
    ↓
GET /api/build/:fileName
    ↓
Backend: Check Redis Cache
    ↓
[Cache Hit] → Return cached data
[Cache Miss] → Read file → Cache → Return data
    ↓
Frontend: Display build
```

#### Data Synchronization Flow
```
Cron Trigger (02:00)
    ↓
DdragonAPI.isLastVersion()
    ↓
[Up to date] → Skip
[Outdated] → Download new data
    ↓
Save to frontend/src/assets/files/data/
    ↓
Update lastVersion.json
    ↓
Trigger frontend rebuild (if needed)
```

## Caching Strategy

### Three-Tier Caching

#### 1. Service Worker Cache (Frontend)
- **Location**: Browser
- **Purpose**: Offline support, fast loading
- **Strategy**: Stale-while-revalidate
- **Scope**: Static assets, API responses

#### 2. HTTP Cache (Browser/CDN)
- **Location**: Browser, CDN
- **Purpose**: Reduce server load
- **Headers**: Cache-Control, ETag
- **TTL**: Varies by content type

#### 3. Redis Cache (Backend)
- **Location**: Server (Redis)
- **Purpose**: Fast API responses
- **TTL**: Configurable per endpoint
- **Invalidation**: Pattern-based

### Cache Invalidation

**Pattern-Based Invalidation**:
- `builds:*` - All build-related cache
- `builds:lelariva:*` - Lelariva builds
- `dictionnaire:*` - Dictionary cache
- `analytics:*` - Analytics cache
- `tierlist:*` - Tier list cache

**Automatic Invalidation**:
- POST/PUT/DELETE operations invalidate related cache
- Manual invalidation via `/api/metrics/cache/reset`

## Data Storage

### File-Based Storage
- **Location**: `frontend/public/assets/files/build/`
- **Format**: JSON files
- **Access**: Direct file system access
- **Limitations**: Not scalable, no transactions

### Cache Storage
- **Location**: Redis (in-memory)
- **Format**: Serialized JSON
- **TTL**: Configurable
- **Purpose**: Performance optimization

## Communication Patterns

### Request/Response Pattern
- **Synchronous**: Most API calls
- **Error Handling**: HTTP status codes + error messages
- **Retry Logic**: Not implemented (consider for production)

### Event-Driven Pattern
- **Cron Jobs**: Scheduled tasks
- **Cache Invalidation**: Event-based
- **Data Sync**: Time-based triggers

## Error Handling

### Frontend Error Handling
- Try/catch blocks in API calls
- User-friendly error messages
- Fallback UI states
- Error logging (console)

### Backend Error Handling
- HTTP status codes
- Error messages in French
- Logging (console)
- No error tracking service (consider Sentry)

## Security

### CORS Configuration
- **Allowed Origins**: Configured in `backend/src/config/index.ts`
- **Methods**: GET, POST, PUT, DELETE
- **Headers**: Content-Type

### Current Limitations
- No authentication
- No rate limiting
- No input validation middleware
- No HTTPS enforcement (handled by Nginx)

## Performance Considerations

### Frontend Optimization
- Code splitting
- Lazy loading routes
- Service worker caching
- Asset optimization

### Backend Optimization
- Redis caching
- HTTP compression
- Static asset caching
- Connection pooling (future)

### Network Optimization
- Gzip compression (Nginx)
- HTTP/2 (Nginx)
- CDN for static assets (future)

## Monitoring & Observability

### Current Monitoring
- Health endpoints: `/api/health`, `/api/status`
- Cache metrics: `/api/metrics/cache`
- Logs: Console output

### Future Improvements
- Application Performance Monitoring (APM)
- Error tracking (Sentry)
- Metrics collection (Prometheus)
- Log aggregation (ELK stack)

## Scalability

### Current Architecture
- Single backend instance
- Single Redis instance
- File-based storage
- No load balancing

### Scaling Path
1. **Horizontal Scaling**: Multiple backend instances
2. **Load Balancing**: Nginx upstream configuration
3. **Database Migration**: Replace file storage
4. **Redis Cluster**: Distributed caching
5. **CDN Integration**: Static asset delivery

## Integration Testing

### Current State
- Unit tests (Jest, Vitest)
- E2E tests (Playwright)
- No integration tests

### Recommendations
- API integration tests
- End-to-end workflow tests
- Cache behavior tests
- Error scenario tests

## Future Integration Considerations

### Planned Integrations
- Database (replace file storage)
- Authentication system
- Analytics service (Google Analytics, etc.)
- Monitoring service
- CDN for static assets

### Integration Patterns to Consider
- Message queue (for async operations)
- WebSocket (for real-time updates)
- GraphQL (alternative to REST)
- Microservices (if scaling needed)
