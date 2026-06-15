/** Major patch (e.g. 16) → saison LoL affichée en SEO FR (e.g. 26). */
export function lolSeasonFromPatchMajor(major: number): number {
  return major + 10
}

export function lolSeasonFromGameVersion(version: string): number {
  const major = Number(String(version).split('.')[0])
  return Number.isFinite(major) && major > 0 ? lolSeasonFromPatchMajor(major) : 26
}
