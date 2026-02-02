# Lelanation Backend

Backend API server for Lelanation v2.

## Features

- **Data Dragon Synchronization**: Automatic daily sync of game data (champions, items, runes, spells) from Riot Games Data Dragon API
- **YouTube Synchronization**: Automatic daily sync of videos from configured content creators
- **Version Management**: Track game versions and detect outdated builds
- **Static Assets Management**: Automatic copying of game data and images to frontend for static serving
- **Disk Space Optimization**: Automatic cleanup of backend data after copying to frontend
- **Discord Alerts**: Automatic notifications for sync failures
- **REST API**: Health check and sync status endpoints with frontend fallback

## Setup

### Prerequisites

- Node.js 18+
- npm 8+

### Installation

```bash
npm install
```

### Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3001

# Discord Webhooks (optional)
# Alerts (cron failures, etc.)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
# Contact form notifications
DISCORD_CONTACT_WEBHOOK_URL=https://discord.com/api/webhooks/...

# YouTube API Key (optional, for video synchronization)
YOUTUBE_API_KEY=your_youtube_api_key

# YouTube sync tuning (optional)
# First run backfill limit (default: 500)
YOUTUBE_BACKFILL_MAX_VIDEOS=500
# Subsequent runs incremental limit (default: 200)
YOUTUBE_INCREMENTAL_MAX_VIDEOS=200
```

### Development

```bash
npm run dev
```

Starts the server with hot reload using `tsx watch`.

### Build

```bash
npm run build
```

Compiles TypeScript to JavaScript in the `dist/` directory.

### Production

```bash
npm start
```

Runs the compiled JavaScript from `dist/`.

## API Endpoints

### Health Check

```
GET /health
```

Returns server status.

### Sync Status

```
GET /api/sync/status
```

Returns last synchronization date and current game version.

Response:
```json
{
  "synced": true,
  "version": "14.1.1",
  "lastSyncDate": "2025-01-19T10:00:00.000Z",
  "lastSyncTimestamp": 1705658400000
}
```

## Cron Jobs

### Data Dragon Sync

- **Schedule**: Daily at 02:00 (2 AM)
- **Purpose**: Synchronize game data from Riot Games Data Dragon API
- **Retry**: Up to 10 attempts with exponential backoff
- **Alerts**: Discord webhook on failure
- **Post-Sync Actions**:
  - Downloads all game images from Data Dragon
  - Copies game data and images to `frontend/public/data/game/` and `frontend/public/images/game/`
  - Deletes old version data/images (keeps only current version)
  - Deletes backend data/images after successful copy (saves disk space)
  - Restarts frontend PM2 process to serve new static assets

### YouTube Sync

- **Schedule**: Daily at 03:00 (3 AM)
- **Purpose**: Synchronize videos from configured YouTube channels
- **Retry**: Up to 10 attempts with exponential backoff
- **Alerts**: Discord webhook on failure
- **Configuration**: `data/youtube/channels.json`
  - Supported formats:
    - `{"channels":[{"channelId":"UC...","channelName":"Lelariva"}]}`
    - `{"channels":["Lelariva_LoL"]}` (string is resolved via YouTube Search API)
- **Post-Sync Actions**:
  - Copies YouTube channel data to `frontend/public/data/youtube/`
  - Deletes backend YouTube data after successful copy (keeps only `channels.json` config)
  - Restarts frontend PM2 process to serve new static assets

## Project Structure

```
backend/
├── src/
│   ├── services/        # Business logic services
│   │   ├── DataDragonService.ts
│   │   ├── YouTubeService.ts
│   │   ├── VersionService.ts
│   │   ├── DiscordService.ts
│   │   ├── ImageService.ts
│   │   └── StaticAssetsService.ts  # Copy assets to frontend
│   ├── cron/           # Cron job definitions
│   │   ├── dataDragonSync.ts
│   │   └── youtubeSync.ts
│   ├── routes/         # Express routes
│   │   ├── sync.ts
│   │   ├── gameData.ts
│   │   ├── youtube.ts
│   │   └── images.ts
│   ├── scripts/        # Manual scripts
│   │   ├── syncData.ts
│   │   └── copyStaticAssets.ts
│   ├── utils/          # Utility functions
│   │   ├── Result.ts
│   │   ├── errors.ts
│   │   ├── retry.ts
│   │   └── fileManager.ts
│   └── index.ts        # Application entry point
├── data/               # Local data storage (temporary, deleted after copy)
│   ├── game/          # Game data from Data Dragon (deleted after copy)
│   ├── images/        # Game images (deleted after copy)
│   └── youtube/       # YouTube video data (deleted after copy, except channels.json)
└── package.json
```

## Error Handling

The backend uses the `Result<T, E>` pattern for error handling instead of try/catch:

```typescript
const result = await dataDragonService.syncGameData()
if (result.isErr()) {
  const error = result.unwrapErr()
  // Handle error
  return
}
const data = result.unwrap()
// Use data
```

## Data Storage

### Static Assets Architecture

The backend follows a **static-first architecture** for better scalability:

1. **Data is synced and stored temporarily in backend** during cron jobs
2. **Data is copied to frontend public directory** for static serving
3. **Backend data is deleted after successful copy** to save disk space
4. **Frontend serves data directly** from static files (faster, more scalable)
5. **API provides fallback** to frontend public directory if backend data doesn't exist

### Game Data Storage

**Backend (temporary, deleted after copy)**:
- `data/game/{version}/{language}/champion.json`
- `data/game/{version}/{language}/item.json`
- `data/game/{version}/{language}/runesReforged.json`
- `data/game/{version}/{language}/summoner.json`
- `data/game/version.json` (kept for version tracking)
- `data/images/{version}/` (images, deleted after copy)

**Frontend (permanent, served statically)**:
- `frontend/public/data/game/{version}/{language}/*.json`
- `frontend/public/data/game/version.json`
- `frontend/public/images/game/{version}/` (all game images)

### YouTube Data Storage

**Backend (temporary, deleted after copy)**:
- `data/youtube/{channelId}.json` (deleted after copy)
- `data/youtube/channels.json` (kept for sync configuration)

**Frontend (permanent, served statically)**:
- `frontend/public/data/youtube/{channelId}.json`
- `frontend/public/data/youtube/channels.json`

## API Endpoints

### Game Data API

- `GET /api/game-data/version` - Get current game version (tries backend, then frontend)
- `GET /api/game-data/champions?lang=fr_FR` - Get champions data (tries backend, then frontend)
- `GET /api/game-data/items?lang=fr_FR` - Get items data (tries backend, then frontend)
- `GET /api/game-data/runes?lang=fr_FR` - Get runes data (tries backend, then frontend)
- `GET /api/game-data/summoner-spells?lang=fr_FR` - Get summoner spells data (tries backend, then frontend)

**Note**: All game data endpoints automatically fallback to frontend public directory if backend data doesn't exist (after deletion).

### YouTube API Endpoints

- `GET /api/youtube/channels` - Get channels config (tries backend, then frontend)
- `GET /api/youtube/status` - Get sync status per channel (tries backend, then frontend)
- `GET /api/youtube/channels/:channelId` - Get channel data (tries backend, then frontend)
- `POST /api/youtube/trigger` - Trigger manual sync

**Note**: All YouTube endpoints automatically fallback to frontend public directory if backend data doesn't exist (after deletion).

## Manual Scripts

### Copy Static Assets

Manually copy game data and images to frontend:

```bash
npm run copy:assets
```

With frontend restart (production):

```bash
RESTART_FRONTEND=true npm run copy:assets
```

This script:
- Copies game data JSON files to `frontend/public/data/game/`
- Copies game images to `frontend/public/images/game/`
- Deletes old versions from frontend
- Deletes backend data/images after copy
- Optionally restarts frontend PM2 process

## TypeScript

The project uses TypeScript with strict mode enabled. Type checking:

```bash
npm run typecheck
```
