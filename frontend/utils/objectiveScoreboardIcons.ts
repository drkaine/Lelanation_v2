/**
 * Icônes objectifs / drakes (stats côtés bleu/rouge).
 * Fichiers produits par CommunityDragonService.syncScoreboardObjectiveIcons() dans
 * frontend/public/data/community-dragon/scoreboard-objectives/ (voir backend CommunityDragonService).
 * @see https://raw.communitydragon.org/latest/game/assets/ux/scoreboard
 */

const LOCAL_BASE = '/data/community-dragon/scoreboard-objectives'

const CD_SCOREBOARD = 'https://raw.communitydragon.org/latest/game/assets/ux/scoreboard'
const CD_MINIMAP = 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/icons'

function local(file: string): string {
  return `${LOCAL_BASE}/${file}`
}

function cdScoreboard(file: string): string {
  return `${CD_SCOREBOARD}/${file}`
}

function cdMinimap(file: string): string {
  return `${CD_MINIMAP}/${file}`
}

/** Icônes objectifs (baron, tours, etc.) — chemins locaux après sync CD. */
export const scoreboardObjectiveIconByKey: Record<string, string> = {
  baron: local('_baronnashor.png'),
  dragon: local('_dragon.png'),
  elder: local('_elderdrake.png'),
  tower: local('tower.png'),
  inhibitor: local('inhibitor.png'),
  riftHerald: local('_riftherald.png'),
  horde: local('grub.png'),
}

/** Repli CDN si les PNG locaux manquent (ex. avant premier sync). */
export const scoreboardObjectiveIconCdByKey: Record<string, string> = {
  baron: cdScoreboard('_baronnashor.png'),
  dragon: cdScoreboard('_dragon.png'),
  elder: cdScoreboard('_elderdrake.png'),
  tower: cdMinimap('tower.png'),
  inhibitor: cdMinimap('inhibitor.png'),
  riftHerald: cdScoreboard('_riftherald.png'),
  horde: cdMinimap('grub.png'),
}

/** Icônes par type de drake — locales. */
export const scoreboardDrakeIconByKey: Record<string, string> = {
  elder: local('_elderdrake.png'),
  earth: local('_mountaindrake.png'),
  water: local('_oceandrake.png'),
  wind: local('_clouddrake.png'),
  fire: local('_infernaldrake.png'),
  hextec: local('_hextechdrake.png'),
  chem: local('_chemtechdrake.png'),
}

export const scoreboardDrakeIconCdByKey: Record<string, string> = {
  elder: cdScoreboard('_elderdrake.png'),
  earth: cdScoreboard('_mountaindrake.png'),
  water: cdScoreboard('_oceandrake.png'),
  wind: cdScoreboard('_clouddrake.png'),
  fire: cdScoreboard('_infernaldrake.png'),
  hextec: cdScoreboard('_hextechdrake.png'),
  chem: cdScoreboard('_chemtechdrake.png'),
}
