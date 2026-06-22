import type { BuildSurveillanceTrigger } from './buildSurveillance'
import type { SurveillanceAlertTrigger } from './statisticsSurveillanceAlerts'

export type SurveillanceAlertFilterId =
  | 'championWinrateUp'
  | 'championWinrateDown'
  | 'championPickrateUp'
  | 'championPickrateDown'
  | 'championBanrateUp'
  | 'championBanrateDown'
  | 'championMin'
  | 'championMax'
  | 'buildNew'
  | 'buildWinrateUp'
  | 'buildWinrateDown'
  | 'buildPickrateUp'
  | 'buildPickrateDown'
  | 'buildMin'
  | 'buildMax'

export const CHAMPION_SURVEILLANCE_ALERT_FILTERS: SurveillanceAlertFilterId[] = [
  'championWinrateUp',
  'championWinrateDown',
  'championPickrateUp',
  'championPickrateDown',
  'championBanrateUp',
  'championBanrateDown',
  'championMin',
  'championMax',
]

export const BUILD_SURVEILLANCE_ALERT_FILTERS: SurveillanceAlertFilterId[] = [
  'buildNew',
  'buildWinrateUp',
  'buildWinrateDown',
  'buildPickrateUp',
  'buildPickrateDown',
  'buildMin',
  'buildMax',
]

export function isChampionSurveillanceFilter(id: SurveillanceAlertFilterId): boolean {
  return id.startsWith('champion')
}

export function isBuildSurveillanceFilter(id: SurveillanceAlertFilterId): boolean {
  return id.startsWith('build')
}

function deltaDirection(current: number, reference: number): 'up' | 'down' | 'flat' {
  const diff = current - reference
  if (diff > 0) return 'up'
  if (diff < 0) return 'down'
  return 'flat'
}

export function statsTriggerMatchesFilter(
  trigger: SurveillanceAlertTrigger,
  filterId: SurveillanceAlertFilterId
): boolean {
  switch (filterId) {
    case 'championMin':
      return trigger.kind === 'min'
    case 'championMax':
      return trigger.kind === 'max'
    case 'championWinrateUp':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'winrate' &&
        deltaDirection(trigger.current, trigger.reference) === 'up'
      )
    case 'championWinrateDown':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'winrate' &&
        deltaDirection(trigger.current, trigger.reference) === 'down'
      )
    case 'championPickrateUp':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'pickrate' &&
        deltaDirection(trigger.current, trigger.reference) === 'up'
      )
    case 'championPickrateDown':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'pickrate' &&
        deltaDirection(trigger.current, trigger.reference) === 'down'
      )
    case 'championBanrateUp':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'banrate' &&
        deltaDirection(trigger.current, trigger.reference) === 'up'
      )
    case 'championBanrateDown':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'banrate' &&
        deltaDirection(trigger.current, trigger.reference) === 'down'
      )
    default:
      return false
  }
}

export function buildTriggerMatchesFilter(
  trigger: BuildSurveillanceTrigger,
  filterId: SurveillanceAlertFilterId
): boolean {
  switch (filterId) {
    case 'buildNew':
      return trigger.kind === 'new'
    case 'buildMin':
      return trigger.kind === 'min'
    case 'buildMax':
      return trigger.kind === 'max'
    case 'buildWinrateUp':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'winrate' &&
        (trigger.delta ?? trigger.current - (trigger.reference ?? 0)) > 0
      )
    case 'buildWinrateDown':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'winrate' &&
        (trigger.delta ?? trigger.current - (trigger.reference ?? 0)) < 0
      )
    case 'buildPickrateUp':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'pickrate' &&
        (trigger.delta ?? trigger.current - (trigger.reference ?? 0)) > 0
      )
    case 'buildPickrateDown':
      return (
        trigger.kind === 'delta' &&
        trigger.metric === 'pickrate' &&
        (trigger.delta ?? trigger.current - (trigger.reference ?? 0)) < 0
      )
    default:
      return false
  }
}

export function filterStatsTriggers(
  triggers: readonly SurveillanceAlertTrigger[],
  activeFilters: readonly SurveillanceAlertFilterId[]
): SurveillanceAlertTrigger[] {
  const championFilters = activeFilters.filter(isChampionSurveillanceFilter)
  if (championFilters.length === 0) return [...triggers]
  return triggers.filter(trigger =>
    championFilters.some(filterId => statsTriggerMatchesFilter(trigger, filterId))
  )
}

export function filterBuildTriggers(
  triggers: readonly BuildSurveillanceTrigger[],
  activeFilters: readonly SurveillanceAlertFilterId[]
): BuildSurveillanceTrigger[] {
  const buildFilters = activeFilters.filter(isBuildSurveillanceFilter)
  if (buildFilters.length === 0) return [...triggers]
  return triggers.filter(trigger =>
    buildFilters.some(filterId => buildTriggerMatchesFilter(trigger, filterId))
  )
}

export function championMatchesAlertFilters(
  statsTriggers: readonly SurveillanceAlertTrigger[],
  buildTriggers: readonly BuildSurveillanceTrigger[],
  activeFilters: readonly SurveillanceAlertFilterId[]
): boolean {
  if (activeFilters.length === 0) return true

  const championFilters = activeFilters.filter(isChampionSurveillanceFilter)
  const buildFilters = activeFilters.filter(isBuildSurveillanceFilter)

  const statsOk =
    championFilters.length === 0 ||
    statsTriggers.some(trigger =>
      championFilters.some(filterId => statsTriggerMatchesFilter(trigger, filterId))
    )

  const buildsOk =
    buildFilters.length === 0 ||
    buildTriggers.some(trigger =>
      buildFilters.some(filterId => buildTriggerMatchesFilter(trigger, filterId))
    )

  return statsOk && buildsOk
}

export function toggleSurveillanceAlertFilter(
  active: readonly SurveillanceAlertFilterId[],
  filterId: SurveillanceAlertFilterId
): SurveillanceAlertFilterId[] {
  return active.includes(filterId) ? active.filter(id => id !== filterId) : [...active, filterId]
}
