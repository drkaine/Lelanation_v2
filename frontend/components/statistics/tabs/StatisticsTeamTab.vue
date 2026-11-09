<script setup lang="ts">
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { barList } from '~/utils/statistics/overviewCards'
import { sideSurrenderRates } from '~/utils/statistics/sideSummary'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()
const { locale } = useI18n()
const detailOpen = ref(false)
const mobileSide = ref<'blue' | 'red'>('blue')

function fmtPct(v: number | string | null | undefined, digits = 2): string {
  const n = Number(v)
  if (v == null || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString(locale.value, { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`
}

const blueRates = computed(() => sideSurrenderRates(p.sidesSurrenderBySide.blue))
const redRates = computed(() => sideSurrenderRates(p.sidesSurrenderBySide.red))

type WrRow = { championId: number | string; winrate: number | string }
const toBars = (rows: readonly WrRow[]) =>
  barList(
    rows.map(r => ({ championId: Number(r.championId), value: Number(r.winrate) || 0 })),
    { limit: 5, baseline: 50 }
  )
const bestCols = computed(() => [
  {
    side: 'blue',
    labelKey: 'statisticsPage.sidesBlueCol',
    rows: toBars(p.sidesBlueBestWinrateRows as WrRow[]),
  },
  {
    side: 'red',
    labelKey: 'statisticsPage.sidesRedCol',
    rows: toBars(p.sidesRedBestWinrateRows as WrRow[]),
  },
])
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg">
      <div v-if="p.overviewSidesPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div v-else-if="p.overviewSidesData" class="tm-wrap">
        <h2 class="tm-h2">{{ p.t('statisticsPage.sidesSectionTitle') }}</h2>
        <section class="tm-card">
          <div class="tm-split-head">
            <div>
              <div class="tm-side-label is-blue">{{ p.t('statisticsPage.sidesBlueSide') }}</div>
              <div class="tm-big">{{ fmtPct(p.sidesDonutBluePct) }}</div>
            </div>
            <div class="tm-split-mid">{{ p.t('statisticsPage.sidesWinrateSoloDuo') }}</div>
            <div class="tm-right">
              <div class="tm-side-label is-red">{{ p.t('statisticsPage.sidesRedSide') }}</div>
              <div class="tm-big">{{ fmtPct(p.sidesDonutRedPct) }}</div>
            </div>
          </div>
          <div
            class="tm-split-bar"
            role="img"
            :aria-label="`${p.t('statisticsPage.sidesBlueSide')} ${p.sidesDonutBluePct}% · ${p.t('statisticsPage.sidesRedSide')} ${p.sidesDonutRedPct}%`"
          >
            <div class="tm-fill-blue" :style="{ width: `${Number(p.sidesDonutBluePct) || 0}%` }" />
            <div class="tm-fill-red" :style="{ width: `${Number(p.sidesDonutRedPct) || 0}%` }" />
          </div>
          <div class="tm-facts">
            <div>
              <div class="tm-fact-label">{{ p.t('statisticsPage.sidesSurrenders') }}</div>
              <div class="tm-fact">
                <span class="is-blue">{{ fmtPct(blueRates.surrenderPct, 1) }}</span>
                {{ p.t('statisticsPage.sidesBlueShort') }} ·
                <span class="is-red">{{ fmtPct(redRates.surrenderPct, 1) }}</span>
                {{ p.t('statisticsPage.sidesRedShort') }}
              </div>
            </div>
            <div>
              <div class="tm-fact-label">{{ p.t('statisticsPage.sidesEarlySurrenders') }}</div>
              <div class="tm-fact">
                <span class="is-blue">{{ fmtPct(blueRates.earlyPct) }}</span>
                {{ p.t('statisticsPage.sidesBlueShort') }} ·
                <span class="is-red">{{ fmtPct(redRates.earlyPct) }}</span>
                {{ p.t('statisticsPage.sidesRedShort') }}
              </div>
            </div>
            <div>
              <div class="tm-fact-label">{{ p.t('statisticsPage.sidesPicksBans') }}</div>
              <div class="tm-fact">
                {{ p.t('statisticsPage.sidesPicksBansNote') }} —
                <button type="button" class="tm-link" @click="detailOpen = !detailOpen">
                  {{
                    p.t(
                      detailOpen
                        ? 'statisticsPage.sidesHideDetail'
                        : 'statisticsPage.sidesSeeDetail'
                    )
                  }}
                </button>
              </div>
            </div>
          </div>
          <p class="tm-mfacts">
            {{ p.t('statisticsPage.sidesMobileAbandons') }}
            <span class="is-blue">{{ fmtPct(blueRates.surrenderPct, 1) }}</span>
            {{ p.t('statisticsPage.sidesMobileBlue') }} ·
            <span class="is-red">{{ fmtPct(redRates.surrenderPct, 1) }}</span>
            {{ p.t('statisticsPage.sidesMobileRed') }}.
            {{ p.t('statisticsPage.sidesMobilePicksSame') }}
          </p>
        </section>

        <section class="tm-card">
          <header class="tm-card-head">
            <h3 class="tm-card-title">{{ p.t('statisticsPage.sidesBestWinrateTitle') }}</h3>
            <span class="tm-card-sub">{{ p.t('statisticsPage.sidesBestWinrateSub') }}</span>
            <div class="tm-mseg" role="group">
              <button
                v-for="side in ['blue', 'red'] as const"
                :key="side"
                type="button"
                :class="{ 'is-on': mobileSide === side }"
                :aria-pressed="mobileSide === side"
                @click="mobileSide = side"
              >
                {{
                  p.t(
                    side === 'blue'
                      ? 'statisticsPage.sidesMobileSegBlue'
                      : 'statisticsPage.sidesMobileSegRed'
                  )
                }}
              </button>
            </div>
          </header>
          <div class="tm-cols">
            <div
              v-for="col in bestCols"
              :key="col.side"
              :class="{ 'is-moff': col.side !== mobileSide }"
            >
              <div class="tm-col-title" :class="col.side === 'blue' ? 'is-blue' : 'is-red'">
                {{ p.t(col.labelKey) }}
              </div>
              <ol v-if="col.rows.length" class="tm-bars">
                <li v-for="row in col.rows" :key="row.championId" class="tm-bar-row">
                  <img
                    v-if="p.gameVersion && p.championByKey(row.championId)"
                    loading="lazy"
                    decoding="async"
                    :src="
                      p.getChampionImageUrl(
                        p.gameVersion,
                        p.championByKey(row.championId)!.image.full
                      )
                    "
                    :alt="p.championName(row.championId) || ''"
                    class="tm-thumb"
                  />
                  <span v-else class="tm-thumb" />
                  <StatisticsChampionDetailLink :champion-id="row.championId" class="tm-bar-name">
                    {{ p.championName(row.championId) || row.championId }}
                  </StatisticsChampionDetailLink>
                  <div class="tm-track">
                    <div
                      class="tm-fill"
                      :class="col.side === 'blue' ? 'tm-fill-blue' : 'tm-fill-red'"
                      :style="{ width: `${row.pct}%` }"
                    />
                  </div>
                  <span class="tm-bar-val">{{ fmtPct(row.value, 1) }}</span>
                </li>
              </ol>
              <p v-else class="tm-empty">{{ p.t('statisticsPage.fastStatsNoData') }}</p>
            </div>
          </div>
        </section>

        <div
          v-show="detailOpen"
          class="statistics-fast-stat-grid flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-[10px]"
        >
          <div
            class="fast-stat-card flex w-full max-w-full flex-col items-center rounded-xl border border-primary/30 p-2"
          >
            <h3
              class="fast-stat-title mb-2 flex w-full items-center gap-2 text-sm font-semibold lg:text-left"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('team.sideWinrateDonut')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('team.sideWinrateDonut')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'team.sideWinrateDonut',
                    p.t('statisticsPage.sidesDonutTitleSoloDuo')
                  )
                "
              >
                {{ p.cardIsFavorite('team.sideWinrateDonut') ? '★' : '☆' }}
              </button>
              <span class="inline-flex flex-1 flex-wrap items-center">
                {{ p.t('statisticsPage.sidesDonutTitleSoloDuo') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover fast-stat-tooltip-popover--start hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.sidesWinrateShareNote') }}
                  </span>
                </span>
              </span>
            </h3>
            <div
              class="sides-split"
              role="img"
              :aria-label="`${p.t('statisticsPage.sidesBlue')} ${p.sidesDonutBluePct}% · ${p.t('statisticsPage.sidesRed')} ${p.sidesDonutRedPct}%`"
            >
              <div class="sides-split-labels">
                <span class="sides-split-blue"
                  >{{ p.t('statisticsPage.sidesBlue') }} {{ p.sidesDonutBluePct }}%</span
                >
                <span class="sides-split-red"
                  >{{ p.sidesDonutRedPct }}% {{ p.t('statisticsPage.sidesRed') }}</span
                >
              </div>
              <div class="sides-split-bar">
                <span
                  class="sides-split-fill-blue"
                  :style="{ width: `${Number(p.sidesDonutBluePct) || 0}%` }"
                />
                <span
                  class="sides-split-fill-red"
                  :style="{ width: `${Number(p.sidesDonutRedPct) || 0}%` }"
                />
              </div>
            </div>
          </div>
          <div
            class="fast-stat-card w-full max-w-full rounded-lg border border-info/55 bg-info/5 p-2"
          >
            <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('team.blueMatchOutcome')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('team.blueMatchOutcome')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'team.blueMatchOutcome',
                    `${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.overviewMatchOutcomesTitle')}`
                  )
                "
              >
                {{ p.cardIsFavorite('team.blueMatchOutcome') ? '★' : '☆' }}
              </button>
              <span class="inline-flex flex-1 flex-wrap items-center">
                {{ p.t('statisticsPage.sidesBlue') }} —
                {{ p.t('statisticsPage.overviewMatchOutcomesTitle') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipSidesMatchOutcomeCard') }}
                  </span>
                </span>
              </span>
            </h3>
            <div
              v-if="Number(p.sidesSurrenderBySide.blue.total) > 0"
              class="flex flex-col items-center gap-3 sm:flex-row sm:items-center"
            >
              <StatisticsMatchOutcomeDonut
                side-accent="blue"
                :total="Number(p.sidesSurrenderBySide.blue.total)"
                :early="Number(p.sidesSurrenderBySide.blue.earlySurrenderCount)"
                :surrender-only="p.sidesBlueSurrenderOnlyCount"
                :played="p.sidesBluePlayedCount"
              />
              <div class="min-w-0 space-y-1 text-xs">
                <div class="font-medium text-text">
                  Total: {{ Number(p.sidesSurrenderBySide.blue.total).toLocaleString() }}
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  &lt;15 min surrender:
                  {{ Number(p.sidesSurrenderBySide.blue.earlySurrenderCount).toLocaleString() }}
                  ({{
                    p.matchOutcomePct(
                      Number(p.sidesSurrenderBySide.blue.earlySurrenderCount),
                      Number(p.sidesSurrenderBySide.blue.total)
                    )
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent-light" />
                  Surrender: {{ p.sidesBlueSurrenderOnlyCount.toLocaleString() }} ({{
                    p.matchOutcomePct(
                      p.sidesBlueSurrenderOnlyCount,
                      Number(p.sidesSurrenderBySide.blue.total)
                    )
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-info" />
                  Jouees: {{ p.sidesBluePlayedCount.toLocaleString() }} ({{
                    p.matchOutcomePct(
                      p.sidesBluePlayedCount,
                      Number(p.sidesSurrenderBySide.blue.total)
                    )
                  }}%)
                </div>
              </div>
            </div>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.overviewNoData') }}
            </div>
          </div>
          <div
            class="fast-stat-card w-full max-w-full rounded-lg border border-error/55 bg-error/5 p-2"
          >
            <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('team.redMatchOutcome')
                    ? 'text-text-accent hover:text-accent-light'
                    : 'text-text/45 grayscale hover:text-text/75'
                "
                :title="
                  p.cardIsFavorite('team.redMatchOutcome')
                    ? 'Retirer des favoris'
                    : 'Ajouter aux favoris'
                "
                @click="
                  p.toggleFavoriteCard(
                    'team.redMatchOutcome',
                    `${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.overviewMatchOutcomesTitle')}`
                  )
                "
              >
                {{ p.cardIsFavorite('team.redMatchOutcome') ? '★' : '☆' }}
              </button>
              <span class="inline-flex flex-1 flex-wrap items-center">
                {{ p.t('statisticsPage.sidesRed') }} —
                {{ p.t('statisticsPage.overviewMatchOutcomesTitle') }}
                <span
                  class="group/stat-tip relative ml-1 inline-flex cursor-help text-text/50"
                  aria-hidden="true"
                >
                  ⓘ
                  <span
                    role="tooltip"
                    class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
                  >
                    {{ p.t('statisticsPage.tooltipSidesMatchOutcomeCard') }}
                  </span>
                </span>
              </span>
            </h3>
            <div
              v-if="Number(p.sidesSurrenderBySide.red.total) > 0"
              class="flex flex-col items-center gap-3 sm:flex-row sm:items-center"
            >
              <StatisticsMatchOutcomeDonut
                side-accent="red"
                :total="Number(p.sidesSurrenderBySide.red.total)"
                :early="Number(p.sidesSurrenderBySide.red.earlySurrenderCount)"
                :surrender-only="p.sidesRedSurrenderOnlyCount"
                :played="p.sidesRedPlayedCount"
              />
              <div class="min-w-0 space-y-1 text-xs">
                <div class="font-medium text-text">
                  Total: {{ Number(p.sidesSurrenderBySide.red.total).toLocaleString() }}
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent" />
                  &lt;15 min surrender:
                  {{ Number(p.sidesSurrenderBySide.red.earlySurrenderCount).toLocaleString() }}
                  ({{
                    p.matchOutcomePct(
                      Number(p.sidesSurrenderBySide.red.earlySurrenderCount),
                      Number(p.sidesSurrenderBySide.red.total)
                    )
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent-light" />
                  Surrender: {{ p.sidesRedSurrenderOnlyCount.toLocaleString() }} ({{
                    p.matchOutcomePct(
                      p.sidesRedSurrenderOnlyCount,
                      Number(p.sidesSurrenderBySide.red.total)
                    )
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-error" />
                  Jouees: {{ p.sidesRedPlayedCount.toLocaleString() }} ({{
                    p.matchOutcomePct(
                      p.sidesRedPlayedCount,
                      Number(p.sidesSurrenderBySide.red.total)
                    )
                  }}%)
                </div>
              </div>
            </div>
            <div v-else class="py-3 text-center text-text/60">
              {{ p.t('statisticsPage.overviewNoData') }}
            </div>
          </div>
          <StatisticsTeamSideFastStatTable
            side="blue"
            favorite-card-id="team.blueMostPicked"
            :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.fastStatsMostPicked')}`"
            :tooltip="p.t('statisticsPage.tooltipFastStatsMostPicked')"
            variant="pick"
            :rows="p.sidesBlueMostPickedRows"
            @see-more="() => p.goToChampionTableWithSort('bluePickrate')"
          />
          <StatisticsTeamSideFastStatTable
            side="red"
            favorite-card-id="team.redMostPicked"
            :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.fastStatsMostPicked')}`"
            :tooltip="p.t('statisticsPage.tooltipFastStatsMostPicked')"
            variant="pick"
            :rows="p.sidesRedMostPickedRows"
            @see-more="() => p.goToChampionTableWithSort('redPickrate')"
          />
          <StatisticsTeamSideFastStatTable
            side="blue"
            favorite-card-id="team.blueBestWinrate"
            :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.fastStatsBestWinrate')}`"
            :tooltip="p.t('statisticsPage.tooltipFastStatsBestWinrate')"
            variant="wr"
            :rows="p.sidesBlueBestWinrateRows"
            @see-more="() => p.goToChampionTableWithSort('blueWinrate')"
          />
          <StatisticsTeamSideFastStatTable
            side="red"
            favorite-card-id="team.redBestWinrate"
            :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.fastStatsBestWinrate')}`"
            :tooltip="p.t('statisticsPage.tooltipFastStatsBestWinrate')"
            variant="wr"
            :rows="p.sidesRedBestWinrateRows"
            @see-more="() => p.goToChampionTableWithSort('redWinrate')"
          />
          <StatisticsTeamSideFastStatTable
            side="blue"
            favorite-card-id="team.blueBansBySide"
            :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.sidesBansBySide')}`"
            :tooltip="p.t('statisticsPage.tooltipSidesBansBySide')"
            variant="ban"
            :rows="p.sidesBlueBanRows"
            @see-more="() => p.goToBansTab()"
          />
          <StatisticsTeamSideFastStatTable
            side="red"
            favorite-card-id="team.redBansBySide"
            :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.sidesBansBySide')}`"
            :tooltip="p.t('statisticsPage.tooltipSidesBansBySide')"
            variant="ban"
            :rows="p.sidesRedBanRows"
            @see-more="() => p.goToBansTab()"
          />
          <template v-if="p.progressionFromVersion">
            <StatisticsTeamSideFastStatTable
              side="blue"
              favorite-card-id="team.blueWinrateSince"
              :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.fastStatsWinrateSince', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsWinrateSince')"
              variant="dWr"
              :rows="p.sidesBlueTopWinrateSince"
              @see-more="() => p.goToChampionTableWithSort('blueWinrate')"
            />
            <StatisticsTeamSideFastStatTable
              side="red"
              favorite-card-id="team.redWinrateSince"
              :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.fastStatsWinrateSince', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsWinrateSince')"
              variant="dWr"
              :rows="p.sidesRedTopWinrateSince"
              @see-more="() => p.goToChampionTableWithSort('redWinrate')"
            />
            <StatisticsTeamSideFastStatTable
              side="blue"
              favorite-card-id="team.bluePickrateSince"
              :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.fastStatsPickrateSinceTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsPickrateSince')"
              variant="dPick"
              :rows="p.sidesBlueTopPickrateSince"
              @see-more="() => p.goToChampionTableWithSort('bluePickrate')"
            />
            <StatisticsTeamSideFastStatTable
              side="red"
              favorite-card-id="team.redPickrateSince"
              :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.fastStatsPickrateSinceTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsPickrateSince')"
              variant="dPick"
              :rows="p.sidesRedTopPickrateSince"
              @see-more="() => p.goToChampionTableWithSort('redPickrate')"
            />
            <StatisticsTeamSideFastStatTable
              side="blue"
              favorite-card-id="team.blueBanrateSince"
              :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.fastStatsBanrateSinceTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsBanrateSince')"
              variant="dBan"
              :rows="p.sidesBlueTopBanrateSince"
              @see-more="() => p.goToBansTab()"
            />
            <StatisticsTeamSideFastStatTable
              side="red"
              favorite-card-id="team.redBanrateSince"
              :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.fastStatsBanrateSinceTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsBanrateSince')"
              variant="dBan"
              :rows="p.sidesRedTopBanrateSince"
              @see-more="() => p.goToBansTab()"
            />
            <StatisticsTeamSideFastStatTable
              side="blue"
              favorite-card-id="team.blueWinrateSinceDown"
              :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.fastStatsWinrateSinceDownTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsWinrateSinceDown')"
              variant="dWr"
              :rows="p.sidesBlueBottomWinrateSince"
              @see-more="() => p.goToChampionTableWithSort('blueWinrate', 'asc')"
            />
            <StatisticsTeamSideFastStatTable
              side="red"
              favorite-card-id="team.redWinrateSinceDown"
              :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.fastStatsWinrateSinceDownTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsWinrateSinceDown')"
              variant="dWr"
              :rows="p.sidesRedBottomWinrateSince"
              @see-more="() => p.goToChampionTableWithSort('redWinrate', 'asc')"
            />
            <StatisticsTeamSideFastStatTable
              side="blue"
              favorite-card-id="team.bluePickrateSinceDown"
              :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.fastStatsPickrateSinceDownTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsPickrateSinceDown')"
              variant="dPick"
              :rows="p.sidesBlueBottomPickrateSince"
              @see-more="() => p.goToChampionTableWithSort('bluePickrate', 'asc')"
            />
            <StatisticsTeamSideFastStatTable
              side="red"
              favorite-card-id="team.redPickrateSinceDown"
              :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.fastStatsPickrateSinceDownTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsPickrateSinceDown')"
              variant="dPick"
              :rows="p.sidesRedBottomPickrateSince"
              @see-more="() => p.goToChampionTableWithSort('redPickrate', 'asc')"
            />
            <StatisticsTeamSideFastStatTable
              side="blue"
              favorite-card-id="team.blueBanrateSinceDown"
              :title="`${p.t('statisticsPage.sidesBlue')} — ${p.t('statisticsPage.fastStatsBanrateSinceDownTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsBanrateSinceDown')"
              variant="dBan"
              :rows="p.sidesBlueBottomBanrateSince"
              @see-more="() => p.goToBansTab()"
            />
            <StatisticsTeamSideFastStatTable
              side="red"
              favorite-card-id="team.redBanrateSinceDown"
              :title="`${p.t('statisticsPage.sidesRed')} — ${p.t('statisticsPage.fastStatsBanrateSinceDownTitle', { version: p.progressionFromVersion })}`"
              :tooltip="p.t('statisticsPage.tooltipFastStatsBanrateSinceDown')"
              variant="dBan"
              :rows="p.sidesRedBottomBanrateSince"
              @see-more="() => p.goToBansTab()"
            />
          </template>
        </div>
      </div>
      <div v-else class="statistics-empty-panel p-4">
        {{ p.t('statisticsPage.overviewNoData') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.sides-split {
  width: 100%;
  min-width: 220px;
}
.sides-split-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 1.35rem;
  font-weight: 600;
}
.sides-split-blue {
  color: var(--color-blue-100, #0ac8b9);
}
.sides-split-red {
  color: #e2665a;
}
.sides-split-bar {
  display: flex;
  height: 12px;
  overflow: hidden;
  border-radius: 999px;
  background: rgb(30 35 40 / 0.8);
}
.sides-split-fill-blue {
  background: var(--color-blue-100, #0ac8b9);
}
.sides-split-fill-red {
  background: #e2665a;
}
</style>

<style scoped>
.tm-wrap {
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: Inter, system-ui, sans-serif;
  color: #f0e6d2;
}
.tm-h2 {
  font-size: 20px;
  font-weight: 600;
  color: #f0e6d2;
}
.tm-card {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  padding: 20px 24px;
}
.tm-split-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}
.tm-right {
  text-align: right;
}
.tm-split-mid {
  font-size: 12px;
  color: #a09b8c;
}
.tm-side-label {
  font-size: 12px;
  font-weight: 600;
}
.is-blue {
  color: #0ac8b9;
}
.is-red {
  color: #e2665a;
}
.tm-big {
  font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.1;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.tm-split-bar {
  display: flex;
  gap: 2px;
  height: 10px;
  margin: 10px 0 16px;
  overflow: hidden;
  border-radius: 999px;
  background: #1e2328;
}
.tm-fill-blue {
  background: #0ac8b9;
}
.tm-fill-red {
  background: #e2665a;
}
.tm-facts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.tm-fact-label {
  font-size: 12px;
  color: #a09b8c;
  margin-bottom: 2px;
}
.tm-fact {
  font-size: 13px;
  color: #f0e6d2;
}
.tm-fact .is-blue,
.tm-fact .is-red {
  font-weight: 600;
}
.tm-link {
  color: #c8aa6e;
  text-decoration: underline;
}
.tm-card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}
.tm-card-title {
  font-size: 15px;
  font-weight: 600;
}
.tm-card-sub {
  font-size: 12px;
  color: #a09b8c;
}
.tm-cols {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 32px;
}
.tm-col-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.tm-bars {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tm-bar-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr) 120px 56px;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.tm-thumb {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: #0a323c;
}
.tm-bar-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  color: #f0e6d2;
}
.tm-track {
  height: 4px;
  border-radius: 999px;
  background: #1e2328;
  overflow: hidden;
}
.tm-fill {
  height: 100%;
  border-radius: 999px;
}
.tm-bar-val {
  text-align: right;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.tm-mfacts,
.tm-mseg {
  display: none;
}
.tm-empty {
  font-size: 13px;
  color: #a09b8c;
}
@media (max-width: 767px) {
  .tm-card {
    padding: 16px;
  }
  .tm-facts,
  .tm-cols {
    grid-template-columns: 1fr;
  }
  .tm-h2,
  .tm-facts,
  .tm-card-sub,
  .tm-col-title,
  .is-moff {
    display: none !important;
  }
  .tm-mfacts {
    display: block;
    font-size: 13px;
    line-height: 1.45;
    color: #f0e6d2;
  }
  .tm-mfacts .is-blue,
  .tm-mfacts .is-red {
    font-weight: 600;
  }
  .tm-card-head {
    align-items: center;
  }
  .tm-mseg {
    display: inline-flex;
    padding: 3px;
    border: 1px solid #463714;
    border-radius: 8px;
    background: #010a13;
  }
  .tm-mseg button {
    padding: 4px 12px;
    border-radius: 6px;
    font-size: 13px;
    color: #a09b8c;
  }
  .tm-mseg button.is-on {
    background: #0a323c;
    color: #0ac8b9;
  }
  .tm-bar-row {
    grid-template-columns: 28px minmax(0, 1fr) 56px;
    grid-template-areas:
      'thumb name val'
      'thumb track val';
    row-gap: 4px;
  }
  .tm-thumb {
    grid-area: thumb;
    width: 28px;
    height: 28px;
  }
  .tm-bar-name {
    grid-area: name;
  }
  .tm-track {
    grid-area: track;
  }
  .tm-bar-val {
    grid-area: val;
  }
}
</style>
