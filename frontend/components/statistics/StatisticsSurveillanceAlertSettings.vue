<template>
  <section class="space-y-3 border-t border-primary/20 pt-6">
    <header class="space-y-1">
      <h2 class="text-base font-semibold text-text-accent">
        {{ t('statisticsPage.settingsAlertsTitle') }}
      </h2>
      <p class="text-sm text-text/70">
        {{ t('statisticsPage.settingsAlertsDescription') }}
      </p>
      <p class="pt-1 text-xs text-text/55">
        {{ t('statisticsPage.settingsAlertsHint') }}
      </p>
    </header>

    <nav
      class="flex flex-wrap gap-1 border-b border-primary/20 pb-0.5"
      role="tablist"
      :aria-label="t('statisticsPage.settingsAlertsTabsAria')"
    >
      <button
        v-for="tab in settingsTabs"
        :key="tab.id"
        type="button"
        role="tab"
        class="rounded-t border px-3 py-2 text-xs font-medium transition"
        :class="
          activeSettingsTab === tab.id
            ? 'border-primary/40 border-b-transparent bg-surface/40 text-text'
            : 'border-transparent text-text/60 hover:bg-surface/20 hover:text-text'
        "
        :aria-selected="activeSettingsTab === tab.id"
        @click="activeSettingsTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <p v-if="feedback" class="text-xs" :class="feedbackOk ? 'text-emerald-300' : 'text-amber-200'">
      {{ feedback }}
    </p>

    <div v-show="activeSettingsTab === 'cohorts'" class="space-y-3" role="tabpanel">
      <div class="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10"
          @click="resetCurrentCohort"
        >
          {{ t('statisticsPage.settingsAlertsResetCohort') }}
        </button>
        <button
          type="button"
          class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10"
          @click="resetAllThresholds"
        >
          {{ t('statisticsPage.settingsAlertsReset') }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <button
          v-for="profile in alertStore.thresholdProfiles"
          :key="profile.cohortKey"
          type="button"
          class="rounded-full border px-3 py-1 text-xs transition"
          :class="
            selectedCohortKey === profile.cohortKey
              ? 'border-primary/60 bg-primary/15 text-text'
              : 'border-primary/25 bg-surface/40 text-text/70 hover:bg-primary/10'
          "
          @click="selectedCohortKey = profile.cohortKey"
        >
          {{ cohortLabel(profile.cohortKey) }}
        </button>
        <button
          type="button"
          class="rounded-full border border-dashed border-primary/35 px-2.5 py-1 text-xs text-text/70 hover:bg-primary/10"
          :title="t('statisticsPage.settingsAlertsAddCohort')"
          @click="showAddCohort = !showAddCohort"
        >
          +
        </button>
        <button
          v-if="canRemoveSelectedCohort"
          type="button"
          class="rounded border border-error/35 px-2.5 py-1 text-xs text-error hover:bg-error/10"
          @click="removeSelectedCohort"
        >
          {{ t('statisticsPage.settingsAlertsRemoveCohort') }}
        </button>
      </div>

      <div
        v-if="showAddCohort"
        class="space-y-2 rounded-lg border border-dashed border-primary/30 bg-surface/20 p-3"
      >
        <p class="text-xs text-text/65">{{ t('statisticsPage.settingsAlertsAddCohortHint') }}</p>
        <div class="flex flex-wrap gap-1">
          <button
            v-for="tier in RANK_TIERS"
            :key="'new-' + tier"
            type="button"
            class="stats-division-btn rounded p-0.5 transition-colors"
            :class="
              pendingRankTiers.includes(tier)
                ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                : 'bg-black/20 hover:bg-white/10'
            "
            :title="formatDivisionLabel(tier)"
            @click="togglePendingTier(tier)"
          >
            <img
              v-if="getRankedEmblemUrl(tier)"
              :src="getRankedEmblemUrl(tier)!"
              :alt="tier"
              class="h-3 w-3 object-contain"
              width="12"
              height="12"
            />
          </button>
        </div>
        <button
          type="button"
          class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10 disabled:opacity-50"
          :disabled="pendingRankTiers.length === 0"
          @click="confirmAddCohort"
        >
          {{ t('statisticsPage.settingsAlertsAddCohort') }}
        </button>
      </div>

      <div v-if="selectedProfile" class="space-y-2">
        <div>
          <div class="mb-1 text-xs font-medium text-text/70">
            {{ t('statisticsPage.settingsAlertsCohortDivisions') }}
          </div>
          <p v-if="isGlobalCohort" class="text-xs text-text/55">
            {{ t('statisticsPage.settingsAlertsGlobalCohortHint') }}
          </p>
          <div v-else class="flex flex-wrap gap-1">
            <button
              v-for="tier in RANK_TIERS"
              :key="'edit-' + tier"
              type="button"
              class="stats-division-btn rounded p-0.5 transition-colors"
              :class="
                selectedProfile.rankTiers.includes(tier)
                  ? 'bg-blue-500/20 ring-1 ring-blue-400/60'
                  : 'bg-black/20 hover:bg-white/10'
              "
              :title="formatDivisionLabel(tier)"
              @click="toggleSelectedCohortTier(tier)"
            >
              <img
                v-if="getRankedEmblemUrl(tier)"
                :src="getRankedEmblemUrl(tier)!"
                :alt="tier"
                class="h-3 w-3 object-contain"
                width="12"
                height="12"
              />
            </button>
          </div>
        </div>

        <div class="overflow-x-auto rounded-lg border border-primary/25 bg-surface/30">
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
                    max="100"
                    step="0.1"
                    class="w-full max-w-[5.5rem] rounded border border-primary/35 bg-background px-2 py-1 text-text"
                    :placeholder="t('statisticsPage.settingsAlertsPlaceholder')"
                    @input="onInput(row.minKey, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    :value="displayValue(row.maxKey)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    class="w-full max-w-[5.5rem] rounded border border-primary/35 bg-background px-2 py-1 text-text"
                    :placeholder="t('statisticsPage.settingsAlertsPlaceholder')"
                    @input="onInput(row.maxKey, ($event.target as HTMLInputElement).value)"
                  />
                </td>
                <td class="px-3 py-2">
                  <input
                    :value="displayValue(row.deltaKey)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    class="w-full max-w-[5.5rem] rounded border border-primary/35 bg-background px-2 py-1 text-text"
                    :placeholder="t('statisticsPage.settingsAlertsPlaceholder')"
                    @input="onInput(row.deltaKey, ($event.target as HTMLInputElement).value)"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div v-show="activeSettingsTab === 'reference'" class="space-y-3" role="tabpanel">
      <div class="space-y-2 rounded-lg border border-primary/20 bg-surface/20 p-3">
        <div class="text-xs font-medium text-text/80">
          {{ t('statisticsPage.settingsAlertsReferenceTitle') }}
        </div>
        <p class="text-xs text-text/55">
          {{ t('statisticsPage.settingsAlertsReferenceHint') }}
        </p>
        <div class="flex flex-wrap gap-3 text-xs">
          <label class="inline-flex items-center gap-1.5">
            <input
              v-model="referenceMode"
              type="radio"
              class="accent-primary"
              value="current_patch"
            />
            {{ t('statisticsPage.settingsAlertsReferenceCurrentPatch') }}
          </label>
          <label class="inline-flex items-center gap-1.5">
            <input v-model="referenceMode" type="radio" class="accent-primary" value="date" />
            {{ t('statisticsPage.settingsAlertsReferenceDate') }}
          </label>
          <label class="inline-flex items-center gap-1.5">
            <input v-model="referenceMode" type="radio" class="accent-primary" value="patch" />
            {{ t('statisticsPage.settingsAlertsReferencePatch') }}
          </label>
        </div>
        <div v-if="referenceMode === 'date'" class="flex flex-wrap items-center gap-2">
          <label class="text-xs text-text/70" for="surveillance-ref-date">
            {{ t('statisticsPage.settingsAlertsReferenceDateLabel') }}
          </label>
          <input
            id="surveillance-ref-date"
            v-model="referenceDateInput"
            type="date"
            class="rounded border border-primary/35 bg-background px-2 py-1 text-xs text-text"
          />
        </div>
        <div v-else-if="referenceMode === 'patch'" class="flex flex-wrap items-center gap-2">
          <label class="text-xs text-text/70" for="surveillance-ref-patch">
            {{ t('statisticsPage.settingsAlertsReferencePatchLabel') }}
          </label>
          <select
            id="surveillance-ref-patch"
            v-model="referencePatchInput"
            class="rounded border border-primary/35 bg-background px-2 py-1 text-xs text-text"
          >
            <option value="">
              {{ t('statisticsPage.settingsAlertsReferencePatchPlaceholder') }}
            </option>
            <option
              v-for="patch in versionsCatalog"
              :key="patch.patchLabel"
              :value="patch.patchLabel"
            >
              {{ patch.patchLabel }}
            </option>
          </select>
        </div>
        <p v-else class="text-xs text-text/55">
          {{
            t('statisticsPage.settingsAlertsReferenceCurrentPatchHint', {
              patch: currentPatchLabel || '—',
            })
          }}
        </p>
        <p v-if="resolvedReferenceLabel" class="text-xs text-text/55">
          {{
            t('statisticsPage.settingsAlertsReferenceActive', { reference: resolvedReferenceLabel })
          }}
        </p>
      </div>
    </div>

    <div v-show="activeSettingsTab === 'verify'" class="space-y-3" role="tabpanel">
      <p class="text-xs text-text/65">
        {{ t('statisticsPage.settingsAlertsVerifyHint') }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="rounded border border-primary bg-primary/20 px-4 py-2 text-sm font-medium text-text hover:bg-primary/30 disabled:opacity-50"
          :disabled="busy || watchedCount === 0 || !canRunCheck"
          @click="saveAndRunCheck"
        >
          {{ t('statisticsPage.settingsAlertsSaveAndCheck') }}
        </button>
        <span v-if="resolvedReferenceLabel" class="text-xs text-text/55">
          {{
            t('statisticsPage.settingsAlertsReferenceActive', { reference: resolvedReferenceLabel })
          }}
        </span>
      </div>
      <p v-if="watchedCount === 0" class="text-xs text-amber-200/90">
        {{ t('statisticsPage.settingsAlertsTestNoWatchlist') }}
      </p>
    </div>

    <div
      v-show="activeSettingsTab === 'test'"
      class="space-y-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3"
      role="tabpanel"
    >
      <header class="space-y-1">
        <h3 class="text-sm font-semibold text-amber-200/90">
          {{ t('statisticsPage.settingsAlertsTestTitle') }}
        </h3>
        <p class="text-xs text-text/65">
          {{ t('statisticsPage.settingsAlertsTestDescription') }}
        </p>
        <p class="text-xs text-text/55">
          {{
            t('statisticsPage.settingsAlertsTestCohortScope', {
              cohort: cohortLabel(selectedCohortKey),
            })
          }}
        </p>
        <p v-if="testBaselineCount > 0" class="text-xs text-text/55">
          {{
            t('statisticsPage.settingsAlertsTestBaselineCount', {
              count: testBaselineCount,
              watched: watchedCount,
            })
          }}
        </p>
      </header>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded border border-amber-500/40 bg-surface/50 px-3 py-1.5 text-xs hover:bg-amber-500/10 disabled:opacity-50"
          :disabled="busy || watchedCount === 0"
          @click="captureYesterday"
        >
          {{ t('statisticsPage.settingsAlertsTestCaptureYesterday') }}
        </button>
        <button
          type="button"
          class="rounded border border-amber-500/40 bg-surface/50 px-3 py-1.5 text-xs hover:bg-amber-500/10 disabled:opacity-50"
          :disabled="busy || watchedCount === 0"
          @click="captureWeekAgo"
        >
          {{ t('statisticsPage.settingsAlertsTestCaptureWeek') }}
        </button>
        <button
          type="button"
          class="rounded border border-amber-500/40 bg-surface/50 px-3 py-1.5 text-xs hover:bg-amber-500/10 disabled:opacity-50"
          :disabled="busy || testBaselineCount === 0"
          @click="simulateLoginCheck"
        >
          {{ t('statisticsPage.settingsAlertsTestSimulateLogin') }}
        </button>
        <button
          type="button"
          class="rounded border border-error/40 bg-error/10 px-3 py-1.5 text-xs text-error hover:bg-error/20 disabled:opacity-50"
          :disabled="busy || watchedCount === 0"
          @click="forceDemoAlerts"
        >
          {{ t('statisticsPage.settingsAlertsTestForceDemo') }}
        </button>
        <button
          v-if="testBaselineCount > 0"
          type="button"
          class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10 disabled:opacity-50"
          :disabled="busy"
          @click="clearTestBaselines"
        >
          {{ t('statisticsPage.settingsAlertsTestClear') }}
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSurveillanceAlertEvaluation } from '~/composables/useSurveillanceAlertEvaluation'
import { useStatisticsSurveillanceAlertStore } from '~/stores/StatisticsSurveillanceAlertStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { getRankedEmblemUrl } from '~/utils/rankedEmblem'
import { RANK_TIERS } from '~/utils/rankTiers'
import type {
  SurveillanceAlertThresholds,
  SurveillanceReferenceMode,
  SurveillanceVersionsCatalogEntry,
} from '~/utils/statisticsSurveillanceAlerts'
import {
  SURVEILLANCE_GLOBAL_COHORT_KEY,
  configuredSurveillanceCohortProfiles,
  formatSurveillanceCohortLabel,
  hasConfiguredSurveillanceThresholds,
  parseSurveillanceBaselineKey,
  resolveSurveillanceReference,
} from '~/utils/statisticsSurveillanceAlerts'

const { t } = useI18n()
const localePath = useLocalePath()
const alertStore = useStatisticsSurveillanceAlertStore()
const statisticsUiStore = useStatisticsUiStore()
const { captureTestReference, runSurveillanceAlertCheck } = useSurveillanceAlertEvaluation()

if (import.meta.client) {
  alertStore.init()
  statisticsUiStore.init()
}

const busy = ref(false)
const feedback = ref('')
const feedbackOk = ref(true)
const activeSettingsTab = ref<'cohorts' | 'reference' | 'verify' | 'test'>('cohorts')
const selectedCohortKey = ref(SURVEILLANCE_GLOBAL_COHORT_KEY)
const showAddCohort = ref(false)
const pendingRankTiers = ref<string[]>([])
const versionsCatalog = ref<SurveillanceVersionsCatalogEntry[]>([])

type ThresholdKey = keyof SurveillanceAlertThresholds

const watchedCount = computed(() => statisticsUiStore.watchedChampionIds.length)

const settingsTabs = computed(() => [
  { id: 'cohorts' as const, label: t('statisticsPage.settingsAlertsTabCohorts') },
  { id: 'reference' as const, label: t('statisticsPage.settingsAlertsTabReference') },
  { id: 'verify' as const, label: t('statisticsPage.settingsAlertsTabVerify') },
  { id: 'test' as const, label: t('statisticsPage.settingsAlertsTabTest') },
])

const referenceMode = computed({
  get: () => alertStore.referenceSettings.mode,
  set: (mode: SurveillanceReferenceMode) => alertStore.setReferenceSettings({ mode }),
})

const referenceDateInput = computed({
  get: () => alertStore.referenceSettings.referenceDate ?? '',
  set: (value: string) => alertStore.setReferenceSettings({ referenceDate: value.trim() || null }),
})

const referencePatchInput = computed({
  get: () => alertStore.referenceSettings.referencePatchLabel ?? '',
  set: (value: string) =>
    alertStore.setReferenceSettings({ referencePatchLabel: value.trim() || null }),
})

const currentPatchLabel = computed(() => {
  if (versionsCatalog.value.length === 0) return ''
  return versionsCatalog.value[versionsCatalog.value.length - 1]?.patchLabel ?? ''
})

const resolvedReferenceLabel = computed(() => {
  const ref = resolveSurveillanceReference(alertStore.referenceSettings, versionsCatalog.value)
  return ref?.label ?? ''
})

const canRunCheck = computed(() => {
  const hasThresholds = configuredSurveillanceCohortProfiles(alertStore.thresholdProfiles).some(p =>
    hasConfiguredSurveillanceThresholds(p.thresholds)
  )
  if (!hasThresholds) return false
  if (alertStore.referenceSettings.mode === 'date') {
    return Boolean(alertStore.referenceSettings.referenceDate)
  }
  if (alertStore.referenceSettings.mode === 'patch') {
    return Boolean(alertStore.referenceSettings.referencePatchLabel)
  }
  return versionsCatalog.value.length > 0
})

onMounted(async () => {
  try {
    const versionsData = await $fetch<{
      versions?: Array<{ version?: string; patchLabel?: string; releaseDate?: string }>
    }>('/data/game/versions.json')
    const rows =
      versionsData?.versions
        ?.map(entry => ({
          patchLabel: String(entry.patchLabel ?? entry.version ?? '').trim(),
          releaseDate: String(entry.releaseDate ?? '').trim(),
        }))
        .filter(entry => entry.patchLabel && /^\d{4}-\d{2}-\d{2}$/.test(entry.releaseDate)) ?? []
    versionsCatalog.value = rows.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate))
  } catch {
    versionsCatalog.value = []
  }
})

const selectedProfile = computed(() =>
  alertStore.thresholdProfiles.find(p => p.cohortKey === selectedCohortKey.value)
)

const isGlobalCohort = computed(() => selectedCohortKey.value === SURVEILLANCE_GLOBAL_COHORT_KEY)

const canRemoveSelectedCohort = computed(() => !isGlobalCohort.value)

const testBaselineCount = computed(() => {
  const cohortKey = selectedCohortKey.value
  return Object.keys(alertStore.testBaselines).filter(key => {
    const parsed = parseSurveillanceBaselineKey(key)
    return parsed.cohortKey === cohortKey
  }).length
})

watch(
  () => alertStore.thresholdProfiles.map(p => p.cohortKey),
  keys => {
    if (!keys.includes(selectedCohortKey.value)) {
      selectedCohortKey.value = keys[0] ?? SURVEILLANCE_GLOBAL_COHORT_KEY
    }
  },
  { immediate: true }
)

const rows = computed(() => [
  {
    metric: 'winrate',
    label: t('statisticsPage.winrate'),
    minKey: 'winrateMin' as const,
    maxKey: 'winrateMax' as const,
    deltaKey: 'winrateDeltaPct' as const,
  },
  {
    metric: 'pickrate',
    label: t('statisticsPage.pickrate'),
    minKey: 'pickrateMin' as const,
    maxKey: 'pickrateMax' as const,
    deltaKey: 'pickrateDeltaPct' as const,
  },
  {
    metric: 'banrate',
    label: t('statisticsPage.championStatsBanrateTitle'),
    minKey: 'banrateMin' as const,
    maxKey: 'banrateMax' as const,
    deltaKey: 'banrateDeltaPct' as const,
  },
])

function cohortLabel(cohortKey: string): string {
  return formatSurveillanceCohortLabel(cohortKey, key => t(key))
}

function formatDivisionLabel(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase()
}

function showFeedback(message: string, ok = true): void {
  feedback.value = message
  feedbackOk.value = ok
}

function displayValue(key: ThresholdKey): string {
  const value = selectedProfile.value?.thresholds[key]
  return value === null || value === undefined ? '' : String(value)
}

function parseInput(raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : null
}

function onInput(key: ThresholdKey, raw: string): void {
  alertStore.setProfileThresholds(selectedCohortKey.value, { [key]: parseInput(raw) })
}

function resetCurrentCohort(): void {
  alertStore.resetProfileThresholds(selectedCohortKey.value)
  showFeedback(t('statisticsPage.settingsAlertsResetCohortDone'))
}

function resetAllThresholds(): void {
  alertStore.resetThresholds()
  selectedCohortKey.value = SURVEILLANCE_GLOBAL_COHORT_KEY
  showFeedback(t('statisticsPage.settingsAlertsResetDone'))
}

function togglePendingTier(tier: string): void {
  const arr = pendingRankTiers.value
  pendingRankTiers.value = arr.includes(tier) ? arr.filter(value => value !== tier) : [...arr, tier]
}

function confirmAddCohort(): void {
  if (pendingRankTiers.value.length === 0) return
  const key = alertStore.addCohortProfile(pendingRankTiers.value)
  selectedCohortKey.value = key
  pendingRankTiers.value = []
  showAddCohort.value = false
}

function toggleSelectedCohortTier(tier: string): void {
  if (isGlobalCohort.value) return
  const current = selectedProfile.value?.rankTiers ?? []
  const next = current.includes(tier) ? current.filter(value => value !== tier) : [...current, tier]
  if (next.length === 0) {
    showFeedback(t('statisticsPage.settingsAlertsCohortNeedsDivision'), false)
    return
  }
  const newKey = alertStore.updateCohortRankTiers(selectedCohortKey.value, next)
  selectedCohortKey.value = newKey
}

function removeSelectedCohort(): void {
  if (isGlobalCohort.value) return
  alertStore.removeCohortProfile(selectedCohortKey.value)
  selectedCohortKey.value = SURVEILLANCE_GLOBAL_COHORT_KEY
}

async function withBusy<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (busy.value) return undefined
  busy.value = true
  try {
    return await fn()
  } finally {
    busy.value = false
  }
}

function formatCaptureFeedback(
  result: {
    captured: number
    watchedCount: number
    unresolvedCount: number
    fetchFailedCount: number
  },
  whenLabel: string
): string {
  if (result.captured === 0) {
    return formatCheckFeedback({
      alertCount: 0,
      unresolvedCount: result.unresolvedCount,
      fetchFailedCount: result.fetchFailedCount,
    })
  }
  if (result.captured < result.watchedCount) {
    const issues: string[] = []
    if (result.fetchFailedCount > 0) {
      issues.push(
        t('statisticsPage.settingsAlertsTestCaptureApiFailed', {
          count: result.fetchFailedCount,
        })
      )
    }
    if (result.unresolvedCount > 0) {
      issues.push(
        t('statisticsPage.settingsAlertsTestCaptureUnresolved', {
          count: result.unresolvedCount,
        })
      )
    }
    return [
      t('statisticsPage.settingsAlertsTestCapturedPartial', {
        captured: result.captured,
        total: result.watchedCount,
        when: whenLabel,
      }),
      ...issues,
    ].join(' ')
  }
  return t('statisticsPage.settingsAlertsTestCaptured', {
    count: result.captured,
    when: whenLabel,
  })
}

async function captureYesterday(): Promise<void> {
  if (watchedCount.value === 0) {
    showFeedback(t('statisticsPage.settingsAlertsTestNoWatchlist'), false)
    return
  }
  const result = await withBusy(() => captureTestReference(1, selectedCohortKey.value))
  if (result === undefined) return
  const whenLabel = t('statisticsPage.settingsAlertsTestWhenYesterday')
  showFeedback(formatCaptureFeedback(result, whenLabel), result.captured > 0)
}

async function captureWeekAgo(): Promise<void> {
  if (watchedCount.value === 0) {
    showFeedback(t('statisticsPage.settingsAlertsTestNoWatchlist'), false)
    return
  }
  const result = await withBusy(() => captureTestReference(7, selectedCohortKey.value))
  if (result === undefined) return
  const whenLabel = t('statisticsPage.settingsAlertsTestWhenWeek')
  showFeedback(formatCaptureFeedback(result, whenLabel), result.captured > 0)
}

async function simulateLoginCheck(): Promise<void> {
  if (testBaselineCount.value === 0) {
    showFeedback(t('statisticsPage.settingsAlertsTestNeedBaseline'), false)
    return
  }
  await withBusy(async () => {
    const result = await runSurveillanceAlertCheck({
      useTestBaselines: true,
      cohortKey: selectedCohortKey.value,
    })
    showFeedback(formatCheckFeedback(result), result.alertCount > 0)
  })
}

function formatCheckFeedback(result: {
  alertCount: number
  unresolvedCount: number
  fetchFailedCount: number
}): string {
  if (result.alertCount > 0) {
    return t('statisticsPage.settingsAlertsTestChecked', { count: result.alertCount })
  }
  if (result.unresolvedCount > 0) {
    return t('statisticsPage.settingsAlertsTestUnresolved', {
      count: result.unresolvedCount,
    })
  }
  if (result.fetchFailedCount > 0) {
    return t('statisticsPage.settingsAlertsTestApiFailed', {
      count: result.fetchFailedCount,
    })
  }
  return t('statisticsPage.settingsAlertsTestNoTrigger')
}

async function forceDemoAlerts(): Promise<void> {
  if (watchedCount.value === 0) {
    showFeedback(t('statisticsPage.settingsAlertsTestNoWatchlist'), false)
    return
  }
  await withBusy(async () => {
    const result = await runSurveillanceAlertCheck({
      demoMode: true,
      cohortKey: selectedCohortKey.value,
    })
    if (result.alertCount > 0) {
      showFeedback(
        t('statisticsPage.settingsAlertsTestDemoDone', { count: result.alertCount }),
        true
      )
      await navigateTo(localePath('/statistics/surveillance'))
      return
    }
    showFeedback(formatCheckFeedback(result), false)
  })
}

function clearTestBaselines(): void {
  const cohortKey = selectedCohortKey.value
  const next = { ...alertStore.testBaselines }
  for (const key of Object.keys(next)) {
    if (parseSurveillanceBaselineKey(key).cohortKey === cohortKey) {
      delete next[key]
    }
  }
  alertStore.setTestBaselines(next)
  showFeedback(t('statisticsPage.settingsAlertsTestCleared'))
}

async function saveAndRunCheck(): Promise<void> {
  if (watchedCount.value === 0) {
    showFeedback(t('statisticsPage.settingsAlertsTestNoWatchlist'), false)
    return
  }
  if (!canRunCheck.value) {
    showFeedback(t('statisticsPage.settingsAlertsSaveInvalidReference'), false)
    return
  }
  await withBusy(async () => {
    const result = await runSurveillanceAlertCheck()
    if (result.alertCount > 0) {
      showFeedback(
        t('statisticsPage.settingsAlertsSaveDoneWithAlerts', { count: result.alertCount }),
        true
      )
      await navigateTo(localePath('/statistics/surveillance'))
      return
    }
    showFeedback(formatCheckFeedback(result), result.fetchFailedCount === 0)
  })
}
</script>
