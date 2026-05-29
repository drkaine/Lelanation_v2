# Riot Gateway (pollerv3)

Single entry point for all Riot API calls. Adaptive rate limiting from Riot headers, undici pool, priority queue, deep observability.

## Architecture

```
Workers / RiotClient
        │
        ▼
   RiotGateway (singleton)
   ├── RequestQueue (priority)
   ├── RateLimitTracker (app + method buckets)
   ├── TokenBucket (sliding windows)
   ├── MetricsCollector
   └── undici Pool → Riot API
```

## Rate limiting

Before each dispatch, the gateway checks **all** app-level and method-level windows:

`available = safe_limit - used - in_flight`

Dispatch only when `available >= 1` for every window. After each response, queue flush runs immediately; when blocked, a single `setTimeout` waits until the earliest reset.

## Configuration

Copy variables from `.env.example`:

- `API_KEY_TYPE=personal|production` — fallback caps before first headers
- `SAFETY_MARGIN=0.05` — keep 5% headroom
- `MAX_CONCURRENCY=10` — in-flight HTTP cap

Switch personal → production: change `API_KEY_TYPE` only.

## Tests

```bash
npm run test:gateway:unit
npm run test:gateway:integration   # requires RIOT_API_KEY + TEST_PUUID
```

## Expected throughput (personal key, SAFETY_MARGIN=0.05)

| Window | Limit | Safe cap | Notes |
|--------|-------|----------|-------|
| 120s   | 99    | 94       | ~0.78 req/s avg |
| 1s     | 19    | 18       | burst cap |

Production: 29999/120s + 499/1s fallback caps.

## Logs

Logger name: `riot-gateway`. Levels TRACE→FATAL per `pollerv3.md`. Subscribe to events via `RiotGateway.getInstance().getObservabilityBus()`.
