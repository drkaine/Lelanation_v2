import {
  formatSurveillanceCohortLabel,
  surveillanceAlertTone,
  type SurveillanceAlertTone,
  type SurveillanceAlertTrigger,
  type SurveillanceMetricId,
} from './statisticsSurveillanceAlerts'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

const METRIC_LABEL_KEYS: Record<SurveillanceMetricId, string> = {
  winrate: 'statisticsPage.winrate',
  pickrate: 'statisticsPage.pickrate',
  banrate: 'statisticsPage.championStatsBanrateTitle',
}

function formatPct(value: number): string {
  return `${Number(value).toFixed(1)}%`
}

export function formatSurveillanceAlertTrigger(
  trigger: SurveillanceAlertTrigger,
  t: TranslateFn
): string {
  const metric = t(METRIC_LABEL_KEYS[trigger.metric])
  const cohort =
    trigger.cohortLabel ??
    (trigger.cohortKey ? formatSurveillanceCohortLabel(trigger.cohortKey, t) : '')

  const cohortPrefix = cohort ? `${t('statisticsPage.surveillanceAlertCohort', { cohort })} — ` : ''

  if (trigger.kind === 'min') {
    return (
      cohortPrefix +
      t('statisticsPage.surveillanceAlertMin', {
        metric,
        current: formatPct(trigger.current),
        threshold: formatPct(trigger.threshold),
      })
    )
  }
  if (trigger.kind === 'max') {
    return (
      cohortPrefix +
      t('statisticsPage.surveillanceAlertMax', {
        metric,
        current: formatPct(trigger.current),
        threshold: formatPct(trigger.threshold),
      })
    )
  }

  const delta = trigger.current - trigger.reference
  const sign = delta > 0 ? '+' : ''
  const patchLabel =
    trigger.patchLabel === 'demo'
      ? t('statisticsPage.settingsAlertsTestDemoReference')
      : (trigger.patchLabel ?? '—')
  return (
    cohortPrefix +
    t('statisticsPage.surveillanceAlertDelta', {
      metric,
      current: formatPct(trigger.current),
      reference: formatPct(trigger.reference),
      delta: `${sign}${delta.toFixed(1)}%`,
      threshold: formatPct(trigger.threshold),
      patch: patchLabel,
    })
  )
}

export type SurveillanceAlertLine = {
  text: string
  tone: SurveillanceAlertTone
}

export function formatSurveillanceAlertSummary(
  triggers: SurveillanceAlertTrigger[],
  t: TranslateFn
): SurveillanceAlertLine[] {
  return triggers.map(trigger => ({
    text: formatSurveillanceAlertTrigger(trigger, t),
    tone: surveillanceAlertTone(trigger),
  }))
}
