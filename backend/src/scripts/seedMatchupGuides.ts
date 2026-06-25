/**
 * Seed public matchup guide JSON files into backend/data/matchup-guides/
 * Run: npm run seed:matchup-guides (from backend/)
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const guidesDir = join(process.cwd(), 'data', 'matchup-guides')

const now = new Date().toISOString()
const currentPatch = '16.13.1'
const olderPatch = '16.11.1'

function champ(id: string, name: string) {
  return { id, name, image: { full: `${id}.png` } }
}

const guides = [
  {
    id: 'f1a10001-0001-4001-8001-000000000001',
    author: 'Lelariva',
    description:
      'Assassin mid orienté lane bully. Short trades avec W, évite les all-in longs avant item spike. Priorise la prio pour roam bot.',
    visibility: 'public',
    champion: champ('Zed', 'Zed'),
    role: 'mid',
    tags: ['pro'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    bestMatchups: [champ('Veigar', 'Veigar'), champ('Lux', 'Lux'), champ('Xerath', 'Xerath')],
    worstMatchups: [champ('Malzahar', 'Malzahar'), champ('Annie', 'Annie'), champ('Talon', 'Talon')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000002',
    author: 'Darkaine',
    description:
      'Top bully Grasp : joue court, push lent pour setup gank. Reset après chaque trade et abuse les plates.',
    visibility: 'public',
    champion: champ('Darius', 'Darius'),
    role: 'top',
    tags: ['otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    bestMatchups: [champ('Garen', 'Garen'), champ('Sion', 'Sion'), champ('Chogath', "Cho'Gath")],
    worstMatchups: [champ('Quinn', 'Quinn'), champ('Vayne', 'Vayne'), champ('Jax', 'Jax')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000003',
    author: 'SupportLab',
    description:
      'Engage support : hook angles depuis le bush, roam mid après push bot. Contrôle dragon et vision pixel.',
    visibility: 'public',
    champion: champ('Thresh', 'Thresh'),
    role: 'support',
    tags: ['pro', 'otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    bestMatchups: [champ('Blitzcrank', 'Blitzcrank'), champ('Morgana', 'Morgana'), champ('Jinx', 'Jinx')],
    worstMatchups: [champ('Morgana', 'Morgana'), champ('Lulu', 'Lulu'), champ('Ezreal', 'Ezreal')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000004',
    author: 'JungleDiff',
    description:
      'Early game jungler : clear 3 camps puis gank mid si prio. Invade seulement si les laners ont push.',
    visibility: 'public',
    champion: champ('LeeSin', 'Lee Sin'),
    role: 'jungle',
    tags: ['pro'],
    gameVersion: olderPatch,
    createdAt: '2026-06-10T12:00:00.000Z',
    updatedAt: '2026-06-10T12:00:00.000Z',
    patchStale: { flaggedAt: '2026-06-20T00:00:00.000Z', patchAtFlag: olderPatch },
    bestMatchups: [champ('Amumu', 'Amumu'), champ('Karthus', 'Karthus'), champ('Evelynn', 'Evelynn')],
    worstMatchups: [champ('Viego', 'Viego'), champ('Graves', 'Graves'), champ('Olaf', 'Olaf')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000005',
    author: 'ADCFrance',
    description:
      'Lane bully niveau 1-3 : push level 2 avec support engage. Trade quand passive est disponible.',
    visibility: 'public',
    champion: champ('Lucian', 'Lucian'),
    role: 'adc',
    tags: ['otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    bestMatchups: [champ('Caitlyn', 'Caitlyn'), champ('Ezreal', 'Ezreal'), champ('KogMaw', "Kog'Maw")],
    worstMatchups: [champ('Caitlyn', 'Caitlyn'), champ('Ashe', 'Ashe'), champ('Draven', 'Draven')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000006',
    author: 'MidGap',
    description:
      'Mage mobile : farm safe jusqu\'à 6, roam bot avec push. Charm sous tour seulement avec jungler.',
    visibility: 'public',
    champion: champ('Ahri', 'Ahri'),
    role: 'mid',
    tags: ['pro'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    bestMatchups: [champ('Syndra', 'Syndra'), champ('Veigar', 'Veigar'), champ('Lux', 'Lux')],
    worstMatchups: [champ('Sylas', 'Sylas'), champ('Kassadin', 'Kassadin'), champ('Galio', 'Galio')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000007',
    author: 'TopGap',
    description:
      'Split vs teamfight : Camille split si TP up. Ne fight 5v5 sans spike item Hullbreaker.',
    visibility: 'public',
    champion: champ('Camille', 'Camille'),
    role: 'top',
    tags: ['otp'],
    gameVersion: olderPatch,
    createdAt: '2026-06-05T10:00:00.000Z',
    updatedAt: '2026-06-05T10:00:00.000Z',
    patchStale: { flaggedAt: '2026-06-18T00:00:00.000Z', patchAtFlag: olderPatch },
    bestMatchups: [champ('Ornn', 'Ornn'), champ('Sion', 'Sion'), champ('Malphite', 'Malphite')],
    worstMatchups: [champ('Fiora', 'Fiora'), champ('Jax', 'Jax'), champ('Teemo', 'Teemo')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000008',
    author: 'NamiOTP',
    description:
      'Enchanter peel : E sur l\'ADC en trade, R pour disengage. Bubble sur CC chain allié.',
    visibility: 'public',
    champion: champ('Nami', 'Nami'),
    role: 'support',
    tags: ['otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    bestMatchups: [champ('Samira', 'Samira'), champ('Draven', 'Draven'), champ('Lucian', 'Lucian')],
    worstMatchups: [champ('Lulu', 'Lulu'), champ('Janna', 'Janna'), champ('Yuumi', 'Yuumi')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000009',
    author: 'GravesMain',
    description:
      'Tempo jungle : full clear rapide, contest scuttle avec prio mid. Invade early si ahead.',
    visibility: 'public',
    champion: champ('Graves', 'Graves'),
    role: 'jungle',
    tags: ['pro', 'otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    bestMatchups: [champ('Kindred', 'Kindred'), champ('Nidalee', 'Nidalee'), champ('Lillia', 'Lillia')],
    worstMatchups: [champ('Elise', 'Elise'), champ('LeeSin', 'Lee Sin'), champ('XinZhao', 'Xin Zhao')],
  },
  {
    id: 'f1a10001-0001-4001-8001-000000000010',
    author: 'KaisaEnjoyer',
    description:
      'Hypercarry scaling : farm jusqu\'à 2 items, poke avec W upgrade. R reposition en teamfight.',
    visibility: 'public',
    champion: champ('Kaisa', "Kai'Sa"),
    role: 'adc',
    tags: ['otp'],
    gameVersion: currentPatch,
    createdAt: now,
    updatedAt: now,
    bestMatchups: [champ('Jinx', 'Jinx'), champ('Aphelios', 'Aphelios'), champ('Twitch', 'Twitch')],
    worstMatchups: [champ('Caitlyn', 'Caitlyn'), champ('Draven', 'Draven'), champ('Samira', 'Samira')],
  },
]

await mkdir(guidesDir, { recursive: true })

for (const guide of guides) {
  const fileName = `${guide.id}.json`
  const filePath = join(guidesDir, fileName)
  await writeFile(filePath, JSON.stringify({ ...guide, fileName, savedAt: now }, null, 2), 'utf8')
  console.log(`Wrote ${fileName}`)
}

console.log(`Seeded ${guides.length} matchup guides → ${guidesDir}`)
