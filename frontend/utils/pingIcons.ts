import type { PingMetricKey } from '~/composables/statistics/useStatisticsPingsTab'

/**
 * Icônes pings minimap (Community Dragon).
 * Fichiers dans frontend/public/data/community-dragon/minimap-pings/
 * @see backend CommunityDragonService.syncMinimapPingIcons()
 */
const LOCAL_BASE = '/data/community-dragon/minimap-pings'
const CD_MINIMAP_PINGS = 'https://raw.communitydragon.org/latest/game/assets/ux/minimap/pings'

function local(file: string): string {
  return `${LOCAL_BASE}/${file}`
}

function cdPing(file: string): string {
  return `${CD_MINIMAP_PINGS}/${file}`
}

/** Fichier PNG CD pour chaque métrique affichée dans l’onglet Pings. */
export const pingIconFileByMetricKey: Record<PingMetricKey, string> = {
  allIn: 'all_in.png',
  assistMe: 'assist.png',
  basic: 'ping.png',
  danger: 'get_back_small.png',
  enemyMissing: 'mia_new.png',
  enemyVision: 'area_is_warded_small_red_new.png',
  needVision: 'need_ward.png',
  onMyWay: 'on_my_way_new.png',
  push: 'push.png',
  retreat: 'retreat.png',
}

export const pingIconByMetricKey: Record<PingMetricKey, string> = Object.fromEntries(
  Object.entries(pingIconFileByMetricKey).map(([key, file]) => [key, local(file)])
) as Record<PingMetricKey, string>

export const pingIconCdByMetricKey: Record<PingMetricKey, string> = Object.fromEntries(
  Object.entries(pingIconFileByMetricKey).map(([key, file]) => [key, cdPing(file)])
) as Record<PingMetricKey, string>

export function pingIconSrc(key: PingMetricKey): string {
  return pingIconByMetricKey[key]
}

export function onPingIconError(e: Event, key: PingMetricKey): void {
  const el = e.target as HTMLImageElement
  if (el.dataset.cdFallback === '1') return
  const url = pingIconCdByMetricKey[key]
  if (url) {
    el.dataset.cdFallback = '1'
    el.src = url
  }
}
