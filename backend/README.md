# Lelanation Backend

Backend API server for Lelanation v2.

## Features

- **Data Dragon Synchronization**: Automatic daily sync of game data (champions, items, runes, spells) from Riot Games Data Dragon API
- **YouTube Synchronization**: Automatic daily sync of videos from configured content creators
- **Version Management**: Track game versions and detect outdated builds
- **Discord Alerts**: Automatic notifications for sync failures
- **REST API**: Health check and sync status endpoints

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

# Discord Webhook (optional, for alerts)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# YouTube API Key (optional, for video synchronization)
YOUTUBE_API_KEY=your_youtube_api_key
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

### YouTube Sync

- **Schedule**: Daily at 03:00 (3 AM)
- **Purpose**: Synchronize videos from configured YouTube channels
- **Retry**: Up to 10 attempts with exponential backoff
- **Alerts**: Discord webhook on failure
- **Configuration**: `data/youtube/channels.json`

## Project Structure

```
backend/
├── src/
│   ├── services/        # Business logic services
│   │   ├── DataDragonService.ts
│   │   ├── YouTubeService.ts
│   │   ├── VersionService.ts
│   │   └── DiscordService.ts
│   ├── cron/           # Cron job definitions
│   │   ├── dataDragonSync.ts
│   │   └── youtubeSync.ts
│   ├── routes/         # Express routes
│   │   └── sync.ts
│   ├── utils/          # Utility functions
│   │   ├── Result.ts
│   │   ├── errors.ts
│   │   ├── retry.ts
│   │   └── fileManager.ts
│   └── index.ts        # Application entry point
├── data/               # Local data storage (created at runtime)
│   ├── game/          # Game data from Data Dragon
│   └── youtube/       # YouTube video data
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

Game data is stored locally in JSON files:

- `data/game/{version}/{language}/champion.json`
- `data/game/{version}/{language}/item.json`
- `data/game/{version}/{language}/runesReforged.json`
- `data/game/{version}/{language}/summoner.json`
- `data/game/version.json` (current version info)

YouTube data is stored per channel:

- `data/youtube/{channelId}.json`
- `data/youtube/channels.json` (channel configuration)

## TypeScript

The project uses TypeScript with strict mode enabled. Type checking:

```bash
npm run typecheck
```
