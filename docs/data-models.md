# Data Models

## Overview

Lelanation uses a file-based storage system (no database). Data is stored as JSON files and cached in Redis for performance. This document describes the data structures used throughout the application.

## Storage Strategy

### File-Based Storage
- **Location**: `frontend/public/assets/files/build/` (builds)
- **Location**: `frontend/src/assets/files/data/` (game data)
- **Format**: JSON files
- **Cache**: Redis for API responses

### No Database
The application does not use a traditional database. All persistent data is stored as JSON files.

## Backend Data Models

### Build Data Structure

**Storage**: JSON files in `frontend/public/assets/files/build/`

```typescript
interface BuildData {
  // Build metadata
  id?: string;
  fileName?: string;
  champion?: string;
  items?: ItemSelection[];
  runes?: RunesSelection;
  summoners?: SummonerSelection;
  shards?: ShardSelection;
  skillOrder?: ChampionSkillsOrder;
  // ... additional build properties
}
```

### Champion Data

**Source**: Riot Games Data Dragon API  
**Storage**: `frontend/src/assets/files/data/championFull.json`

```typescript
interface Champion {
  id: string;
  key: string;
  name: string;
  title: string;
  image: Image;
  skins: Skin[];
  lore: string;
  blurb: string;
  allytips: string[];
  enemytips: string[];
  tags: string[];
  partype: string;
  info: Info;
  stats: ChampionStats;
  spells: Spell[];
  passive: Passive;
}
```

### Item Data

**Source**: Riot Games Data Dragon API  
**Storage**: `frontend/src/assets/files/data/item.json`

```typescript
interface Item {
  id: string;
  name: string;
  description: string;
  colloq: string;
  plaintext: string;
  image: Image;
  gold: Gold;
  tags: string[];
  stats: ItemStats;
  depth: number;
  into?: string[];
  from?: string[];
}
```

### Rune Data

**Source**: Riot Games Data Dragon API  
**Storage**: `frontend/src/assets/files/data/runesReforged.json`

```typescript
interface RunePath {
  id: number;
  key: string;
  icon: string;
  name: string;
  slots: Array<{
    runes: Array<{
      id: number;
      key: string;
      icon: string;
      name: string;
      shortDesc: string;
      longDesc: string;
    }>;
  }>;
}
```

### Summoner Spell Data

**Source**: Riot Games Data Dragon API  
**Storage**: `frontend/src/assets/files/data/summoner.json`

```typescript
interface Summoner {
  id: string;
  name: string;
  description: string;
  tooltip: string;
  maxrank: number;
  cooldown: number[];
  cooldownBurn: string;
  cost: number[];
  costBurn: string;
  datavalues: object;
  effect: Array<number[] | null>;
  effectBurn: Array<string | null>;
  vars: Var[];
  key: string;
  summonerLevel: number;
  modes: string[];
  costType: string;
  maxammo: string;
  range: number[];
  rangeBurn: string;
  image: Image;
  resource: string;
}
```

### Analytics Data

**Storage**: Backend service (file-based or in-memory)

```typescript
interface AnalyticsData {
  // Analytics metrics
  buildsCreated?: number;
  buildsViewed?: number;
  championsSelected?: string[];
  // ... additional analytics
}
```

### Dictionary Entry

**Storage**: Backend service

```typescript
interface DictionnaireEntry {
  term: string;
  definition: string;
  approved?: boolean;
  // ... additional fields
}
```

### Tier List Data

**Storage**: ODS files converted to JSON

```typescript
interface TierListData {
  GRAPH: ChampionData[];
  TOPLANE: ChampionData[];
  JUNGLE: ChampionData[];
  MIDLANE: ChampionData[];
  "ADC-BOT": ChampionData[];
  SUPPORT: ChampionData[];
  TierList: ChampionData[];
  Resultats: ChampionData[];
}

interface ChampionData {
  champion?: string;
  TOP?: string;
  JNG?: string;
  MID?: string;
  SUP?: string;
  "Counter highlight"?: string;
  Couleur?: string;
  "Rappel Tech"?: string;
  Lane?: string;
  id?: string;
  "ORDER BY"?: string;
  WINRATE?: string | number;
  PICKRATE?: string | number;
  PRO?: string;
  LIMIT?: string | number;
  Custom?: string;
  [key: string]: unknown;
}
```

### YouTube Video Data

**Storage**: Backend service (file-based)

```typescript
interface VideoStorage {
  videos: Video[];
  lastVideoDate: string;
  channelId: string;
  lastUpdate: number;
}

interface Video {
  id: string;
  snippet: {
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: {
      medium: {
        url: string;
      };
    };
  };
}

interface TokenStorage {
  nextPageToken: string;
  lastUpdate: number;
  tokenQuota: number;
  channelId: string;
}
```

## Frontend Data Models

### Build Models

**Location**: `src/types/build.ts`

```typescript
interface BuildData {
  id: string;
  champion: Champion;
  items: ItemSelection[];
  runes: RunesSelection;
  summoners: SummonerSelection;
  shards: ShardSelection;
  skillOrder: ChampionSkillsOrder;
  // ... additional properties
}

interface Build {
  itemStats: ItemStats;
  championStats: ChampionStats;
  buildItemStats: ItemStats;
  baseStats: Stats[];
  totalStats: TotalStats[];
}
```

### Stat Models

**Location**: `src/types/stat.ts`

```typescript
interface ChampionStats {
  hp: number;
  hpperlevel: number;
  mp: number;
  mpperlevel: number;
  movespeed: number;
  armor: number;
  armorperlevel: number;
  spellblock: number;
  spellblockperlevel: number;
  attackrange: number;
  hpregen: number;
  hpregenperlevel: number;
  mpregen: number;
  mpregenperlevel: number;
  crit: number;
  critperlevel: number;
  attackdamage: number;
  attackdamageperlevel: number;
  attackspeedperlevel: number;
  attackspeed: number;
}

interface ItemStats {
  // Item stat bonuses
  [key: string]: number;
}

interface Stats {
  // Calculated stats at a specific level
  [key: string]: number;
}

interface TotalStats extends Stats {
  // Total stats including items
}
```

### Selection Models

**Location**: `src/types/*.ts`

```typescript
interface ItemSelection {
  id: string;
  // ... item properties
}

interface RunesSelection {
  primary: GroupSelection;
  secondary: GroupSelection;
  shards: ShardSelection;
}

interface SummonerSelection {
  spell1: Summoner;
  spell2: Summoner;
}

interface ShardSelection {
  // Shard selections
}
```

## Data Flow

### Build Creation Flow
1. User creates build in frontend
2. Frontend calculates stats locally
3. Build data sent to backend via POST `/api/save/:filename`
4. Backend saves as JSON file
5. Cache invalidated for `builds:*`

### Data Synchronization Flow
1. Cron job runs daily (02:00)
2. Checks Riot Games Data Dragon API for new version
3. Downloads updated data (champions, items, runes, etc.)
4. Saves to `frontend/src/assets/files/data/`
5. Updates version file

### Cache Flow
1. API request received
2. Check Redis cache
3. If cache hit: return cached response
4. If cache miss: fetch data, cache response, return data
5. On mutation: invalidate related cache keys

## Data Relationships

### Build Relationships
- Build → Champion (one-to-one)
- Build → Items (one-to-many, 6 items)
- Build → Runes (one-to-one selection)
- Build → Summoners (one-to-two)
- Build → Shards (one-to-three)

### Game Data Relationships
- Champion → Spells (one-to-four)
- Champion → Passive (one-to-one)
- Champion → Stats (one-to-one)
- Item → Builds (many-to-many)
- Rune Path → Runes (one-to-many)

## Data Validation

### Current State
- No formal validation layer
- TypeScript types provide compile-time validation
- Runtime validation handled in services

### Future Improvements Needed
- Input validation middleware
- Schema validation (e.g., Zod, Joi)
- Data sanitization
- Type checking at runtime

## Data Migration Considerations

### Current Limitations
- File-based storage not scalable
- No database means no transactions
- No data relationships enforced
- Difficult to query/filter

### Future Migration Path
1. Database schema design
2. Migration scripts for existing JSON files
3. Dual-write period (file + database)
4. Gradual migration of read operations
5. Remove file-based storage
