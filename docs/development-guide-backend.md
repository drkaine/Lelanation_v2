# Development Guide - Backend

## Prerequisites

- **Node.js**: 18+ (check with `node --version`)
- **npm**: 8+ (check with `npm --version`)
- **Redis**: 7.0+ (for caching, optional but recommended)
- **TypeScript**: 5.6.3 (installed as dev dependency)

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Environment Setup

Create a `.env` file in the `backend/` directory:

```env
PORT=3500
NODE_ENV=development

# Redis Configuration
REDIS_URL=redis://127.0.0.1:6379
REDIS_CACHE_TTL=3600

# Static File Serving (optional)
SERVE_STATIC=false
```

### 3. Start Redis (if using cache)

```bash
# Ubuntu/Debian
sudo systemctl start redis-server

# macOS (Homebrew)
brew services start redis

# Verify Redis is running
redis-cli ping
# Should return: PONG
```

## Local Development

### Start Development Server

```bash
npm start
```

This runs `npx ts-node src/app.ts` which starts the Express server.

### Development Scripts

```bash
# Start server
npm start

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format

# Clean (lint + format + test)
npm run clean

# Clean YouTube JSON data
npm run clean-youtube
```

## Project Structure

```
backend/
├── src/
│   ├── app.ts              # Main entry point
│   ├── config/             # Configuration files
│   ├── service/             # Business logic services
│   ├── middleware/         # Express middleware
│   ├── utils/              # Utility functions
│   ├── scripts/             # Maintenance scripts
│   ├── Cron.ts             # Cron job definitions
│   ├── DdragonAPI.ts       # Riot Games API client
│   ├── FileManager.ts      # File operations
│   ├── OdsToJson.ts        # ODS to JSON conversion
│   └── types.ts            # TypeScript type definitions
├── docs/                    # Documentation
├── __tests__/              # Test files
├── package.json
├── tsconfig.json
└── jest.config.js
```

## Development Workflow

### Adding a New Service

1. Create service file in `src/service/`:
   ```typescript
   // src/service/MyService.ts
   import { Request, Response } from "express";
   
   export const myService = {
     async getData(req: Request, res: Response) {
       // Implementation
     }
   };
   ```

2. Register route in `src/app.ts`:
   ```typescript
   import { myService } from "./service/MyService";
   
   app.get("/api/my-endpoint", myService.getData);
   ```

3. Add caching if needed:
   ```typescript
   app.get(
     "/api/my-endpoint",
     apiCache,
     cacheMiddleware({ ttl: 3600 }),
     myService.getData
   );
   ```

### Adding Middleware

1. Create middleware file in `src/middleware/`:
   ```typescript
   // src/middleware/myMiddleware.ts
   import { Request, Response, NextFunction } from "express";
   
   export const myMiddleware = (req: Request, res: Response, next: NextFunction) => {
     // Implementation
     next();
   };
   ```

2. Use in `src/app.ts`:
   ```typescript
   import { myMiddleware } from "./middleware/myMiddleware";
   
   app.use(myMiddleware);
   ```

### Working with Redis Cache

```typescript
import { redisUtils } from "./utils/redisClient";

// Get from cache
const cached = await redisUtils.get("my-key");

// Set in cache
await redisUtils.set("my-key", data, 3600); // TTL: 1 hour

// Delete from cache
await redisUtils.del("my-key");
```

### Adding Cron Jobs

Edit `src/Cron.ts`:

```typescript
import cron from "node-cron";

cron.schedule("0 * * * *", async () => {
  console.log("Running hourly task");
  // Your task here
});
```

## Testing

### Running Tests

```bash
npm test
```

### Test Structure

Tests are located in `__tests__/` directory. Use Jest with Supertest for API testing:

```typescript
import request from "supertest";
import app from "../src/app";

describe("API Endpoints", () => {
  it("should return 200", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
  });
});
```

### Writing Tests

1. Create test file: `__tests__/MyService.test.ts`
2. Import dependencies
3. Write test cases
4. Run: `npm test`

## Code Quality

### Linting

```bash
npm run lint
```

Uses ESLint with TypeScript support.

### Formatting

```bash
npm run format
```

Uses Prettier for code formatting.

### Type Checking

TypeScript is configured with strict mode. Check types:

```bash
npx tsc --noEmit
```

## Environment Variables

### Required
- `PORT`: Server port (default: 3500)

### Optional
- `REDIS_URL`: Redis connection URL
- `REDIS_CACHE_TTL`: Default cache TTL in seconds
- `SERVE_STATIC`: Enable static file serving ("true"/"false")
- `NODE_ENV`: Environment ("development"/"production")

## Common Development Tasks

### Adding a New API Endpoint

1. Create service method
2. Add route in `app.ts`
3. Add caching if needed
4. Write tests
5. Update API documentation

### Debugging

```bash
# Run with Node.js inspector
node --inspect -r ts-node/register src/app.ts

# Or use VS Code debugger with launch.json
```

### Hot Reload

For hot reload during development, consider using:
- `nodemon`: `npm install -D nodemon`
- `ts-node-dev`: `npm install -D ts-node-dev`

## File Operations

### Reading Files

```typescript
import { openFile } from "./FileManager";

const data = await openFile("/path/to/file.json");
const parsed = JSON.parse(data);
```

### Writing Files

```typescript
import { saveFile } from "./FileManager";

await saveFile(JSON.stringify(data), "/path/to/file.json");
```

## External API Integration

### Riot Games Data Dragon API

```typescript
import { DdragonAPI } from "./DdragonAPI";

const ddragon = new DdragonAPI();
const response = await ddragon.access("data/fr_FR/championFull.json", true);
const data = await response.json();
```

## Troubleshooting

### Redis Connection Issues

```bash
# Check Redis status
redis-cli ping

# Check Redis logs
sudo journalctl -u redis-server

# Restart Redis
sudo systemctl restart redis-server
```

### Port Already in Use

```bash
# Find process using port 3500
lsof -i :3500

# Kill process
kill -9 <PID>
```

### TypeScript Errors

```bash
# Clean and rebuild
rm -rf node_modules
npm install
npx tsc --noEmit
```

## Best Practices

1. **Use TypeScript types**: Define interfaces for all data structures
2. **Error handling**: Always handle errors in async functions
3. **Caching**: Use Redis cache for expensive operations
4. **Logging**: Use console.log for development, consider winston for production
5. **Testing**: Write tests for new features
6. **Code style**: Follow ESLint and Prettier rules

## Next Steps

- Set up CI/CD pipeline
- Add monitoring and logging
- Implement rate limiting
- Add input validation middleware
- Set up database migration (future)
