export function getRiotNewsLocale(currentLocale: string): string {
  const base = currentLocale.split('-')[0]?.toLowerCase() ?? 'en'
  const localeMap: Record<string, string> = {
    fr: 'fr-fr',
    en: 'en-us',
  }
  return localeMap[base] || 'en-us'
}

export function getOfficialPatchNotesUrl(version: string, locale: string): string {
  const riotLocale = getRiotNewsLocale(locale)
  const v = String(version || '').trim()
  const parts = v.match(/\d+/g) ?? []
  const gameMajor = Number(parts[0] ?? NaN)
  const gameMinor = Number(parts[1] ?? NaN)

  if (Number.isFinite(gameMajor) && Number.isFinite(gameMinor)) {
    const patchMajor = gameMajor + 10
    return `https://www.leagueoflegends.com/${riotLocale}/news/game-updates/league-of-legends-patch-${patchMajor}-${gameMinor}-notes/`
  }

  const slug = v.replace(/\./g, '-')
  return `https://www.leagueoflegends.com/${riotLocale}/news/game-updates/league-of-legends-patch-${slug}-notes/`
}
