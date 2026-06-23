# Poller Engine (pollerv3)

Event-driven polling on top of `riot-gateway`. The engine has **no direct DB imports** — it emits events via `PollerEventBus`. Production orchestration lives in `src/poll-orchestration/` and `src/main.ts`.

## Workflow

```
PollerEngine.poll([players])
  └── PollSession (shared rankCache + processedMatchIds)
        └── PlayerPoller × N
              ├── league rank → player:rank
              ├── MatchIdPaginator → match:ids
              └── MatchProcessor → match:data + participant:rank
        → session:complete

poll-orchestration (downstream)
  ├── PatchResolver → sinceTimestamp from data/game/versions.json
  ├── PlayerDiscovery → SELECT FOR UPDATE SKIP LOCKED
  ├── MatchFilter / RankFilter → pre-filter before Riot API
  ├── BackpressureMonitor → pause when ingestion queue > threshold
  └── PollerDbConsumer
        ├── player:rank / participant:rank → player_rank_history
        ├── match:data → matchs / teams / participants + ingestion queue
        └── player:complete → players.last_seen
```

## Usage

```typescript
import { PollerEngine, PollerDbConsumer } from './poller/index.js';

const engine = PollerEngine.getInstance();
const consumer = new PollerDbConsumer({ resolveParticipantRanks: true });
consumer.attach(engine.getEventBus());

await engine.poll(
  [{ puuid: '...', platform: 'euw1' }],
  { sinceTimestamp: Math.floor(Date.now() / 1000) - 86_400 },
);
```

## sinceTimestamp

Always passed as Riot `startTime` (epoch seconds). Default is **now** — only matches after poll start are fetched.

## Environment variables

### Process (`src/main.ts` — PM2 `lelanation-poller-v2`)

| Variable | Default | Description |
|----------|---------|-------------|
| `RIOT_API_KEY` | — | Required. Must start with `RGAPI-`. |
| `DATABASE_URL` | — | PostgreSQL `lelanation_statistiques`. |
| `REDIS_URL` | — | BullMQ ingestion worker + leader lock. |
| `ENV` | — | `dev` or `prod`. |
| `POLLER_SINCE_DAYS` | `14` | Match history window (Riot `startTime`). |
| `POLLER_MATCH_IDS_PER_PAGE` | `100` | Match ID pagination page size. |
| `POLLER_MAX_CONCURRENT_PLAYERS` | `3` | Players polled in parallel per session. |
| `POLLER_MAX_CONCURRENT_MATCH_FETCHES` | `5` | Concurrent match+timeline fetches. |
| `POLLER_PARTICIPANT_RANK_CONCURRENCY` | `5` | Concurrent League v4 rank fetches. |
| `POLLER_RESOLVE_PARTICIPANT_RANKS` | `true` | Set `false` to skip participant rank API calls. |
| `DISCOVERY_INTERVAL_MS` | from config | Delay between player batch polls. |
| `DISCOVERY_PLAYERS_PER_TICK` | from config | Players loaded from `players` table per tick. |

### Live / integration tests

| Variable | Default | Description |
|----------|---------|-------------|
| `TEST_PUUID` | auto (challenger EUW) | Player for live integration & stability. |
| `POLLER_LIVE_SINCE_DAYS` | `2` | Narrow history for live smoke tests. |
| `POLLER_LIVE_MAX_MATCHES` | `2` | Cap matches processed per live test. |
| `STABILITY_USE_LIVE_API` | — | Set `true` to run 20 min live stability test. |
| `STABILITY_DURATION_MINUTES` | `20` | Duration for live stability (T4 §16). |
| `STABILITY_SESSIONS` | `10` | Mock stability: repeated session count. |

### Observability (`src/observability/poller-metrics/`)

Ring-buffer metrics, live token display (5s), aggregate reports (10m–24h), JSON snapshot persistence, and alerts (429, ingestion lag, rank gap, DB slow, etc.). Started from `main.ts` via `ObservabilityOrchestrator`.

### Self-tuning (`src/tuner/`)

`PollerTuner` reads **live rate limits** from `RiotGateway.getStatus().buckets` (not `API_KEY_TYPE` alone) and recomputes before every discovery iteration:

- `batchSize`, `maxConcurrentPlayers`, `maxConcurrentMatchFetches`, `participantRankConcurrency`
- `discoveryIntervalMs` from token utilization and ingestion queue depth

EMAs adapt from session feedback (`req/player`, `req/match`, participant rank cache hit rate). `LimitChangeDetector` logs limit changes (e.g. personal → production) and resets EMAs when limits jump more than 2×.

Still configured manually: `SAFETY_MARGIN`, `BACKPRESSURE_THRESHOLD`, `API_KEY_TYPE`, `TUNER_*` seeds.

### Poll orchestration (`src/poll-orchestration/`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCOVERY_IDLE_SLEEP_MS` | `30000` | Sleep when no players were claimed. |
| `TUNER_WARMUP_SESSIONS` | `5` | Conservative batch/concurrency for first N sessions. |
| `TUNER_SESSION_DURATION_S` | `30` | Target session length used for batch sizing. |
| `TUNER_EMA_ALPHA` | `0.3` | EMA smoothing for req/player estimates. |
| `BACKPRESSURE_THRESHOLD` | `500` | Pause discovery when ingestion queue depth exceeds this. |
| `BACKPRESSURE_POLL_INTERVAL_MS` | `5000` | Poll interval while waiting for headroom. |
| `RESOLVE_PARTICIPANT_RANKS` | `true` | Same as `POLLER_RESOLVE_PARTICIPANT_RANKS`. |

## Tests

```bash
npm run test:poller:unit              # poller unit
npm run test:poller:e2e               # poller mock full-loop
npm run test:poller:integration       # poller live API smoke
npm run test:orchestration:unit       # MatchFilter, RankFilter, PollerDbConsumer, …
npm run test:orchestration:e2e        # full pipeline + backpressure (mock DB)
npm run test:orchestration:integration # live pipeline (RIOT_API_KEY + DATABASE_URL)
npm run test:observability            # poller-metrics unit
npm run test:tuner                    # PollerTuner unit
npm run test:tuner:e2e                # tuner + poller loop
npm run test:poller:all               # poller + orchestration + tuner unit
npm run test:all                      # gateway + poller:all + orchestration integration
npm run test:poller:stability         # mock memory / dedup / stall
npm run test:poller:stability:live    # live 20 min (requires RIOT_API_KEY)
npm run test:gateway                  # riot-gateway unit
npm run test:gateway:integration      # riot-gateway live
```
