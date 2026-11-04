/** Groupe « Apprendre » de la nav : boutique d'items, vidéos, guides champions. */
export type LearnSectionId = 'items' | 'videos' | 'guides'

const LEARN_SECTION_RE = /^(?:\/en)?\/(items|videos|guides)(?:\/|$)/

/** Entrée du groupe Apprendre active pour ce chemin, ou null hors du groupe. */
export function learnSectionActiveId(path: string): LearnSectionId | null {
  const m = LEARN_SECTION_RE.exec(path)
  return m ? (m[1] as LearnSectionId) : null
}
