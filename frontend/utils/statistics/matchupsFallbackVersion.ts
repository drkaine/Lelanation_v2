/** Patch précédent à proposer quand les matchups du patch courant sont vides (maquette ChampionPage). */
export function matchupsFallbackVersion(
  versions: ReadonlyArray<{ version: string }>,
  current: string
): string | null {
  const list = [...versions.map(v => v.version)].sort((a, b) =>
    b.localeCompare(a, undefined, { numeric: true })
  )
  const cur = current.trim() || list[0] || ''
  const idx = list.indexOf(cur)
  if (idx < 0) return null
  return list[idx + 1] ?? null
}
