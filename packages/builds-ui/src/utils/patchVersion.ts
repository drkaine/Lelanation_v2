/** Affichage patch build : 16.16.1 → 16.16 */
export function formatGameVersionPatch(version: string | null | undefined): string {
  const parts = String(version ?? '')
    .trim()
    .split('.')
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`
  return parts[0] || ''
}
