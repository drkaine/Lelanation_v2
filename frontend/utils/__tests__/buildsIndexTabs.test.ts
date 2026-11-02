import { describe, expect, it } from 'vitest'
import {
  buildsTabFromPath,
  buildsTabPath,
  showTeamBuildsTab,
  tabAfterBuildChange,
} from '../buildsIndexTabs'

describe('buildsIndexTabs', () => {
  it('maps_team_tab_to_its_page', () => {
    expect(buildsTabPath('team')).toBe('/builds/team')
    expect(buildsTabPath('my-builds')).toBe('/builds/my-builds')
    expect(buildsTabPath('unknown')).toBe('/builds/discover')
  })

  it('reads_tab_from_path', () => {
    expect(buildsTabFromPath('/en/builds/team')).toBe('team')
    expect(buildsTabFromPath('/builds/favoris')).toBe('favoris')
    expect(buildsTabFromPath('/builds')).toBeUndefined()
  })

  it('team_tab_only_for_logged_accounts', () => {
    expect(showTeamBuildsTab(null)).toBe(false)
    expect(showTeamBuildsTab('lelateam')).toBe(true)
    expect(showTeamBuildsTab('lelariva')).toBe(true)
  })

  it('team_builds_end_on_the_team_tab_after_save_or_delete', () => {
    expect(tabAfterBuildChange({ teamShared: true })).toBe('team')
    expect(tabAfterBuildChange({ teamShared: false })).toBe('my-builds')
    expect(tabAfterBuildChange(null)).toBe('my-builds')
  })
})
