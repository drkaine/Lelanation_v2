<template>
  <section class="space-y-3 border-t border-primary/20 pt-4">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p class="text-sm text-text/70">
        {{ t('statisticsPage.settingsBuildAlertsDescription') }}
      </p>
      <button
        type="button"
        class="ui-build-card-button px-2.5 py-1 text-xs text-text/80"
        @click="resetThresholds"
      >
        {{ t('statisticsPage.settingsAlertsResetShort') }}
      </button>
    </div>

    <div class="ui-build-card-surface overflow-x-auto rounded-xl">
      <table class="w-full min-w-[28rem] text-left text-xs">
        <thead>
          <tr class="border-b border-primary/20 text-text/60">
            <th class="px-3 py-2 font-medium">
              {{ t('statisticsPage.settingsAlertsMetric') }}
            </th>
            <th class="px-3 py-2 font-medium">{{ t('statisticsPage.settingsAlertsMin') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('statisticsPage.settingsAlertsMax') }}</th>
            <th class="px-3 py-2 font-medium">{{ t('statisticsPage.settingsAlertsDelta') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.metric"
            class="border-b border-primary/10 last:border-b-0"
          >
            <th class="px-3 py-2 font-medium text-text/85">{{ row.label }}</th>
            <td class="px-3 py-2">
              <input
                :value="displayValue(row.minKey)"
                type="number"
                min="0"
                :max="isIntegerThreshold(row.minKey) ? undefined : 100"
                :step="isIntegerThreshold(row.minKey) ? 1 : 0.1"
                class="w-full max-w-[5.5rem] rounded border border-primary/35 bg-background px-2 py-1 text-text"
                :placeholder="t('statisticsPage.settingsAlertsPlaceholder')"
                @input="onInput(row.minKey, ($event.target as HTMLInputElement).value)"
              />
            </td>
            <td class="px-3 py-2">
              <input
                v-if="row.maxKey"
                :value="displayValue(row.maxKey)"
                type="number"
                min="0"
                max="100"
                step="0.1"
                class="w-full max-w-[5.5rem] rounded border border-primary/35 bg-background px-2 py-1 text-text"
                :placeholder="t('statisticsPage.settingsAlertsPlaceholder')"
                @input="onInput(row.maxKey, ($event.target as HTMLInputElement).value)"
              />
              <span v-else class="text-text/35">—</span>
            </td>
            <td class="px-3 py-2">
              <div v-if="row.deltaKey" class="flex items-center gap-1.5">
                <input
                  :value="displayValue(row.deltaKey)"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  class="w-full max-w-[4.5rem] rounded border border-primary/35 bg-background px-2 py-1 text-text"
                  :placeholder="t('statisticsPage.settingsAlertsPlaceholder')"
                  @input="onInput(row.deltaKey, ($event.target as HTMLInputElement).value)"
                />
                <SurveillanceDeltaDirectionButtons
                  :model-value="deltaDirectionValue(row.deltaDirectionKey)"
                  @update:model-value="onDeltaDirectionChange(row.deltaDirectionKey, $event)"
                />
              </div>
              <span v-else class="text-text/35">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-text/55">
      {{
        t('statisticsPage.settingsBuildAlertsHint', {
          count: effectiveMaxBuilds(buildStore.thresholds),
          minItems: BUILD_SURVEILLANCE_MIN_ITEMS,
        })
      }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStatisticsBuildSurveillanceStore } from '~/stores/StatisticsBuildSurveillanceStore'
import SurveillanceDeltaDirectionButtons from '~/components/statistics/SurveillanceDeltaDirectionButtons.vue'
import {
  BUILD_SURVEILLANCE_MIN_ITEMS,
  effectiveMaxBuilds,
  type BuildSurveillanceThresholds,
} from '~/utils/buildSurveillance'
import type { DeltaDirectionFlags } from '~/utils/surveillanceDeltaDirection'
import { defaultDeltaDirectionFlags } from '~/utils/surveillanceDeltaDirection'

const emit = defineEmits<{
  feedback: [message: string, ok?: boolean]
}>()

const { t } = useI18n()
const buildStore = useStatisticsBuildSurveillanceStore()

if (import.meta.client) {
  buildStore.init()
}

type ThresholdKey = Exclude<
  keyof BuildSurveillanceThresholds,
  'winrateDeltaDirection' | 'pickrateDeltaDirection'
>
type DeltaDirectionKey = 'winrateDeltaDirection' | 'pickrateDeltaDirection'
type IntegerThresholdKey = 'minGames' | 'maxBuilds'

const INTEGER_THRESHOLD_KEYS = new Set<ThresholdKey>(['minGames', 'maxBuilds'])

const rows = computed(() => [
  {
    metric: 'winrate',
    label: t('statisticsPage.winrate'),
    minKey: 'winrateMin' as const,
    maxKey: 'winrateMax' as const,
    deltaKey: 'winrateDeltaPct' as const,
    deltaDirectionKey: 'winrateDeltaDirection' as const,
  },
  {
    metric: 'pickrate',
    label: t('statisticsPage.pickrate'),
    minKey: 'pickrateMin' as const,
    maxKey: 'pickrateMax' as const,
    deltaKey: 'pickrateDeltaPct' as const,
    deltaDirectionKey: 'pickrateDeltaDirection' as const,
  },
  {
    metric: 'minGames',
    label: t('statisticsPage.settingsBuildAlertsMinGames'),
    minKey: 'minGames' as const,
    maxKey: null,
    deltaKey: null,
    deltaDirectionKey: null,
  },
  {
    metric: 'maxBuilds',
    label: t('statisticsPage.settingsBuildAlertsMaxBuilds'),
    minKey: 'maxBuilds' as const,
    maxKey: null,
    deltaKey: null,
    deltaDirectionKey: null,
  },
])

function displayValue(key: ThresholdKey): string {
  const value = buildStore.thresholds[key]
  if (value === null || value === undefined) return ''
  if (isIntegerThreshold(key)) return String(Math.floor(value))
  return String(value)
}

function isIntegerThreshold(key: ThresholdKey): key is IntegerThresholdKey {
  return INTEGER_THRESHOLD_KEYS.has(key)
}

function parseInput(raw: string, integer = false): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n)) return null
  return integer ? Math.max(0, Math.floor(n)) : n
}

function onInput(key: ThresholdKey, raw: string): void {
  buildStore.setThresholds({ [key]: parseInput(raw, isIntegerThreshold(key)) })
}

function deltaDirectionValue(key: DeltaDirectionKey): DeltaDirectionFlags {
  return buildStore.thresholds[key] ?? defaultDeltaDirectionFlags()
}

function onDeltaDirectionChange(key: DeltaDirectionKey, flags: DeltaDirectionFlags): void {
  buildStore.setThresholds({ [key]: flags })
}

function resetThresholds(): void {
  buildStore.resetThresholds()
  emit('feedback', t('statisticsPage.settingsBuildAlertsResetDone'))
}
</script>
