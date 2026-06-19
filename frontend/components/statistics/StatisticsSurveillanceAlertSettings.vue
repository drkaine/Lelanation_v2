<template>
  <section class="space-y-3">
    <header class="space-y-1">
      <p class="text-sm text-text/70">
        {{ t('statisticsPage.settingsAlertsDescription') }}
      </p>
      <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
        <p class="text-xs text-text/55">
          {{ t('statisticsPage.settingsAlertsHint') }}
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-if="!alertStore.sharedThresholds"
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
      </div>
    </header>

    <p v-if="feedback" class="text-xs" :class="feedbackOk ? 'text-emerald-300' : 'text-amber-200'">
      {{ feedback }}
    </p>

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
        @click="selectCohort(profile.cohortKey)"
      >
        {{ cohortLabel(profile.cohortKey) }}
      </button>
      <button
        type="button"
        class="rounded-full border border-dashed border-primary/35 px-2.5 py-1 text-xs text-text/70 hover:bg-primary/10"
        :title="t('statisticsPage.settingsAlertsAddCohort')"
        @click="toggleAddCohort"
      >
        +
      </button>
      <button
        v-if="canEditSelectedCohort"
        type="button"
        class="rounded border border-primary/35 px-2.5 py-1 text-xs text-text/80 hover:bg-primary/10"
        :class="showEditCohort ? 'bg-primary/15' : 'bg-surface/40'"
        @click="toggleEditCohort"
      >
        {{
          showEditCohort
            ? t('statisticsPage.settingsAlertsEditCohortDone')
            : t('statisticsPage.settingsAlertsEditCohort')
        }}
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
      <div class="flex flex-wrap items-center gap-2">
        <input
          id="surveillance-new-cohort-name"
          :value="pendingCohortName"
          type="text"
          maxlength="64"
          class="min-w-[10rem] max-w-xs rounded border border-primary/35 bg-background px-2 py-1.5 text-xs text-text placeholder:text-text/45"
          :placeholder="pendingCohortDefaultLabel || t('statisticsPage.settingsAlertsCohortName')"
          @input="onPendingCohortNameInput(($event.target as HTMLInputElement).value)"
        />
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
      </div>
      <p class="text-xs text-text/55">
        {{ t('statisticsPage.settingsAlertsCohortNameHint') }}
      </p>
      <button
        type="button"
        class="rounded border border-primary/35 bg-surface/50 px-3 py-1.5 text-xs hover:bg-primary/10 disabled:opacity-50"
        :disabled="pendingRankTiers.length === 0"
        @click="confirmAddCohort"
      >
        {{ t('statisticsPage.settingsAlertsAddCohort') }}
      </button>
    </div>

    <div
      v-if="showEditCohort && selectedProfile"
      class="space-y-2 rounded-lg border border-dashed border-primary/30 bg-surface/20 p-3"
    >
      <p class="text-xs text-text/65">{{ t('statisticsPage.settingsAlertsEditCohortHint') }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <input
          id="surveillance-cohort-name"
          :value="cohortNameInput"
          type="text"
          maxlength="64"
          class="min-w-[10rem] max-w-xs rounded border border-primary/35 bg-background px-2 py-1.5 text-xs text-text placeholder:text-text/45"
          :placeholder="cohortDefaultLabel(selectedCohortKey)"
          @input="onCohortNameInput(($event.target as HTMLInputElement).value)"
        />
        <div class="flex flex-wrap gap-1">
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
      <p class="text-xs text-text/55">
        {{ t('statisticsPage.settingsAlertsCohortNameHint') }}
      </p>
    </div>

    <div v-if="selectedProfile" class="space-y-2">
      <p
        v-if="!showEditCohort && canEditSelectedCohort"
        class="flex flex-wrap items-center gap-2 text-xs text-text/60"
      >
        <span>{{ cohortLabel(selectedCohortKey) }}</span>
        <span class="flex gap-0.5" aria-hidden="true">
          <img
            v-for="tier in selectedProfile.rankTiers"
            v-show="getRankedEmblemUrl(tier)"
            :key="'view-' + tier"
            :src="getRankedEmblemUrl(tier)!"
            :alt="formatDivisionLabel(tier)"
            class="h-3 w-3 object-contain opacity-80"
            width="12"
            height="12"
          />
        </span>
      </p>
      <p v-else-if="isGlobalCohort" class="text-xs text-text/55">
        {{ t('statisticsPage.settingsAlertsGlobalCohortHint') }}
      </p>

      <div
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-surface/20 px-3 py-2"
      >
        <div class="space-y-0.5">
          <div class="text-xs font-medium text-text/80">
            {{ t('statisticsPage.settingsAlertsThresholdModeTitle') }}
          </div>
          <p class="text-xs text-text/55">
            {{
              alertStore.sharedThresholds
                ? t('statisticsPage.settingsAlertsThresholdModeSharedHint')
                : t('statisticsPage.settingsAlertsThresholdModeSeparateHint')
            }}
          </p>
        </div>
        <button
          type="button"
          class="command-toggle command-toggle-button shrink-0 scale-90"
          :aria-pressed="alertStore.sharedThresholds"
          :aria-label="t('statisticsPage.settingsAlertsThresholdModeTitle')"
          @click="toggleSharedThresholds"
        >
          <span class="command-toggle-track" :class="{ active: alertStore.sharedThresholds }">
            <span class="command-toggle-thumb" />
          </span>
        </button>
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
      <div v-if="referenceMode === 'date'" class="space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <label class="text-xs text-text/70" for="surveillance-ref-date-text">
            {{ t('statisticsPage.settingsAlertsReferenceDateLabel') }}
          </label>
          <input
            id="surveillance-ref-date-text"
            :value="referenceDateText"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="YYYY-MM-DD"
            maxlength="10"
            class="min-w-[8.5rem] rounded border border-primary/35 bg-background px-2 py-1 text-xs text-text placeholder:text-text/45"
            :class="referenceDateInvalid ? 'border-amber-500/60' : ''"
            @input="onReferenceDateTextInput(($event.target as HTMLInputElement).value)"
            @blur="commitReferenceDateText"
          />
          <input
            id="surveillance-ref-date"
            :value="referenceDatePickerValue"
            type="date"
            class="rounded border border-primary/35 bg-background px-2 py-1 text-xs text-text"
            :min="dailySnapshotMinDate ?? undefined"
            :max="dailySnapshotMaxDate ?? undefined"
            @input="onReferenceDatePickerInput(($event.target as HTMLInputElement).value)"
          />
        </div>
        <p v-if="dailySnapshotBoundsReady" class="text-xs text-text/55">
          {{
            t('statisticsPage.settingsAlertsReferenceDateRangeHint', {
              min: dailySnapshotMinDate,
              max: dailySnapshotMaxDate,
            })
          }}
        </p>
        <p v-else class="text-xs text-text/55">
          {{ t('statisticsPage.settingsAlertsReferenceDateRangeLoading') }}
        </p>
        <p v-if="referenceDateInvalid" class="text-xs text-amber-200/90">
          {{ t('statisticsPage.settingsAlertsReferenceDateInvalid') }}
        </p>
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

    <div class="flex flex-wrap items-center gap-3 pt-1">
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

    <section
      class="space-y-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3"
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
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useSurveillanceAlertEvaluation } from '~/composables/useSurveillanceAlertEvaluation'
import { useStatisticsSurveillanceAlertStore } from '~/stores/StatisticsSurveillanceAlertStore'
import { useStatisticsUiStore } from '~/stores/StatisticsUiStore'
import { apiUrl } from '~/utils/apiUrl'
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
  clampIsoDate,
  formatSurveillanceCohortLabel,
  hasConfiguredSurveillanceThresholds,
  parseTypedIsoDate,
  parseSurveillanceBaselineKey,
  resolveSurveillanceCohortLabel,
  resolveSurveillanceReference,
  surveillanceCohortKey,
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
const selectedCohortKey = ref(SURVEILLANCE_GLOBAL_COHORT_KEY)
const showAddCohort = ref(false)
const showEditCohort = ref(false)
const pendingRankTiers = ref<string[]>([])
const pendingCohortName = ref('')
const versionsCatalog = ref<SurveillanceVersionsCatalogEntry[]>([])
const dailySnapshotMinDate = ref<string | null>(null)
const dailySnapshotMaxDate = ref<string | null>(null)
const dailySnapshotBoundsLoaded = ref(false)
const referenceDateText = ref('')
const referenceDateInvalid = ref(false)

type ThresholdKey = keyof SurveillanceAlertThresholds

const dailySnapshotBoundsReady = computed(
  () =>
    dailySnapshotBoundsLoaded.value &&
    Boolean(dailySnapshotMinDate.value && dailySnapshotMaxDate.value)
)

const referenceDatePickerValue = computed(() => {
  const stored = alertStore.referenceSettings.referenceDate
  return stored && parseTypedIsoDate(stored) ? stored : ''
})

const watchedCount = computed(() => statisticsUiStore.watchedChampionIds.length)

const referenceMode = computed({
  get: () => alertStore.referenceSettings.mode,
  set: (mode: SurveillanceReferenceMode) => alertStore.setReferenceSettings({ mode }),
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

  try {
    const bounds = await $fetch<{ minDate: string | null; maxDate: string | null }>(
      apiUrl('/api/stats/tier-daily-snapshots/date-bounds')
    )
    if (bounds.minDate && bounds.maxDate) {
      dailySnapshotMinDate.value = bounds.minDate
      dailySnapshotMaxDate.value = bounds.maxDate
      const stored = alertStore.referenceSettings.referenceDate
      if (stored) {
        const clamped = clampIsoDate(stored, bounds.minDate, bounds.maxDate)
        if (clamped !== stored) {
          alertStore.setReferenceSettings({ referenceDate: clamped })
        }
        referenceDateText.value = clamped
      }
    }
  } catch {
    dailySnapshotMinDate.value = null
    dailySnapshotMaxDate.value = null
  } finally {
    dailySnapshotBoundsLoaded.value = true
  }
})

watch(
  () => alertStore.referenceSettings.referenceDate,
  value => {
    referenceDateText.value = value ?? ''
    referenceDateInvalid.value = false
  },
  { immediate: true }
)

function commitReferenceDate(iso: string | null): void {
  referenceDateInvalid.value = false
  if (!iso) {
    referenceDateText.value = ''
    alertStore.setReferenceSettings({ referenceDate: null })
    return
  }
  const min = dailySnapshotMinDate.value
  const max = dailySnapshotMaxDate.value
  const clamped = min && max ? clampIsoDate(iso, min, max) : iso
  referenceDateText.value = clamped
  alertStore.setReferenceSettings({ referenceDate: clamped })
}

function onReferenceDateTextInput(raw: string): void {
  referenceDateText.value = raw
  referenceDateInvalid.value = false
  const parsed = parseTypedIsoDate(raw)
  if (parsed) commitReferenceDate(parsed)
}

function commitReferenceDateText(): void {
  const raw = referenceDateText.value.trim()
  if (!raw) {
    commitReferenceDate(null)
    return
  }
  const parsed = parseTypedIsoDate(raw)
  if (!parsed) {
    referenceDateInvalid.value = true
    return
  }
  commitReferenceDate(parsed)
}

function onReferenceDatePickerInput(raw: string): void {
  commitReferenceDate(raw.trim() || null)
}

const selectedProfile = computed(() =>
  alertStore.thresholdProfiles.find(p => p.cohortKey === selectedCohortKey.value)
)

const isGlobalCohort = computed(() => selectedCohortKey.value === SURVEILLANCE_GLOBAL_COHORT_KEY)

const canEditSelectedCohort = computed(() => !isGlobalCohort.value)

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
      showEditCohort.value = false
    }
  },
  { immediate: true }
)

function selectCohort(cohortKey: string): void {
  if (cohortKey !== selectedCohortKey.value) {
    showEditCohort.value = false
  }
  selectedCohortKey.value = cohortKey
}

function toggleAddCohort(): void {
  showAddCohort.value = !showAddCohort.value
  if (showAddCohort.value) showEditCohort.value = false
}

function toggleEditCohort(): void {
  showEditCohort.value = !showEditCohort.value
  if (showEditCohort.value) showAddCohort.value = false
}

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
  const profile = alertStore.thresholdProfiles.find(p => p.cohortKey === cohortKey)
  return resolveSurveillanceCohortLabel(profile ?? { cohortKey, label: null }, key => t(key))
}

function cohortDefaultLabel(cohortKey: string): string {
  return formatSurveillanceCohortLabel(cohortKey, key => t(key))
}

const cohortNameInput = computed({
  get: () => selectedProfile.value?.label ?? '',
  set: (value: string) => {
    if (!selectedProfile.value) return
    alertStore.setCohortLabel(selectedCohortKey.value, value)
  },
})

function onCohortNameInput(raw: string): void {
  cohortNameInput.value = raw
}

const pendingCohortDefaultLabel = computed(() => {
  if (pendingRankTiers.value.length === 0) return ''
  return formatSurveillanceCohortLabel(surveillanceCohortKey(pendingRankTiers.value), key => t(key))
})

function onPendingCohortNameInput(raw: string): void {
  pendingCohortName.value = raw
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

function toggleSharedThresholds(): void {
  const next = !alertStore.sharedThresholds
  alertStore.setSharedThresholds(next, selectedCohortKey.value)
  showFeedback(
    next
      ? t('statisticsPage.settingsAlertsThresholdModeSharedEnabled')
      : t('statisticsPage.settingsAlertsThresholdModeSeparateEnabled')
  )
}

function resetCurrentCohort(): void {
  alertStore.resetProfileThresholds(selectedCohortKey.value)
  showFeedback(t('statisticsPage.settingsAlertsResetCohortDone'))
}

function resetAllThresholds(): void {
  alertStore.resetThresholds()
  showFeedback(t('statisticsPage.settingsAlertsResetDone'))
}

function togglePendingTier(tier: string): void {
  const arr = pendingRankTiers.value
  pendingRankTiers.value = arr.includes(tier) ? arr.filter(value => value !== tier) : [...arr, tier]
}

function confirmAddCohort(): void {
  if (pendingRankTiers.value.length === 0) return
  const key = alertStore.addCohortProfile(pendingRankTiers.value)
  if (pendingCohortName.value.trim()) {
    alertStore.setCohortLabel(key, pendingCohortName.value)
  }
  selectedCohortKey.value = key
  pendingRankTiers.value = []
  pendingCohortName.value = ''
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
  showEditCohort.value = false
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
