# Poller Engine (pollerv3 prompt #2)

Event-driven polling layer on top of `riot-gateway`. The poller itself has **no database** — it emits typed events via `PollerEventBus`. Production persistence is handled by `PollerDbConsumer` (attached in `src/main.ts`).

## Workflow

```
PollerEngine.poll([players])
  └── PollSession (shared rankCache + processedMatchIds)
        └── PlayerPoller × N
              ├── league rank → player:rank
              ├── MatchIdPaginator → match:ids
              └── MatchProcessor → match:data + participant:rank
        → session:complete

PollerDbConsumer (downstream)
  ├── player:rank / participant:rank → player_rank_history
  ├── match:data → parseMatch + rank gate → ingestion queue
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

## Tests

```bash
npm run test:poller:unit          # unit (incl. PollerDbConsumer)
npm run test:poller:e2e            # 8 mock full-loop scenarios
npm run test:poller:stability      # mock memory / dedup / stall
npm run test:poller:integration    # live API smoke (3 tests)
npm run test:poller:stability:live # live 20 min (requires RIOT_API_KEY)
npm run test:poller:all            # unit + e2e
npm run test:gateway               # riot-gateway unit
npm run test:gateway:integration   # riot-gateway live
```
