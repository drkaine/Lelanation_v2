/**
 * Icônes objectifs / drakes pour les stats (côtés bleu/rouge).
 * Les chemins /data/community-dragon/scoreboard-objectives/*.png ne sont pas versionnés
 * dans le repo : on utilise des SVG inline (data URLs) pour éviter 404/500 en prod.
 */
function svgDataUrl(inner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">${inner}</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const elderDragonIcon = svgDataUrl(
  '<path fill="#fb923c" d="M6 17c4-9 16-9 20 0-4 3-6 8-6 11H12c0-3-2-8-6-11z"/><circle cx="16" cy="12" r="3" fill="#ffedd5"/>'
)

/** Icônes objectifs (baron, tours, etc.) */
export const scoreboardObjectiveIconByKey: Record<string, string> = {
  baron: svgDataUrl(
    '<circle cx="16" cy="16" r="13" stroke="#c084fc" stroke-width="2"/><path stroke="#c084fc" stroke-width="2" stroke-linecap="round" d="M10 20c2-4 10-4 12 0"/><circle cx="12" cy="13" r="1.5" fill="#e9d5ff"/><circle cx="20" cy="13" r="1.5" fill="#e9d5ff"/>'
  ),
  dragon: svgDataUrl(
    '<path fill="#f87171" d="M6 18c4-8 16-8 20 0-3 2-5 6-5 10H11c0-4-2-8-5-10z"/><path fill="#fecaca" d="M10 14h12v2H10z"/>'
  ),
  elder: elderDragonIcon,
  tower: svgDataUrl(
    '<path stroke="#94a3b8" stroke-width="2" d="M10 26V10h12v16"/><path stroke="#cbd5e1" stroke-width="1.5" d="M8 10h16M12 10V6h8v4"/><path stroke="#64748b" d="M13 14h6M13 18h6M13 22h6"/>'
  ),
  inhibitor: svgDataUrl(
    '<path fill="#38bdf8" d="M16 4l10 8v12H6V12l10-8z" opacity=".9"/><path stroke="#0ea5e9" stroke-width="1.5" d="M16 9v14M11 13h10"/>'
  ),
  riftHerald: svgDataUrl(
    '<ellipse cx="16" cy="18" rx="10" ry="7" stroke="#a78bfa" stroke-width="2"/><circle cx="16" cy="12" r="5" stroke="#c4b5fd" stroke-width="2"/><circle cx="14" cy="11" r="1" fill="#ddd6fe"/><circle cx="18" cy="11" r="1" fill="#ddd6fe"/>'
  ),
  horde: svgDataUrl(
    '<circle cx="10" cy="20" r="3" fill="#84cc16"/><circle cx="16" cy="17" r="3.5" fill="#a3e635"/><circle cx="22" cy="20" r="3" fill="#84cc16"/><path stroke="#4d7c0f" stroke-width="1" d="M8 24h16"/>'
  ),
}

/** Icônes par type de drake (couleurs proches du client) */
export const scoreboardDrakeIconByKey: Record<string, string> = {
  elder: elderDragonIcon,
  earth: svgDataUrl('<path fill="#ca8a04" d="M6 18c4-8 16-8 20 0-3 2-5 6-5 10H11c0-4-2-8-5-10z"/>'),
  water: svgDataUrl('<path fill="#0ea5e9" d="M6 18c4-8 16-8 20 0-3 2-5 6-5 10H11c0-4-2-8-5-10z"/>'),
  wind: svgDataUrl('<path fill="#94a3b8" d="M6 18c4-8 16-8 20 0-3 2-5 6-5 10H11c0-4-2-8-5-10z"/>'),
  fire: svgDataUrl('<path fill="#ef4444" d="M6 18c4-8 16-8 20 0-3 2-5 6-5 10H11c0-4-2-8-5-10z"/>'),
  hextec: svgDataUrl(
    '<path fill="#8b5cf6" d="M6 18c4-8 16-8 20 0-3 2-5 6-5 10H11c0-4-2-8-5-10z"/>'
  ),
  chem: svgDataUrl('<path fill="#22c55e" d="M6 18c4-8 16-8 20 0-3 2-5 6-5 10H11c0-4-2-8-5-10z"/>'),
}
