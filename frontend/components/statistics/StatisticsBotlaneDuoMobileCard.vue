<script setup lang="ts">
import { computed, inject } from 'vue'
import { getChampionImageUrl } from '~/utils/imageUrl'
import type { BotlaneTierRowWithPatchDelta } from '~/composables/statistics/botlanePatchDeltas'

const props = defineProps<{
  row: BotlaneTierRowWithPatchDelta
  mode: 'duoRank' | 'matchups'
  expanded: boolean
  patchRefLabel: string | null
}>()

const emit = defineEmits<{
  toggle: []
}>()

const p = inject('statisticsPageCtx') as Record<string, unknown>

function t(key: string, params?: Record<string, string>): string {
  const fn = p.t as ((k: string, p?: Record<string, string>) => string) | undefined
  return fn?.(key, params) ?? key
}

function championName(id: number): string {
  const fn = p.championName as ((id: number) => string | null) | undefined
  return fn?.(id) ?? String(id)
}

function tierLabel(tier: string): string {
  switch (tier) {
    case 'S+':
      return t('statisticsPage.tierS+')
    case 'S':
      return t('statisticsPage.tierS')
    case 'A':
      return t('statisticsPage.tierA')
    case 'B':
      return t('statisticsPage.tierB')
    case 'C':
      return t('statisticsPage.tierC')
    default:
      return t('statisticsPage.tierF')
  }
}

const title = computed(() => {
  if (props.mode === 'matchups') {
    return `${championName(props.row.adcId)} + ${championName(props.row.supportId)}`
  }
  return `${championName(props.row.adcId)} + ${championName(props.row.supportId)}`
})

const subtitle = computed(() => {
  if (props.mode !== 'matchups') return tierLabel(props.row.tier)
  const opp = props.row as BotlaneTierRowWithPatchDelta & {
    oppAdcId: number
    oppSupportId: number
  }
  return `${t('statisticsPage.vsBotlaneEnemyDuo')}: ${championName(opp.oppAdcId)} + ${championName(opp.oppSupportId)}`
})

const gameVersion = computed(() => String(p.gameVersion ?? ''))

function portraitSrc(championId: number): string | null {
  const byKey = p.championByKey as ((id: number) => { image: { full: string } } | null) | undefined
  const champ = byKey?.(championId)
  if (!gameVersion.value || !champ) return null
  return getChampionImageUrl(gameVersion.value, champ.image.full)
}

function fmtPct01(v: number): string {
  return `${(v * 100).toFixed(2)}%`
}

function fmtPatchPp(v: number | null | undefined): string {
  if (v == null) return '—'
  const fn = p.formatTierListPatchDeltaPp as ((n: number) => string) | undefined
  return fn?.(v) ?? `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}

function fmtPatchRank(v: number | null | undefined): string {
  if (v == null) return '—'
  const fn = p.formatTierListPatchDeltaRank as ((n: number) => string) | undefined
  return fn?.(v) ?? `${v >= 0 ? '+' : ''}${v}`
}

function patchPpClass(v: number | null | undefined): string {
  if (!props.patchRefLabel || v == null) return 'text-text/55'
  const fn = p.tierListPatchDeltaClass as ((n: number) => string) | undefined
  return fn?.(v) ?? 'text-text/55'
}

function patchRankClass(v: number | null | undefined): string {
  if (!props.patchRefLabel || v == null) return 'text-text/55'
  const fn = p.tierListPatchDeltaRankClass as ((n: number) => string) | undefined
  return fn?.(v) ?? patchPpClass(v)
}

function winrateClass(v: number): string {
  const fn = p.tierListWinrateClass as ((n: number) => string) | undefined
  return fn?.(v * 100) ?? 'text-text'
}

function fmtDeltaPp(v: number | null | undefined): string {
  if (v == null) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}

function deltaVsPeersClass(v: number | null | undefined): string {
  if (v == null) return 'text-text/55'
  if (v > 0) return 'text-info/90'
  if (v < 0) return 'text-error/90'
  return 'text-text/80'
}

function gamesDeltaClass(v: number): string {
  const fn = p.tierListPatchDeltaGamesClass as ((n: number) => string) | undefined
  return fn?.(v) ?? patchPpClass(v)
}

function formatGamesDelta(v: number): string {
  const fn = p.formatTierListPatchDeltaGames as ((n: number) => string) | undefined
  return fn?.(v) ?? `${v >= 0 ? '+' : ''}${v}`
}
</script>

<template>
  <article
    class="statistics-champion-stats-mobile-card statistics-botlane-duo-mobile-card w-full overflow-hidden"
  >
    <div
      class="statistics-champion-stats-mobile-card-header flex w-full min-w-0 items-center gap-3 p-3"
    >
      <div class="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
        <div class="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
          <div
            class="statistics-champion-stats-mobile-name w-full truncate text-sm font-semibold leading-tight text-text"
            :title="title"
          >
            {{ title }}
          </div>
          <div class="w-full truncate text-xs text-text/70" :title="subtitle">
            {{ subtitle }}
          </div>
        </div>
        <div
          class="flex items-center justify-center gap-1"
          :class="mode === 'matchups' ? 'grid w-full max-w-[4.5rem] grid-cols-2 gap-0.5' : ''"
        >
          <StatisticsChampionDetailLink
            v-if="portraitSrc(row.adcId)"
            :champion-id="row.adcId"
            class="mx-auto shrink-0 rounded-sm"
          >
            <img
              :src="portraitSrc(row.adcId)!"
              :alt="championName(row.adcId)"
              class="rounded-sm border border-black/40 object-cover"
              :class="mode === 'matchups' ? 'h-10 w-10' : 'h-12 w-12'"
              :width="mode === 'matchups' ? 40 : 48"
              :height="mode === 'matchups' ? 40 : 48"
              loading="lazy"
            />
          </StatisticsChampionDetailLink>
          <StatisticsChampionDetailLink
            v-if="portraitSrc(row.supportId)"
            :champion-id="row.supportId"
            class="mx-auto shrink-0 rounded-sm"
          >
            <img
              :src="portraitSrc(row.supportId)!"
              :alt="championName(row.supportId)"
              class="rounded-sm border border-black/40 object-cover"
              :class="mode === 'matchups' ? 'h-10 w-10' : 'h-12 w-12'"
              :width="mode === 'matchups' ? 40 : 48"
              :height="mode === 'matchups' ? 40 : 48"
              loading="lazy"
            />
          </StatisticsChampionDetailLink>
          <template v-if="mode === 'matchups'">
            <StatisticsChampionDetailLink
              v-if="
                portraitSrc((row as BotlaneTierRowWithPatchDelta & { oppAdcId: number }).oppAdcId)
              "
              :champion-id="(row as BotlaneTierRowWithPatchDelta & { oppAdcId: number }).oppAdcId"
              class="mx-auto shrink-0 rounded-sm"
            >
              <img
                :src="
                  portraitSrc(
                    (row as BotlaneTierRowWithPatchDelta & { oppAdcId: number }).oppAdcId
                  )!
                "
                :alt="
                  championName(
                    (row as BotlaneTierRowWithPatchDelta & { oppAdcId: number }).oppAdcId
                  )
                "
                class="h-10 w-10 rounded-sm border border-red-500/40 object-cover"
                width="40"
                height="40"
                loading="lazy"
              />
            </StatisticsChampionDetailLink>
            <StatisticsChampionDetailLink
              v-if="
                portraitSrc(
                  (row as BotlaneTierRowWithPatchDelta & { oppSupportId: number }).oppSupportId
                )
              "
              :champion-id="
                (row as BotlaneTierRowWithPatchDelta & { oppSupportId: number }).oppSupportId
              "
              class="mx-auto shrink-0 rounded-sm"
            >
              <img
                :src="
                  portraitSrc(
                    (row as BotlaneTierRowWithPatchDelta & { oppSupportId: number }).oppSupportId
                  )!
                "
                :alt="
                  championName(
                    (row as BotlaneTierRowWithPatchDelta & { oppSupportId: number }).oppSupportId
                  )
                "
                class="h-10 w-10 rounded-sm border border-red-500/40 object-cover"
                width="40"
                height="40"
                loading="lazy"
              />
            </StatisticsChampionDetailLink>
          </template>
        </div>
      </div>
      <button
        type="button"
        class="flex min-w-0 flex-1 touch-manipulation justify-end gap-3 text-right"
        @click="emit('toggle')"
      >
        <div class="min-w-0 shrink">
          <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
            {{ t('statisticsPage.winrate') }}
          </div>
          <div
            class="text-2xl font-bold tabular-nums leading-none sm:text-3xl"
            :class="winrateClass(row.winrate)"
          >
            {{ fmtPct01(row.winrate) }}
          </div>
          <div
            v-if="patchRefLabel && row.patchRefWinratePp != null"
            class="mt-0.5 text-xs tabular-nums leading-none"
            :class="patchPpClass(row.patchRefWinratePp)"
          >
            {{ fmtPatchPp(row.patchRefWinratePp) }}
          </div>
        </div>
        <div class="min-w-0 shrink">
          <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
            {{ t('statisticsPage.tierListPickrate') }}
          </div>
          <div class="text-2xl font-bold tabular-nums leading-none text-text sm:text-3xl">
            {{ fmtPct01(row.pickrate) }}
          </div>
          <div
            v-if="patchRefLabel && row.patchRefPickratePp != null"
            class="mt-0.5 text-xs tabular-nums leading-none"
            :class="patchPpClass(row.patchRefPickratePp)"
          >
            {{ fmtPatchPp(row.patchRefPickratePp) }}
          </div>
        </div>
      </button>
    </div>
    <div
      v-if="expanded"
      class="space-y-1.5 border-t border-primary/20 bg-black/20 px-3 py-2.5 text-sm text-text/85"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.tierListRank') }}</span>
        <span class="tabular-nums">
          {{ row.rank }}
          <span
            v-if="patchRefLabel && row.patchRefRankDelta != null"
            class="ml-1 text-xs"
            :class="patchRankClass(row.patchRefRankDelta)"
          >
            {{ fmtPatchRank(row.patchRefRankDelta) }}
          </span>
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.tierListTier') }}</span>
        <span class="font-semibold">{{ tierLabel(row.tier) }}</span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.tierListPbi') }}</span>
        <span class="tabular-nums">
          {{ row.score.toFixed(2) }}
          <span
            v-if="patchRefLabel && row.patchRefScorePp != null"
            class="ml-1 text-xs"
            :class="patchPpClass(row.patchRefScorePp)"
          >
            {{ fmtPatchPp(row.patchRefScorePp) }}
          </span>
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.vsBotlaneDeltaShort') }}</span>
        <span class="tabular-nums" :class="deltaVsPeersClass(row.deltaVsPeersPp)">
          {{ fmtDeltaPp(row.deltaVsPeersPp) }}
          <span
            v-if="patchRefLabel && row.patchRefDeltaVsPeersPp != null"
            class="ml-1 text-xs"
            :class="patchPpClass(row.patchRefDeltaVsPeersPp)"
          >
            {{ fmtPatchPp(row.patchRefDeltaVsPeersPp) }}
          </span>
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.tierListGames') }}</span>
        <span class="tabular-nums">
          {{ row.games.toLocaleString() }}
          <span
            v-if="patchRefLabel && row.patchRefGamesDelta != null"
            class="ml-1 text-xs"
            :class="gamesDeltaClass(row.patchRefGamesDelta)"
          >
            {{ formatGamesDelta(row.patchRefGamesDelta) }}
          </span>
        </span>
      </div>
    </div>
  </article>
</template>
