import type {
  BuildSurveillanceTrigger,
  buildSurveillanceAlertTone,
  type BuildSurveillanceMetricId,
} from './buildSurveillance'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

const METRIC_LABEL_KEYS: Record<BuildSurveillanceMetricId, string> = {
  winrate: 'statisticsPage.winrate',
  pickrate: 'statisticsPage.pickrate',
}

function formatPct(value: number): string {
  return `${Number(value).toFixed(1)}%`
}

export function formatBuildSurveillanceTrigger(
  trigger: BuildSurveillanceTrigger,
  t: TranslateFn
): { text: string; tone: 'positive' | 'negative' | 'neutral' } {
  if (trigger.kind === 'new') {
    return {
      text: t('statisticsPage.surveillanceBuildAlertNew'),
      tone: buildSurveillanceAlertTone(trigger),
    }
  }

  const metric = trigger.metric ? t(METRIC_LABEL_KEYS[trigger.metric]) : ''

  if (trigger.kind === 'min') {
    return {
      text: t('statisticsPage.surveillanceBuildAlertMin', {
        metric,
        current: formatPct(trigger.current),
        threshold: formatPct(trigger.threshold),
      }),
      tone: buildSurveillanceAlertTone(trigger),
    }
  }
  if (trigger.kind === 'max') {
    return {
      text: t('statisticsPage.surveillanceBuildAlertMax', {
        metric,
        current: formatPct(trigger.current),
        threshold: formatPct(trigger.threshold),
      }),
      tone: buildSurveillanceAlertTone(trigger),
    }
  }

  const delta = trigger.delta ?? 0
  const signed = delta >= 0 ? `+${formatPct(delta)}` : formatPct(delta)
  return {
    text: t('statisticsPage.surveillanceBuildAlertDelta', {
      metric,
      current: formatPct(trigger.current),
      reference: formatPct(trigger.reference ?? 0),
      delta: signed,
      threshold: formatPct(trigger.threshold),
    }),
    tone: buildSurveillanceAlertTone(trigger),
  }
}

export function formatBuildSurveillanceAlertSummary(
  triggers: BuildSurveillanceTrigger[],
  t: TranslateFn
): Array<{ text: string; tone: 'positive' | 'negative' | 'neutral' }> {
  return triggers.map(trigger => formatBuildSurveillanceTrigger(trigger, t))
}
