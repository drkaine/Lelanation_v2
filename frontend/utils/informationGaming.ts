/** Page Information « gaming » (/test/information) : onglets, sections, sommaire. */
import { legalSectionAnchor } from '~/utils/legalPageGaming'

export type InfoTabId = 'calculations' | 'builds' | 'surveillance' | 'shortcuts' | 'data'

export type InfoSectionKey =
  | 'filters'
  | 'ranks'
  | 'metrics'
  | 'tierList'
  | 'matchups'
  | 'laneProfile'
  | 'visibility'
  | 'patchStale'
  | 'championRegions'
  | 'surveillance'
  | 'shortcutsIntro'
  | 'shortcutOptions'
  | 'shortcutNavigation'
  | 'data'

type InfoSectionDef = { key: InfoSectionKey; titleKey: string; icon: string }
type InfoTabDef = { id: InfoTabId; labelKey: string; icon: string; sections: InfoSectionDef[] }

const section = (key: InfoSectionKey, titleKey: string, icon: string): InfoSectionDef => ({
  key,
  titleKey,
  icon,
})

export const INFO_TABS: InfoTabDef[] = [
  {
    id: 'calculations',
    labelKey: 'information.tabs.calculations',
    icon: 'mdi:calculator-variant-outline',
    sections: [
      section('filters', 'information.filters.title', 'mdi:filter-variant'),
      section('ranks', 'information.ranks.title', 'mdi:podium'),
      section('metrics', 'information.metrics.title', 'mdi:percent-outline'),
      section('tierList', 'information.tierList.title', 'mdi:format-list-numbered'),
      section('matchups', 'information.matchups.title', 'mdi:sword-cross'),
      section(
        'laneProfile',
        'information.matchups.laneProfile.title',
        'mdi:chart-timeline-variant'
      ),
    ],
  },
  {
    id: 'builds',
    labelKey: 'information.tabs.builds',
    icon: 'mdi:hammer-wrench',
    sections: [
      section('visibility', 'information.builds.visibility.title', 'mdi:eye-outline'),
      section('patchStale', 'information.builds.patchStale.title', 'mdi:update'),
      section('championRegions', 'information.builds.championRegions.title', 'mdi:earth'),
    ],
  },
  {
    id: 'surveillance',
    labelKey: 'information.tabs.surveillance',
    icon: 'mdi:radar',
    sections: [section('surveillance', 'information.surveillance.title', 'mdi:radar')],
  },
  {
    id: 'shortcuts',
    labelKey: 'information.tabs.shortcuts',
    icon: 'mdi:keyboard-outline',
    sections: [
      section('shortcutsIntro', 'information.tabs.shortcuts', 'mdi:keyboard-outline'),
      section('shortcutOptions', 'information.shortcuts.optionsTitle', 'mdi:tune-variant'),
      section('shortcutNavigation', 'information.shortcuts.navigationTitle', 'mdi:compass-outline'),
    ],
  },
  {
    id: 'data',
    labelKey: 'information.tabs.data',
    icon: 'mdi:database-outline',
    sections: [section('data', 'information.data.title', 'mdi:database-outline')],
  },
]

const DEFAULT_INFO_TAB: InfoTabId = 'calculations'

/** Onglet depuis `?tab=` (valeur inconnue ou absente → calculs). */
export function infoTabFromQuery(value: unknown): InfoTabId {
  const raw = Array.isArray(value) ? value[0] : value
  return INFO_TABS.find(tab => tab.id === raw)?.id ?? DEFAULT_INFO_TAB
}

export type InfoTocEntry = { index: string; anchor: string; titleKey: string; icon: string }

export function infoToc(tabId: InfoTabId): InfoTocEntry[] {
  const tab = INFO_TABS.find(t => t.id === tabId) ?? INFO_TABS[0]!
  return tab.sections.map((s, i) => ({
    index: String(i + 1).padStart(2, '0'),
    anchor: legalSectionAnchor(s.key),
    titleKey: s.titleKey,
    icon: s.icon,
  }))
}
