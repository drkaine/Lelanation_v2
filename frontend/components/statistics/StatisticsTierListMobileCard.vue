<script setup lang="ts">
import { computed, inject } from 'vue'

export type TierListMobileRow = {
  championId: number
  tier: string
  mainRole: string
  mainRolePct: number
  winrate: number
  pickrate: number
  pbi: number
  games: number
  patchRefMainRolePctPp?: number | null
  patchRefWinratePp?: number | null
  patchRefPickratePp?: number | null
  patchRefMatchupScorePp?: number | null
  patchRefGamesDelta?: number | null
  highEloWinrate?: number | null
  patchRefHighEloWinratePp?: number | null
  highEloGames?: number | null
  patchRefHighEloGamesDelta?: number | null
  highEloRank?: number | null
  delta?: number | null
}

const props = defineProps<{
  row: TierListMobileRow
  expanded: boolean
  hasHighElo: boolean
}>()

const emit = defineEmits<{
  toggle: []
}>()

const p = inject('statisticsPageCtx') as Record<string, unknown>

function t(key: string, params?: Record<string, string>): string {
  const fn = p.t as ((k: string, p?: Record<string, string>) => string) | undefined
  return fn?.(key, params) ?? key
}

function tierLabel(tier: string): string {
  if (tier === 'D') return t('statisticsPage.tierF')
  if (tier === 'S+') return t('statisticsPage.tierS+')
  return t(`statisticsPage.tier${tier}`)
}

const displayRank = computed(() => {
  const map = p.tierListDisplayRankByChampionId as Map<number, number | string> | undefined
  return map?.get(props.row.championId) ?? '—'
})

const patchRankDelta = computed(() => {
  const fn = p.tierListPatchRankDelta as ((id: number) => number | null | undefined) | undefined
  return fn?.(props.row.championId) ?? null
})

const patchHighEloRankDelta = computed(() => {
  const fn = p.tierListPatchHighEloRankDelta as
    | ((id: number) => number | null | undefined)
    | undefined
  return fn?.(props.row.championId) ?? null
})

const roleLabel = computed(() => {
  const mainRoleLabel = p.mainRoleLabel as ((r: string) => string) | undefined
  const lane = mainRoleLabel?.(props.row.mainRole) ?? props.row.mainRole
  return `${tierLabel(props.row.tier)} · ${lane} ${Number(props.row.mainRolePct).toFixed(0)}%`
})

const portraitSrc = computed(() => {
  const gv = p.gameVersion as string | undefined
  const byKey = p.championByKey as ((id: number) => { image: { full: string } } | null) | undefined
  const urlFn = p.getChampionImageUrl as ((v: string, f: string) => string) | undefined
  const champ = byKey?.(props.row.championId)
  if (!gv || !champ || !urlFn) return null
  return urlFn(gv, champ.image.full)
})

const detailTo = computed(() => {
  const pathFn = p.localePath as ((path: string) => string) | undefined
  const byKey = p.championByKey as ((id: number) => unknown) | undefined
  if (!pathFn || !byKey?.(props.row.championId)) return null
  return pathFn(`/statistics/champion/${encodeURIComponent(String(props.row.championId))}`)
})

const patchRefLabel = computed(() => (p.tierListPatchDeltaRefLabel as string | null) ?? null)

function winrateClass(v: number): string {
  const fn = p.tierListWinrateClass as ((n: number) => string) | undefined
  return fn?.(v) ?? 'text-text'
}

function deltaClass(v: number | null | undefined): string {
  const fn = p.tierListPatchDeltaClass as ((n: number) => string) | undefined
  if (!patchRefLabel.value || v == null) return 'text-text/55'
  return fn?.(v) ?? 'text-text/55'
}

function formatPp(v: number | null | undefined): string {
  const fn = p.formatTierListPatchDeltaPp as ((n: number) => string) | undefined
  if (v == null) return '—'
  return fn?.(v) ?? `${v >= 0 ? '+' : ''}${v.toFixed(2)}`
}

function formatRank(v: number): string {
  const fn = p.formatTierListPatchDeltaRank as ((n: number) => string) | undefined
  return fn?.(v) ?? `${v >= 0 ? '+' : ''}${v}`
}

function formatGames(v: number): string {
  const fn = p.formatTierListPatchDeltaGames as ((n: number) => string) | undefined
  return fn?.(v) ?? `${v >= 0 ? '+' : ''}${v}`
}

function gamesDeltaClass(v: number): string {
  const fn = p.tierListPatchDeltaGamesClass as ((n: number) => string) | undefined
  return fn?.(v) ?? deltaClass(v)
}

function rankDeltaClass(v: number): string {
  const fn = p.tierListPatchDeltaRankClass as ((n: number) => string) | undefined
  return fn?.(v) ?? deltaClass(v)
}
</script>

<template>
  <article
    class="statistics-champion-stats-mobile-card statistics-tier-list-mobile-card w-full overflow-hidden rounded-lg border border-primary/30 bg-surface/40"
  >
    <div
      class="statistics-champion-stats-mobile-card-header flex w-full min-w-0 items-center gap-3 p-3"
    >
      <StatisticsChampionStatsMobileCardHeader
        :champion-id="row.championId"
        :champion-name="
          String(
            (p.championName as ((id: number) => string | null) | undefined)?.(row.championId) ||
              row.championId
          )
        "
        :search-query="String(p.championSearchQuery ?? '')"
        :role-label="roleLabel"
        :role-icon-src="
          (p.mainRoleIconSrc as ((r: string) => string | null) | undefined)?.(row.mainRole) ?? null
        "
        :portrait-src="portraitSrc"
        :portrait-alt="
          String(
            (p.championName as ((id: number) => string | null) | undefined)?.(row.championId) || ''
          )
        "
        :detail-to="detailTo"
      />
      <button
        type="button"
        class="flex min-w-0 flex-1 justify-end gap-3 text-right"
        @click="emit('toggle')"
      >
        <div class="min-w-0 shrink">
          <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
            {{ t('statisticsPage.winrate') }}
          </div>
          <div
            class="text-2xl font-bold tabular-nums leading-none sm:text-3xl"
            :class="winrateClass(row.winrate * 100)"
          >
            {{ (row.winrate * 100).toFixed(2) }}
          </div>
          <div
            v-if="patchRefLabel && row.patchRefWinratePp != null"
            class="mt-0.5 text-xs tabular-nums leading-none"
            :class="deltaClass(row.patchRefWinratePp)"
          >
            {{ formatPp(row.patchRefWinratePp) }}
          </div>
        </div>
        <div class="min-w-0 shrink">
          <div class="text-[10px] font-medium uppercase tracking-wide text-text/55">
            {{ t('statisticsPage.pickrate') }}
          </div>
          <div class="text-2xl font-bold tabular-nums leading-none text-text sm:text-3xl">
            {{ (row.pickrate * 100).toFixed(2) }}
          </div>
          <div
            v-if="patchRefLabel && row.patchRefPickratePp != null"
            class="mt-0.5 text-xs tabular-nums leading-none"
            :class="deltaClass(row.patchRefPickratePp)"
          >
            {{ formatPp(row.patchRefPickratePp) }}
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
          {{ displayRank }}
          <span
            v-if="patchRefLabel && patchRankDelta != null"
            class="ml-1 text-xs"
            :class="rankDeltaClass(patchRankDelta)"
          >
            {{ formatRank(patchRankDelta) }}
          </span>
        </span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.tierListTier') }}</span>
        <span class="font-semibold tabular-nums">{{ tierLabel(row.tier) }}</span>
      </div>
      <div class="flex flex-wrap items-baseline justify-between gap-x-2">
        <span>{{ t('statisticsPage.tierListPbi') }}</span>
        <span class="tabular-nums">
          {{
            (p.formatMatchupScore as ((n: number, d?: number) => string) | undefined)?.(
              row.pbi,
              2
            ) ?? row.pbi.toFixed(2)
          }}
          <span
            v-if="patchRefLabel && row.patchRefMatchupScorePp != null"
            class="ml-1 text-xs"
            :class="deltaClass(row.patchRefMatchupScorePp)"
          >
            {{ formatPp(row.patchRefMatchupScorePp) }}
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
            {{ formatGames(row.patchRefGamesDelta) }}
          </span>
        </span>
      </div>
      <template v-if="hasHighElo">
        <div class="flex flex-wrap items-baseline justify-between gap-x-2 text-amber-200/90">
          <span>{{ t('statisticsPage.tierListHighEloRank') }}</span>
          <span class="tabular-nums">
            {{ row.highEloRank ?? '—' }}
            <span
              v-if="patchRefLabel && patchHighEloRankDelta != null"
              class="ml-1 text-xs"
              :class="rankDeltaClass(patchHighEloRankDelta)"
            >
              {{ formatRank(patchHighEloRankDelta) }}
            </span>
          </span>
        </div>
        <div class="flex flex-wrap items-baseline justify-between gap-x-2">
          <span>{{ t('statisticsPage.tierListHighEloWin') }}</span>
          <span
            class="tabular-nums"
            :class="row.highEloWinrate != null ? winrateClass(row.highEloWinrate * 100) : ''"
          >
            {{ row.highEloWinrate != null ? (row.highEloWinrate * 100).toFixed(2) + '%' : '—' }}
            <span
              v-if="patchRefLabel && row.patchRefHighEloWinratePp != null"
              class="ml-1 text-xs"
              :class="deltaClass(row.patchRefHighEloWinratePp)"
            >
              {{ formatPp(row.patchRefHighEloWinratePp) }}
            </span>
          </span>
        </div>
        <div class="flex flex-wrap items-baseline justify-between gap-x-2">
          <span>{{ t('statisticsPage.tierListHighEloGames') }}</span>
          <span class="tabular-nums">
            {{ row.highEloGames != null ? row.highEloGames.toLocaleString() : '—' }}
            <span
              v-if="patchRefLabel && row.patchRefHighEloGamesDelta != null"
              class="ml-1 text-xs"
              :class="gamesDeltaClass(row.patchRefHighEloGamesDelta)"
            >
              {{ formatGames(row.patchRefHighEloGamesDelta) }}
            </span>
          </span>
        </div>
        <div v-if="row.delta != null" class="flex flex-wrap items-baseline justify-between gap-x-2">
          <span>{{ t('statisticsPage.tierListDelta') }}</span>
          <span class="tabular-nums">
            {{ (row.delta > 0 ? '+' : '') + Number(row.delta).toFixed(2) }}
          </span>
        </div>
      </template>
    </div>
  </article>
</template>
