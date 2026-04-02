import type { Build, SubBuild } from '~/types/build'

/** Build affiché pour une variante (sub) donnée — même logique que la fiche détail. */
export function resolveDisplayedBuild(base: Build, subIndex: number | null): Build {
  if (subIndex === null) return base
  const subs = (base.subBuilds as SubBuild[] | undefined) ?? []
  const sub = subs[subIndex]
  if (!sub) return base
  return {
    ...base,
    items: sub.items,
    runes: sub.runes,
    shards: sub.shards,
    summonerSpells: sub.summonerSpells,
    skillOrder: sub.skillOrder,
    roles: sub.roles,
    description: sub.description ?? base.description,
    gameVersion: sub.gameVersion || base.gameVersion,
  } as Build
}

/** Texte description pour le bloc « meta » (image partagée avec auteur + description). */
export function descriptionTextForMetaShare(base: Build, displayed: Build): string {
  const mode = base.descriptionMode ?? 'single'
  if (mode === 'single') {
    return (base.description ?? '').trim()
  }
  return (displayed.description ?? '').trim()
}
