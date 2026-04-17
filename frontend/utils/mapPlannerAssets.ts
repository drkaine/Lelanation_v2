export interface MapPlannerAsset {
  id: string
  name: string
  localPath: string
  fallbackUrl: string
}

export interface MapPlannerIconAsset {
  key: string
  label: string
  localPath: string
  fallbackUrl: string
}

export const MAP_PLANNER_MAPS: MapPlannerAsset[] = [
  {
    id: 'summoners-rift',
    name: "Summoner's Rift",
    localPath: '/data/community-dragon/map-planner/map11.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/map11.png',
  },
]

export const MAP_PLANNER_ICONS: MapPlannerIconAsset[] = [
  {
    key: 'inhibitor-blue',
    label: 'Inhibiteur bleu',
    localPath: '/data/community-dragon/map-planner/inhibitor-100.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/inhibitor-100.png',
  },
  {
    key: 'inhibitor-red',
    label: 'Inhibiteur rouge',
    localPath: '/data/community-dragon/map-planner/inhibitor-200.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/inhibitor-200.png',
  },
  {
    key: 'herald-blue',
    label: 'Herald bleu',
    localPath: '/data/community-dragon/map-planner/herald-100.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-100.png',
  },
  {
    key: 'herald-red',
    label: 'Herald rouge',
    localPath: '/data/community-dragon/map-planner/herald-200.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/herald-200.png',
  },
  {
    key: 'dead-blue',
    label: 'Mort bleu',
    localPath: '/data/community-dragon/map-planner/dead_blue.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dead_blue.png',
  },
  {
    key: 'dead-red',
    label: 'Mort rouge',
    localPath: '/data/community-dragon/map-planner/dead_red.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/dead_red.png',
  },
  {
    key: 'baron-blue',
    label: 'Baron bleu',
    localPath: '/data/community-dragon/map-planner/baron-100.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-100.png',
  },
  {
    key: 'baron-red',
    label: 'Baron rouge',
    localPath: '/data/community-dragon/map-planner/baron-200.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/baron-200.png',
  },
  {
    key: 'nexus-blue',
    label: 'Nexus bleu',
    localPath: '/data/community-dragon/map-planner/nexus_building_blue.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/nexus_building_blue.png',
  },
  {
    key: 'nexus-red',
    label: 'Nexus rouge',
    localPath: '/data/community-dragon/map-planner/nexus_building_red.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/nexus_building_red.png',
  },
  {
    key: 'tower-blue',
    label: 'Tour bleue',
    localPath: '/data/community-dragon/map-planner/tower-100.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/tower-100.png',
  },
  {
    key: 'tower-red',
    label: 'Tour rouge',
    localPath: '/data/community-dragon/map-planner/tower-200.png',
    fallbackUrl:
      'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-match-history/global/default/tower-200.png',
  },
]
