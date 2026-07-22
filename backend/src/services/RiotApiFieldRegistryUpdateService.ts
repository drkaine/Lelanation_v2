import { promises as fs } from 'fs'
import { join } from 'path'
import { DiscordService } from './DiscordService.js'
import {
  buildFieldRegistryFromFixtures,
  type FieldRegistryDiff,
} from './RiotApiFieldRegistryBuilder.js'
import { readFieldRegistry, type FieldRegistry } from './RiotApiFieldRegistryService.js'

export type UpdateFieldRegistryFromFixturesOptions = {
  patch: string
  matchId?: string
  refreshedAt: string
  notifyDiscord?: boolean
}

export type UpdateFieldRegistryResult = {
  registry: FieldRegistry
  diff: FieldRegistryDiff
}

const REGISTRY_PATH = join(process.cwd(), 'data', 'api-riot', 'field-registry.json')

function chunkFieldLines(ids: string[], maxChars = 950): string[] {
  if (ids.length === 0) return ['_(aucun)_']
  const chunks: string[] = []
  let current = ''
  for (const id of ids) {
    const line = `- \`${id}\`\n`
    if (current.length + line.length > maxChars && current.length > 0) {
      chunks.push(current.trimEnd())
      current = line
    } else {
      current += line
    }
  }
  if (current.trim()) chunks.push(current.trimEnd())
  return chunks
}

async function notifyFieldDiffOnDiscord(
  diff: FieldRegistryDiff,
  meta: { patch: string; matchId?: string; refreshedAt: string },
): Promise<void> {
  const discord = new DiscordService()

  if (diff.removed.length > 0) {
    const chunks = chunkFieldLines(diff.removed)
    const fields = chunks.map((chunk, index) => ({
      name: chunks.length > 1 ? `Champs absents (${index + 1}/${chunks.length})` : 'Champs absents',
      value: chunk.substring(0, 1024),
      inline: false,
    }))
    await discord.sendCustomEmbed({
      title: `API Riot — ${diff.removed.length} champ(s) en moins (patch ${meta.patch})`,
      description: `Fixtures mises à jour le ${new Date(meta.refreshedAt).toISOString()}. Ces clés étaient présentes avant le refresh et ne sont plus dans \`match-id.json\` / \`timeline.json\`.`,
      color: 0xff4444,
      fields: [
        { name: 'Patch', value: meta.patch, inline: true },
        { name: 'Match', value: meta.matchId ?? '—', inline: true },
        ...fields,
      ],
    })
  }

  if (diff.added.length > 0) {
    const chunks = chunkFieldLines(diff.added)
    const fields = chunks.map((chunk, index) => ({
      name: chunks.length > 1 ? `Nouveaux champs (${index + 1}/${chunks.length})` : 'Nouveaux champs',
      value: chunk.substring(0, 1024),
      inline: false,
    }))
    await discord.sendCustomEmbed({
      title: `API Riot — ${diff.added.length} nouveau(x) champ(s) (patch ${meta.patch})`,
      description: `Fixtures mises à jour le ${new Date(meta.refreshedAt).toISOString()}. Ces clés apparaissent dans les nouvelles réponses Riot.`,
      color: 0xffd700,
      fields: [
        { name: 'Patch', value: meta.patch, inline: true },
        { name: 'Match', value: meta.matchId ?? '—', inline: true },
        ...fields,
      ],
    })
  }
}

export async function updateFieldRegistryFromFixtures(
  options: UpdateFieldRegistryFromFixturesOptions,
): Promise<UpdateFieldRegistryResult> {
  const previous = await readFieldRegistry().catch(() => null)
  const { registry, diff } = await buildFieldRegistryFromFixtures({
    diffAgainst: previous,
    fixtureMeta: {
      patch: options.patch,
      matchId: options.matchId,
      refreshedAt: options.refreshedAt,
    },
  })

  await fs.writeFile(REGISTRY_PATH, `${JSON.stringify(registry, null, 2)}\n`, 'utf-8')

  const shouldNotify =
    options.notifyDiscord !== false &&
    previous != null &&
    (diff.added.length > 0 || diff.removed.length > 0)
  if (shouldNotify) {
    await notifyFieldDiffOnDiscord(diff, options)
  }

  return { registry, diff }
}
