<template>
  <div class="space-y-3">
    <div v-if="pending" class="text-xs text-text/60">{{ t('statisticsPage.loading') }}</div>
    <div v-else-if="error" class="text-xs text-accent-light/90">{{ error }}</div>
    <div v-else-if="visibleBuilds.length === 0" class="text-xs text-text/55">
      {{
        hasBuildAlertFilters
          ? t('statisticsPage.surveillanceAlertFilterNoBuilds')
          : t('statisticsPage.surveillanceBuildsEmpty')
      }}
    </div>
    <ul v-else class="surveillance-build-sets flex flex-wrap gap-3">
      <li
        v-for="build in visibleBuilds"
        :key="buildFingerprint(build.items)"
        class="surveillance-build-set-card flex w-fit max-w-full flex-col gap-2 rounded-lg border border-primary/25 bg-surface/25 px-2 py-2"
        :class="hasBuildAlert(build.items) ? 'border-accent/50 ring-1 ring-accent/30' : ''"
      >
        <div class="flex flex-nowrap items-center gap-1">
          <img
            v-for="itemId in build.items"
            :key="itemId"
            :src="itemImageUrl(itemId)"
            :alt="String(itemId)"
            class="h-8 w-8 shrink-0 rounded object-cover"
            width="32"
            height="32"
            loading="lazy"
          />
        </div>
        <div
          class="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[10px] leading-snug text-text/75"
        >
          <span class="inline-flex items-baseline gap-1">
            <span class="font-medium uppercase tracking-wide text-text/45">
              {{ t('statisticsPage.overviewDetailWinRate') }}
            </span>
            <span class="font-semibold tabular-nums" :class="winrateClass(build.winrate)">
              {{ formatPct(build.winrate) }}
            </span>
          </span>
          <span class="inline-flex items-baseline gap-1">
            <span class="font-medium uppercase tracking-wide text-text/45">
              {{ t('statisticsPage.overviewDetailPickRate') }}
            </span>
            <span class="font-semibold tabular-nums text-text/85">
              {{ formatPct(build.pickrate) }}
            </span>
          </span>
          <span class="inline-flex items-baseline gap-1 tabular-nums text-text/70">
            <span class="font-semibold text-text/85">{{ build.games }}</span>
            <span class="text-text/50">{{ t('statisticsPage.surveillanceBuildGames') }}</span>
          </span>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useBuildSurveillanceEvaluation } from '~/composables/useBuildSurveillanceEvaluation'
import {
  buildFingerprint,
  type BuildRowLike,
  type BuildSurveillanceTrigger,
} from '~/utils/buildSurveillance'
import { getItemImageUrl } from '~/utils/imageUrl'
import { useGameVersion } from '~/composables/useGameVersion'
import {
  filterBuildTriggers,
  isBuildSurveillanceFilter,
  type SurveillanceAlertFilterId,
} from '~/utils/surveillanceAlertFilters'

const props = defineProps<{
  championKey: number
  filterRole: string
  filterRank: string[]
  filterVersion: string
  alertFilterIds?: SurveillanceAlertFilterId[]
  buildAlertTriggers?: BuildSurveillanceTrigger[]
}>()

const { t } = useI18n()
const { version: gameVersion } = useGameVersion()
const { fetchChampionBuilds } = useBuildSurveillanceEvaluation()

const builds = ref<BuildRowLike[]>([])
const pending = ref(false)
const error = ref<string | null>(null)

const buildAlerts = computed(() => props.buildAlertTriggers ?? [])

const hasBuildAlertFilters = computed(() =>
  (props.alertFilterIds ?? []).some(isBuildSurveillanceFilter)
)

const visibleBuilds = computed(() => {
  if (!hasBuildAlertFilters.value) return builds.value
  const matchingFingerprints = new Set(
    filterBuildTriggers(buildAlerts.value, props.alertFilterIds ?? []).map(
      trigger => trigger.fingerprint
    )
  )
  return builds.value.filter(build => matchingFingerprints.has(buildFingerprint(build.items)))
})

function formatPct(value: number): string {
  return `${Number(value).toFixed(1)}%`
}

function winrateClass(winrate: number): string {
  if (winrate > 51) return 'text-info/90'
  if (winrate < 49) return 'text-error/90'
  return 'text-text/85'
}

function itemImageUrl(itemId: number): string {
  return getItemImageUrl(gameVersion.value, `${itemId}.png`)
}

function hasBuildAlert(items: number[]): boolean {
  const fp = buildFingerprint(items)
  return buildAlerts.value.some(trigger => trigger.fingerprint === fp)
}

async function loadBuilds(): Promise<void> {
  pending.value = true
  error.value = null
  try {
    const rows = await fetchChampionBuilds(props.championKey, {
      rankTiers: props.filterRank,
      role: props.filterRole,
      patch: props.filterVersion,
    })
    if (rows === null) {
      builds.value = []
      error.value = t('statisticsPage.surveillanceBuildsLoadError')
      return
    }
    builds.value = rows
  } finally {
    pending.value = false
  }
}

watch(
  () => [props.championKey, props.filterRole, props.filterRank, props.filterVersion],
  () => {
    loadBuilds().catch(() => undefined)
  },
  { immediate: true, deep: true }
)
</script>
