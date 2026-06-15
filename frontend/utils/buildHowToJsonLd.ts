import type { Build } from '@lelanation/shared-types'

function stripHtml(value: string | undefined | null): string {
  if (!value) return ''
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Schema.org HowTo pour une page build (SEO). */
export function buildHowToJsonLdDocument(build: Build, siteUrl: string): Record<string, unknown> {
  const baseUrl = siteUrl.replace(/\/$/, '')
  const championName = build.champion?.name ?? 'Champion'
  const steps: Array<Record<string, unknown>> = []
  let position = 1

  for (const spell of build.summonerSpells ?? []) {
    if (spell?.name) {
      steps.push({
        '@type': 'HowToStep',
        position: position++,
        name: `Sort d'invocateur : ${spell.name}`,
      })
    }
  }

  for (const item of build.items ?? []) {
    if (!item?.name) continue
    const text = stripHtml(item.description || item.plaintext)
    steps.push({
      '@type': 'HowToStep',
      position: position++,
      name: item.name,
      ...(text ? { text: text.slice(0, 240) } : {}),
    })
  }

  const skillOrder = build.skillOrder?.skillUpOrder?.filter(Boolean) ?? []
  if (skillOrder.length > 0) {
    steps.push({
      '@type': 'HowToStep',
      position: position++,
      name: `Ordre de sorts : ${skillOrder.join(' → ')}`,
    })
  }

  if (steps.length === 0) {
    steps.push({
      '@type': 'HowToStep',
      position: 1,
      name: `Build ${championName}`,
    })
  }

  const description =
    stripHtml(build.description) ||
    `Build ${championName} : items, runes et ordre de sorts League of Legends.`

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: build.name || `Build ${championName}`,
    description: description.slice(0, 320),
    url: `${baseUrl}/builds/${build.id}`,
    step: steps,
  }
}
