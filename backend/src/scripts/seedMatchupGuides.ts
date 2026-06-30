/**
 * Seed public matchup guide JSON files into backend/data/matchup-guides/
 * Run: npm run seed:matchup-guides (from backend/)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ChampionRef,
  MatchupEntry,
  MatchupGuide,
  MatchupGuideMeta,
  MatchupGuideTag,
  MatchupOutcomeKind,
  MatchupSkillFavor,
  Role,
  StoredBuild,
} from '@lelanation/shared-types'

const guidesDir = join(process.cwd(), 'data', 'matchup-guides')

const now = new Date().toISOString()
const currentPatch = '16.13.1'
const olderPatch = '16.11.1'

function champ(id: string, name: string): ChampionRef {
  return { id, name, image: { full: `${id}.png` } }
}

function item(id: string) {
  return { id, image: { full: `${id}.png` } }
}

function spell(id: string, key: string) {
  return { id, key, image: { full: `${id}.png` } }
}

const SPELL_KEYS: Record<string, string> = {
  SummonerFlash: '4',
  SummonerDot: '14',
  SummonerHeal: '7',
  SummonerTeleport: '12',
  SummonerExhaust: '3',
  SummonerSmite: '11',
  SummonerBarrier: '21',
}

type MatchupRow = {
  opponent: ChampionRef
  difficultyScore: number
  outcomeKind: MatchupOutcomeKind
  skillFavor?: MatchupSkillFavor
  comments: string
  earlyNotes?: string
  midNotes?: string
  lateNotes?: string
  powerLevels?: number[]
}

type GuideSeed = {
  id: string
  guideName: string
  author: string
  shortDescription: string
  description: string
  visibility?: 'public' | 'private'
  champion: ChampionRef
  role: Role
  tags?: MatchupGuideTag[]
  gameVersion: string
  createdAt: string
  updatedAt: string
  patchStale?: MatchupGuide['patchStale']
  meta: MatchupGuideMeta
  buildItems: string[]
  buildRunes: StoredBuild['runes']
  buildShards: StoredBuild['shards']
  buildSpells: [string, string]
  buildSkillOrder: StoredBuild['skillOrder']
  upvote?: number
  downvote?: number
  matchups: MatchupRow[]
}

function buildMatchupEntry(row: MatchupRow): MatchupEntry {
  return {
    opponent: row.opponent,
    difficultyScore: row.difficultyScore,
    difficultyMode: 'score',
    outcomeKind: row.outcomeKind,
    skillFavor: row.skillFavor,
    buildVariants: [{ variant: 'main', reason: 'Build standard du guide' }],
    powerSpike: row.powerLevels?.length
      ? { levels: row.powerLevels, notes: 'Fenêtre de tempo principale' }
      : undefined,
    early: row.earlyNotes
      ? { tags: ['aggressive'], notes: row.earlyNotes }
      : undefined,
    mid: row.midNotes ? { tags: ['farm'], notes: row.midNotes } : undefined,
    late: row.lateNotes ? { tags: ['passive'], notes: row.lateNotes } : undefined,
    comments: row.comments,
  }
}

function deriveBestWorst(matchups: MatchupEntry[]): {
  bestMatchups: ChampionRef[]
  worstMatchups: ChampionRef[]
} {
  const sorted = [...matchups].sort(
    (a, b) => (a.difficultyScore ?? 5) - (b.difficultyScore ?? 5)
  )
  return {
    bestMatchups: sorted.slice(0, 3).map(entry => entry.opponent),
    worstMatchups: sorted.slice(-3).reverse().map(entry => entry.opponent),
  }
}

function assembleGuide(seed: GuideSeed): MatchupGuide {
  const matchups = seed.matchups.map(buildMatchupEntry)
  const { bestMatchups, worstMatchups } = deriveBestWorst(matchups)
  const build: StoredBuild = {
    id: seed.id,
    name: seed.guideName,
    author: seed.author,
    description: seed.description,
    visibility: seed.visibility ?? 'public',
    champion: seed.champion,
    items: seed.buildItems.map(item),
    runes: seed.buildRunes,
    shards: seed.buildShards,
    summonerSpells: [
      spell(seed.buildSpells[0], SPELL_KEYS[seed.buildSpells[0]] ?? '4'),
      spell(seed.buildSpells[1], SPELL_KEYS[seed.buildSpells[1]] ?? '4'),
    ],
    skillOrder: seed.buildSkillOrder,
    roles: [seed.role],
    tags: seed.tags,
    upvote: seed.upvote ?? 12,
    downvote: seed.downvote ?? 2,
    gameVersion: seed.gameVersion,
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
    patchStale: seed.patchStale ?? null,
    subBuilds: [],
    descriptionMode: 'single',
  }

  return {
    id: seed.id,
    author: seed.author,
    shortDescription: seed.shortDescription,
    description: seed.description,
    visibility: seed.visibility ?? 'public',
    champion: seed.champion,
    role: seed.role,
    tags: seed.tags,
    gameVersion: seed.gameVersion,
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
    patchStale: seed.patchStale ?? null,
    build,
    matchups,
    meta: seed.meta,
    bestMatchups,
    worstMatchups,
  }
}

const dominationPrimary = {
  primary: { pathId: 8100, keystone: 8112, slot1: 8143, slot2: 8139, slot3: 8135 },
  secondary: { pathId: 8000, slot1: 9111, slot2: 8014 },
}
const precisionPrimary = {
  primary: { pathId: 8000, keystone: 8010, slot1: 9111, slot2: 9104, slot3: 8299 },
  secondary: { pathId: 8400, slot1: 8444, slot2: 8453 },
}
const resolvePrimary = {
  primary: { pathId: 8400, keystone: 8437, slot1: 8446, slot2: 8444, slot3: 8451 },
  secondary: { pathId: 8000, slot1: 9111, slot2: 8299 },
}
const inspirationSecondary = {
  primary: { pathId: 8200, keystone: 8229, slot1: 8226, slot2: 8210, slot3: 8237 },
  secondary: { pathId: 8300, slot1: 8345, slot2: 8347 },
}
const sorceryPrimary = {
  primary: { pathId: 8200, keystone: 8214, slot1: 8226, slot2: 8210, slot3: 8237 },
  secondary: { pathId: 8100, slot1: 8143, slot2: 8105 },
}

const guideSeeds: GuideSeed[] = [
  {
    id: 'f1a10001-0001-4001-8001-000000000001',
    guideName: 'Akali — Lane bully & roam',
    author: 'Lelariva',
    shortDescription:
      'Assassin AP mid : trades courts avec shroud, prio pour roam bot. Évite les all-in avant spike item. pas fait par Lelariva',
    description:
      'Assassin AP mid orienté lane bully. Trades courts avec shroud et energy, évite les all-in longs avant spike Rocketbelt. Priorise la prio pour roam bot. Ce guide couvre les mages immobiles favorables et les matchups difficiles avec ulti défensif.',
    champion: champ('Akali', 'Akali'),
    role: 'mid',
    tags: ['pro'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    meta: {
      shortDescription:
        'Assassin AP mid : trades courts avec shroud, prio pour roam bot. Évite les all-in avant spike item.',
      authorAbout:
        'OTP Akali depuis S8, stream régulier sur la lane mid. Focus tempo et roams.',
      opggUrl: 'https://www.op.gg/summoners/euw/Lelariva-Akali',
      permabanNotes: 'Malzahar, Annie, Lissandra — ulti point-and-click ou lockdown trop pénalisant.',
      generalBuildNotes:
        'Rocketbelt rush. Shadowflame second, Zhonya si besoin de survivabilité, Void Staff vs MR.',
    },
    buildItems: ['1056', '2003', '3152', '4645', '3157', '3135', '3020', '3100'],
    buildRunes: dominationPrimary,
    buildShards: { slot1: 5008, slot2: 5008, slot3: 5001 },
    buildSpells: ['SummonerFlash', 'SummonerDot'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'W', 'E'],
      skillUpOrder: ['Q', 'E', 'W'],
    },
    matchups: [
      {
        opponent: champ('Veigar', 'Veigar'),
        difficultyScore: 2,
        outcomeKind: 'win',
        comments: 'Cage facile à dodge avec R. Trade Q+E puis back.',
        earlyNotes: 'Push level 2, trade Q puis recule dans le shroud.',
        powerLevels: [3, 6],
      },
      {
        opponent: champ('Lux', 'Lux'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Bind = death. Joue sur les cooldowns E/Q.',
        earlyNotes: 'Dodge bind avec E/shroud, all-in level 6.',
      },
      {
        opponent: champ('Xerath', 'Xerath'),
        difficultyScore: 3,
        outcomeKind: 'skill',
        skillFavor: 'self',
        comments: 'Skill matchup : gagne si tu casses sa tour de poke.',
        midNotes: 'Roam bot quand il push sous tour.',
        powerLevels: [6],
      },
      {
        opponent: champ('Syndra', 'Syndra'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Respect stun. All-in seulement après E whiff.',
      },
      {
        opponent: champ('Yasuo', 'Yasuo'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Windwall annule Q. Attends le CD ou contourne avec E.',
      },
      {
        opponent: champ('Orianna', 'Orianna'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Lane calme. Cherche roam plutôt que solo kill.',
        midNotes: 'Ne dive pas sous R ball.',
      },
      {
        opponent: champ('Viktor', 'Viktor'),
        difficultyScore: 6,
        outcomeKind: 'lose',
        comments: 'Scale mieux. Ferme la game avant 2 items lui.',
        lateNotes: 'Split side, évite 5v5.',
      },
      {
        opponent: champ('Malzahar', 'Malzahar'),
        difficultyScore: 9,
        outcomeKind: 'lose',
        comments: 'Suppression + ulti = impossible à all-in. Farm et roam.',
        earlyNotes: 'Demande gank jungler level 3.',
      },
      {
        opponent: champ('Annie', 'Annie'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Burst level 6. Ne trade pas sans minion wave.',
      },
      {
        opponent: champ('Talon', 'Talon'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Mirror assassin. Celui qui engage en premier gagne souvent.',
        powerLevels: [2, 6],
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000002',
    guideName: 'Darius — Grasp bully',
    author: 'Darkaine',
    shortDescription: 'Top Grasp : trades courts, push lent pour setup gank. Reset après chaque trade.',
    description:
      'Top bully Grasp : joue court, push lent pour setup gank. Reset après chaque trade et abuse les plates. Hullbreaker en split si ahead.',
    champion: champ('Darius', 'Darius'),
    role: 'top',
    tags: ['otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    meta: {
      shortDescription: 'Top Grasp : trades courts, push lent pour setup gank. Reset après chaque trade.',
      authorAbout: 'Top OTP Darius, macro split et teamfight frontline.',
      opggUrl: 'https://www.op.gg/summoners/euw/Darkaine-Darius',
      permabanNotes: 'Quinn, Vayne — kiting impossible sans Ghost/Flash up.',
      generalBuildNotes: 'Trinity si ahead, Sterak second. Ghost obligatoire vs range.',
    },
    buildItems: ['1055', '2003', '3078', '3053', '3065', '3071', '3111', '3742'],
    buildRunes: precisionPrimary,
    buildShards: { slot1: 5005, slot2: 5008, slot3: 5001 },
    buildSpells: ['SummonerFlash', 'SummonerTeleport'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'E', 'W'],
      skillUpOrder: ['Q', 'E', 'W'],
    },
    matchups: [
      {
        opponent: champ('Garen', 'Garen'),
        difficultyScore: 2,
        outcomeKind: 'win',
        comments: 'Kite avec E pull. Stack passive avant all-in.',
        earlyNotes: 'Trade Q au max range.',
      },
      {
        opponent: champ('Sion', 'Sion'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Il ne peut pas trade back. Zone avec Q.',
      },
      {
        opponent: champ('Chogath', "Cho'Gath"),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Silence dodgeable. All-in level 6.',
      },
      {
        opponent: champ('Malphite', 'Malphite'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Respect R level 6. Short trades only.',
      },
      {
        opponent: champ('Ornn', 'Ornn'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Immobile, free Q poke. W his brittle.',
      },
      {
        opponent: champ('Aatrox', 'Aatrox'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Respect Q sweet spot. Pull pendant W.',
      },
      {
        opponent: champ('Renekton', 'Renekton'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Trade quand W down. Back avant son spike.',
      },
      {
        opponent: champ('Quinn', 'Quinn'),
        difficultyScore: 9,
        outcomeKind: 'lose',
        comments: 'Blind difficile. Ghost + Flash pour engage ou dodge.',
      },
      {
        opponent: champ('Vayne', 'Vayne'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Kite infinie. Demande gank early.',
        earlyNotes: 'Freeze près de ta tour.',
      },
      {
        opponent: champ('Jax', 'Jax'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Ne commit pas dans E. Short trades.',
        lateNotes: 'Il scale — finis early.',
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000003',
    guideName: 'Thresh — Engage & vision',
    author: 'SupportLab',
    shortDescription: 'Engage support : hooks depuis bush, roam mid après push bot. Vision pixel dragon.',
    description:
      'Engage support : hook angles depuis le bush, roam mid après push bot. Contrôle dragon et vision pixel.',
    champion: champ('Thresh', 'Thresh'),
    role: 'support',
    tags: ['pro', 'otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    meta: {
      shortDescription: 'Engage support : hooks depuis bush, roam mid après push bot. Vision pixel dragon.',
      authorAbout: 'Support main depuis 6 saisons, coach macro bas elo.',
      opggUrl: 'https://www.op.gg/summoners/euw/SupportLab-TH',
      permabanNotes: 'Morgana, Lulu — peel annule tes engages.',
      generalBuildNotes: 'Locket vs burst, Zeke si ADC carry. Mobility Boots roam.',
    },
    buildItems: ['3869', '2055', '3190', '3107', '3050', '3109', '3111', '4401'],
    buildRunes: resolvePrimary,
    buildShards: { slot1: 5007, slot2: 5002, slot3: 5001 },
    buildSpells: ['SummonerFlash', 'SummonerExhaust'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'W', 'E'],
      skillUpOrder: ['Q', 'W', 'E'],
    },
    matchups: [
      {
        opponent: champ('Blitzcrank', 'Blitzcrank'),
        difficultyScore: 4,
        outcomeKind: 'skill',
        skillFavor: 'self',
        comments: 'Hook vs hook. Tu gagnes avec lantern save.',
      },
      {
        opponent: champ('Morgana', 'Morgana'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Black shield = inhookable. Bait Q avant engage.',
      },
      {
        opponent: champ('Jinx', 'Jinx'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Immobile ADC. Flank hook + E chain.',
        earlyNotes: 'Level 2 all-in bot.',
      },
      {
        opponent: champ('Leona', 'Leona'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Respect level 2. Peel avec E si dive.',
      },
      {
        opponent: champ('Nautilus', 'Nautilus'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Hook plus long mais CD plus long. Trade hooks.',
      },
      {
        opponent: champ('Karma', 'Karma'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Shield annule poke. Roam quand mantra down.',
      },
      {
        opponent: champ('Lulu', 'Lulu'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Polymorph stop engage. Focus macro vision.',
      },
      {
        opponent: champ('Ezreal', 'Ezreal'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'E dodge hook. Angle depuis fog.',
      },
      {
        opponent: champ('Yuumi', 'Yuumi'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Dive ADC attachée. Exhaust sur carry.',
      },
      {
        opponent: champ('Senna', 'Senna'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Trade poke. All-in quand soul stack bas.',
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000004',
    guideName: 'Lee Sin — Early tempo',
    author: 'JungleDiff',
    shortDescription: 'Early jungler : 3 camps puis gank mid si prio. Invade seulement avec push laners.',
    description:
      'Early game jungler : clear 3 camps puis gank mid si prio. Invade seulement si les laners ont push.',
    champion: champ('LeeSin', 'Lee Sin'),
    role: 'jungle',
    tags: ['pro'],
    gameVersion: olderPatch,
    createdAt: '2026-06-10T12:00:00.000Z',
    updatedAt: '2026-06-10T12:00:00.000Z',
    patchStale: {
      patchVersion: olderPatch,
      flaggedAt: '2026-06-20T00:00:00.000Z',
      categories: ['item'],
    },
    meta: {
      shortDescription: 'Early jungler : 3 camps puis gank mid si prio. Invade seulement avec push laners.',
      authorAbout: 'Jungle coach, spécialiste early game et pathing.',
      opggUrl: 'https://www.op.gg/summoners/euw/JungleDiff-Lee',
      permabanNotes: 'Olaf, Graves — duel et invade trop forts early.',
      generalBuildNotes: 'Goredrinker ou Eclipse selon comp. Blue smite standard.',
    },
    buildItems: ['1036', '1036', '6630', '3071', '3053', '6333', '3111', '3742'],
    buildRunes: dominationPrimary,
    buildShards: { slot1: 5005, slot2: 5008, slot3: 5001 },
    buildSpells: ['SummonerFlash', 'SummonerSmite'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'W', 'E'],
      skillUpOrder: ['Q', 'W', 'E'],
    },
    matchups: [
      {
        opponent: champ('Amumu', 'Amumu'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Invade level 3 si mid prio. Il ne peut pas duel.',
        earlyNotes: 'Steal raptors.',
      },
      {
        opponent: champ('Karthus', 'Karthus'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Invade early, punish slow clear.',
      },
      {
        opponent: champ('Evelynn', 'Evelynn'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Track level 6. Ward deep avant spike.',
      },
      {
        opponent: champ('Nidalee', 'Nidalee'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Mirror tempo. Gank opposite side.',
      },
      {
        opponent: champ('Kindred', 'Kindred'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'self',
        comments: 'Deny marks early. Invade avec laner prio.',
      },
      {
        opponent: champ('Lillia', 'Lillia'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Elle scale. Force fights early.',
      },
      {
        opponent: champ('Viego', 'Viego'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Reset fights. Ne commit pas 1v1 late.',
      },
      {
        opponent: champ('Graves', 'Graves'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Duel perdant. Avoid invade, gank lanes.',
      },
      {
        opponent: champ('Olaf', 'Olaf'),
        difficultyScore: 9,
        outcomeKind: 'lose',
        comments: 'R ignore CC. Track ult CD avant fight.',
      },
      {
        opponent: champ('Elise', 'Elise'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Early pressure similaire. Respect cocoon.',
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000005',
    guideName: 'Lucian — Lane bully ADC',
    author: 'ADCFrance',
    shortDescription: 'Bully level 1-3 : push level 2 avec support engage. Trade quand passive up.',
    description:
      'Lane bully niveau 1-3 : push level 2 avec support engage. Trade quand passive est disponible.',
    champion: champ('Lucian', 'Lucian'),
    role: 'adc',
    tags: ['otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    meta: {
      shortDescription: 'Bully level 1-3 : push level 2 avec support engage. Trade quand passive up.',
      authorAbout: 'ADC OTP Lucian, focus lane dominance et mid game spikes.',
      opggUrl: 'https://www.op.gg/summoners/euw/ADCFrance-Luc',
      permabanNotes: 'Caitlyn, Ashe — poke et zone trop forts.',
      generalBuildNotes: 'Navori core. IE second si ahead. Collector vs squishies.',
    },
    buildItems: ['1055', '2003', '6671', '3031', '6676', '3036', '3006', '3033'],
    buildRunes: precisionPrimary,
    buildShards: { slot1: 5005, slot2: 5008, slot3: 5011 },
    buildSpells: ['SummonerFlash', 'SummonerHeal'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'E', 'W'],
      skillUpOrder: ['Q', 'E', 'W'],
    },
    matchups: [
      {
        opponent: champ('Caitlyn', 'Caitlyn'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Respect trap zone. All-in level 2 avec support.',
      },
      {
        opponent: champ('Ezreal', 'Ezreal'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Outtrade avec passive. Dodge Q avec E.',
      },
      {
        opponent: champ('KogMaw', "Kog'Maw"),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Immobile. Burst level 6.',
        earlyNotes: 'Hard push level 2.',
      },
      {
        opponent: champ('Jinx', 'Jinx'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Punish sans E. Freeze avec support roam.',
      },
      {
        opponent: champ('Twitch', 'Twitch'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'self',
        comments: 'Reveal avec W. Trade avant stealth.',
      },
      {
        opponent: champ('Ashe', 'Ashe'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Slow = death. Cleanse ou wait flash.',
      },
      {
        opponent: champ('Draven', 'Draven'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Bully vs bully. Celui qui tombe first lose.',
        powerLevels: [2, 6],
      },
      {
        opponent: champ('Varus', 'Varus'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Poke war. All-in après E whiff.',
      },
      {
        opponent: champ('Aphelios', 'Aphelios'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'self',
        comments: 'Punish immobile weapons. E gap close.',
      },
      {
        opponent: champ('Samira', 'Samira'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Respect W block. Short burst trades.',
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000006',
    guideName: 'Ahri — Mage mobile',
    author: 'MidGap',
    shortDescription: 'Farm safe jusqu\'à 6, roam bot avec push. Charm sous tour avec jungler seulement.',
    description:
      'Mage mobile : farm safe jusqu\'à 6, roam bot avec push. Charm sous tour seulement avec jungler.',
    champion: champ('Ahri', 'Ahri'),
    role: 'mid',
    tags: ['pro'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    meta: {
      shortDescription: 'Farm safe jusqu\'à 6, roam bot avec push. Charm sous tour avec jungler seulement.',
      authorAbout: 'Mid laner pro-amateur, Ahri et mages mobiles.',
      opggUrl: 'https://www.op.gg/summoners/euw/MidGap-Ahri',
      permabanNotes: 'Sylas, Kassadin — steal R ou scale infini.',
      generalBuildNotes: 'Liandry vs tanks, Luden vs squishies. Shadowflame second.',
    },
    buildItems: ['1056', '2003', '6653', '4645', '3135', '3089', '3020', '3102'],
    buildRunes: sorceryPrimary,
    buildShards: { slot1: 5008, slot2: 5008, slot3: 5001 },
    buildSpells: ['SummonerFlash', 'SummonerDot'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'W', 'E'],
      skillUpOrder: ['Q', 'W', 'E'],
    },
    matchups: [
      {
        opponent: champ('Syndra', 'Syndra'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'R dodge stun. All-in après sphere whiff.',
      },
      {
        opponent: champ('Veigar', 'Veigar'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Cage = R escape. Free farm lane.',
      },
      {
        opponent: champ('Lux', 'Lux'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Charm > bind range si angle. Roam bot.',
      },
      {
        opponent: champ('Zed', 'Zed'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'R dodge ult. Charm quand W down.',
      },
      {
        opponent: champ('Yasuo', 'Yasuo'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Windwall E. Poke avec Q return.',
      },
      {
        opponent: champ('Sylas', 'Sylas'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Steal R. Play safe, scale team.',
      },
      {
        opponent: champ('Kassadin', 'Kassadin'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Poke level 1-5, finis avant 16.',
        midNotes: 'Group mid, deny farm.',
      },
      {
        opponent: champ('Galio', 'Galio'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'W taunt stop R. Roam opposite side.',
      },
      {
        opponent: champ('Orianna', 'Orianna'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Farm lane. Look sidelanes.',
      },
      {
        opponent: champ('Viktor', 'Viktor'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Outscale. Force roam early.',
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000007',
    guideName: 'Camille — Split push',
    author: 'TopGap',
    shortDescription: 'Split si TP up. Évite 5v5 sans spike Hullbreaker. Grasp short trades.',
    description:
      'Split vs teamfight : Camille split si TP up. Ne fight 5v5 sans spike item Hullbreaker.',
    champion: champ('Camille', 'Camille'),
    role: 'top',
    tags: ['otp'],
    gameVersion: olderPatch,
    createdAt: '2026-06-05T10:00:00.000Z',
    updatedAt: '2026-06-05T10:00:00.000Z',
    patchStale: {
      patchVersion: olderPatch,
      flaggedAt: '2026-06-18T00:00:00.000Z',
      categories: ['item'],
    },
    meta: {
      shortDescription: 'Split si TP up. Évite 5v5 sans spike Hullbreaker. Grasp short trades.',
      authorAbout: 'Top Camille OTP, split push macro.',
      opggUrl: 'https://www.op.gg/summoners/euw/TopGap-Camille',
      permabanNotes: 'Jax, Fiora — duel split impossible.',
      generalBuildNotes: 'Trinity + Hullbreaker split. Sterak teamfight.',
    },
    buildItems: ['1055', '2003', '3078', '3181', '3053', '6333', '3111', '3742'],
    buildRunes: precisionPrimary,
    buildShards: { slot1: 5005, slot2: 5008, slot3: 5001 },
    buildSpells: ['SummonerFlash', 'SummonerTeleport'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'E', 'W'],
      skillUpOrder: ['Q', 'E', 'W'],
    },
    matchups: [
      {
        opponent: champ('Ornn', 'Ornn'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Immobile. E stun wall easy.',
      },
      {
        opponent: champ('Sion', 'Sion'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Side lane free. W block Q.',
      },
      {
        opponent: champ('Malphite', 'Malphite'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Kite with W. All-in level 6.',
      },
      {
        opponent: champ('Darius', 'Darius'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Short trades. E over pull.',
      },
      {
        opponent: champ('Aatrox', 'Aatrox'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'self',
        comments: 'Kite with E. All-in after Q whiff.',
      },
      {
        opponent: champ('Garen', 'Garen'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Kite with W shield. Deny farm.',
      },
      {
        opponent: champ('Fiora', 'Fiora'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Riposte E. Play safe, outscale team.',
      },
      {
        opponent: champ('Jax', 'Jax'),
        difficultyScore: 9,
        outcomeKind: 'lose',
        comments: 'Duel perdant late. Group only.',
      },
      {
        opponent: champ('Teemo', 'Teemo'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Blind annoying. All-in with Ghost.',
      },
      {
        opponent: champ('Renekton', 'Renekton'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Respect early. Scale and split.',
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000008',
    guideName: 'Nami — Enchanter peel',
    author: 'NamiOTP',
    shortDescription: 'E sur ADC en trade, R disengage. Bubble sur CC chain allié.',
    description:
      'Enchanter peel : E sur l\'ADC en trade, R pour disengage. Bubble sur CC chain allié.',
    champion: champ('Nami', 'Nami'),
    role: 'support',
    tags: ['otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    meta: {
      shortDescription: 'E sur ADC en trade, R disengage. Bubble sur CC chain allié.',
      authorAbout: 'Nami OTP 1M+ points, peel et lane bully bot.',
      opggUrl: 'https://www.op.gg/summoners/euw/NamiOTP-EU',
      permabanNotes: 'Lulu, Janna — outscale en peel.',
      generalBuildNotes: 'Moonstone vs poke, Shurelya engage. Exhaust vs assassins.',
    },
    buildItems: ['3869', '2055', '6616', '3107', '3504', '3222', '3111', '4401'],
    buildRunes: inspirationSecondary,
    buildShards: { slot1: 5007, slot2: 5002, slot3: 5001 },
    buildSpells: ['SummonerFlash', 'SummonerExhaust'],
    buildSkillOrder: {
      firstThreeUps: ['W', 'E', 'Q'],
      skillUpOrder: ['W', 'E', 'Q'],
    },
    matchups: [
      {
        opponent: champ('Samira', 'Samira'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Bubble stop R combo. Exhaust key.',
      },
      {
        opponent: champ('Draven', 'Draven'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'E buff win trades. Q predict axe catch.',
      },
      {
        opponent: champ('Lucian', 'Lucian'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'E + passive burst. Level 2 all-in.',
      },
      {
        opponent: champ('Leona', 'Leona'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Q before zenith. R disengage.',
      },
      {
        opponent: champ('Thresh', 'Thresh'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Bubble vs hook. W save flay.',
      },
      {
        opponent: champ('Nautilus', 'Nautilus'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'CC chain long. Exhaust anchor.',
      },
      {
        opponent: champ('Lulu', 'Lulu'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Poly stop bubble. Scale and teamfight.',
      },
      {
        opponent: champ('Janna', 'Janna'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Tornado stop R. Poke lane impossible.',
      },
      {
        opponent: champ('Yuumi', 'Yuumi'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Poke wins. All-in when detach.',
      },
      {
        opponent: champ('Brand', 'Brand'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Heal through poke. All-in level 3.',
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000009',
    guideName: 'Graves — Tempo jungle',
    author: 'GravesMain',
    shortDescription: 'Full clear rapide, contest scuttle avec prio mid. Invade early si ahead.',
    description:
      'Tempo jungle : full clear rapide, contest scuttle avec prio mid. Invade early si ahead.',
    champion: champ('Graves', 'Graves'),
    role: 'jungle',
    tags: ['pro', 'otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    meta: {
      shortDescription: 'Full clear rapide, contest scuttle avec prio mid. Invade early si ahead.',
      authorAbout: 'Graves one trick, invade et tempo specialist.',
      opggUrl: 'https://www.op.gg/summoners/euw/GravesMain-EU',
      permabanNotes: 'Elise, Lee Sin — early duel perdant.',
      generalBuildNotes: 'Goredrinker bruiser. Youmuu snowball. Red smite duel.',
    },
    buildItems: ['1036', '1036', '6630', '6676', '3071', '6333', '3111', '3036'],
    buildRunes: precisionPrimary,
    buildShards: { slot1: 5005, slot2: 5008, slot3: 5001 },
    buildSpells: ['SummonerFlash', 'SummonerSmite'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'E', 'W'],
      skillUpOrder: ['Q', 'E', 'W'],
    },
    matchups: [
      {
        opponent: champ('Kindred', 'Kindred'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Duel early. Deny marks.',
      },
      {
        opponent: champ('Nidalee', 'Nidalee'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Tankier in brush. Invade raptors.',
      },
      {
        opponent: champ('Lillia', 'Lillia'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'self',
        comments: 'Invade early. She outscales.',
      },
      {
        opponent: champ('Amumu', 'Amumu'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Full invade level 3.',
      },
      {
        opponent: champ('Karthus', 'Karthus'),
        difficultyScore: 3,
        outcomeKind: 'win',
        comments: 'Steal camps. Punish slow clear.',
      },
      {
        opponent: champ('Viego', 'Viego'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Reset fights. Burst before soul.',
      },
      {
        opponent: champ('Elise', 'Elise'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Cocoon stop dash. Track form.',
      },
      {
        opponent: champ('LeeSin', 'Lee Sin'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Respect early duel. Farm if behind.',
      },
      {
        opponent: champ('XinZhao', 'Xin Zhao'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'even',
        comments: 'Kite with E. Red smite duel.',
      },
      {
        opponent: champ('Olaf', 'Olaf'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'R ignore CC. Kite with colt.',
      },
    ],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000010',
    guideName: "Kai'Sa — Hypercarry scaling",
    author: 'KaisaEnjoyer',
    shortDescription: 'Farm jusqu\'à 2 items, poke W upgrade. R reposition teamfight.',
    description:
      'Hypercarry scaling : farm jusqu\'à 2 items, poke avec W upgrade. R reposition en teamfight.',
    champion: champ('Kaisa', "Kai'Sa"),
    role: 'adc',
    tags: ['otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    meta: {
      shortDescription: 'Farm jusqu\'à 2 items, poke W upgrade. R reposition teamfight.',
      authorAbout: "Kai'Sa OTP, evolution timing et teamfight positioning.",
      opggUrl: 'https://www.op.gg/summoners/euw/KaisaEnjoyer-EU',
      permabanNotes: 'Draven, Caitlyn — lane impossible.',
      generalBuildNotes: 'AP on-hit vs frontline. Crit vs squishies. Evolve W first vs poke.',
    },
    buildItems: ['1055', '2003', '3155', '3085', '3115', '3124', '3006', '3031'],
    buildRunes: precisionPrimary,
    buildShards: { slot1: 5005, slot2: 5008, slot3: 5011 },
    buildSpells: ['SummonerFlash', 'SummonerHeal'],
    buildSkillOrder: {
      firstThreeUps: ['Q', 'E', 'W'],
      skillUpOrder: ['Q', 'E', 'W'],
    },
    matchups: [
      {
        opponent: champ('Jinx', 'Jinx'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'Outscale. E dodge rockets.',
        midNotes: 'Farm until 2 items.',
      },
      {
        opponent: champ('Aphelios', 'Aphelios'),
        difficultyScore: 4,
        outcomeKind: 'win',
        comments: 'R reposition vs grav. Scale faster.',
      },
      {
        opponent: champ('Twitch', 'Twitch'),
        difficultyScore: 5,
        outcomeKind: 'skill',
        skillFavor: 'self',
        comments: 'R reveal stealth. W poke evolution.',
      },
      {
        opponent: champ('Varus', 'Varus'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Poke war. Farm and scale.',
      },
      {
        opponent: champ('Ezreal', 'Ezreal'),
        difficultyScore: 5,
        outcomeKind: 'even',
        comments: 'Both scale. Teamfight diff.',
      },
      {
        opponent: champ('Ashe', 'Ashe'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Slow = death. R peel or flash.',
      },
      {
        opponent: champ('Caitlyn', 'Caitlyn'),
        difficultyScore: 8,
        outcomeKind: 'lose',
        comments: 'Poke lane. Survive, farm under tower.',
      },
      {
        opponent: champ('Draven', 'Draven'),
        difficultyScore: 9,
        outcomeKind: 'lose',
        comments: 'Lane bully. Scale and avoid fights.',
        earlyNotes: 'Give up prio, farm.',
      },
      {
        opponent: champ('Samira', 'Samira'),
        difficultyScore: 7,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'R reposition vs R. Exhaust key.',
      },
      {
        opponent: champ('Lucian', 'Lucian'),
        difficultyScore: 6,
        outcomeKind: 'skill',
        skillFavor: 'opponent',
        comments: 'Lose early. Win mid with items.',
        powerLevels: [11, 16],
      },
    ],
  },
]

const guides = guideSeeds.map(assembleGuide)

await mkdir(guidesDir, { recursive: true })

for (const guide of guides) {
  const fileName = `${guide.id}.json`
  const filePath = join(guidesDir, fileName)
  await writeFile(filePath, JSON.stringify({ ...guide, fileName, savedAt: now }, null, 2), 'utf8')
  console.log(`Wrote ${fileName}`)
}

console.log(`Seeded ${guides.length} matchup guides → ${guidesDir}`)
