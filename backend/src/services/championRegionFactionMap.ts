/** Maps LoL Universe `associated-faction-slug` values to Lelanation region keys. */
export const UNIVERSE_FACTION_SLUG_TO_REGION: Record<string, string> = {
  demacia: 'demacia',
  noxus: 'noxus',
  ionia: 'ionia',
  freljord: 'freljord',
  'shadow-isles': 'shadow_isles',
  shurima: 'shurima',
  piltover: 'piltover',
  zaun: 'zaun',
  bilgewater: 'bilgewater',
  'mount-targon': 'targon',
  void: 'void',
  ixtal: 'ixtal',
  'bandle-city': 'bandle',
  unaffiliated: 'runeterra',
}

export function mapUniverseFactionSlug(slug: string): string | null {
  return UNIVERSE_FACTION_SLUG_TO_REGION[slug] ?? null
}

export function normalizeChampionKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}
