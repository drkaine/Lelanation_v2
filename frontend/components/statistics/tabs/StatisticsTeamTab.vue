<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  injectStatisticsPageCtx,
  type StatisticsIndexPageCtx,
} from '~/composables/statistics/statisticsPageCtx'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useGameVersion } from '~/composables/useGameVersion'
import { getChampionImageUrl } from '~/utils/imageUrl'
import { donutArcs, sideRatePct, sideWinrateBarPct } from '~/utils/statistics/teamSides'

const p = injectStatisticsPageCtx<StatisticsIndexPageCtx>()
const championsStore = useChampionsStore()
const { locale } = useI18n()
const { version: gameVersion } = useGameVersion()

/** Mobile : un seul côté affiché pour « meilleur winrate ». */
const mobileSide = ref<'blue' | 'red'>('blue')

function champ(id: unknown) {
  return championsStore.champions.find(c => c.key === String(id)) ?? null
}
function champIcon(id: unknown): string | null {
  const c = champ(id)
  return c && gameVersion.value ? getChampionImageUrl(gameVersion.value, c.image.full) : null
}
const fmtPct = (v: number) =>
  `${Number(v).toLocaleString(locale.value, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`
const fmtPct1 = (v: number) =>
  `${Number(v).toLocaleString(locale.value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`

const sideRates = computed(() => {
  const s = p.sidesSurrenderBySide
  return {
    blueSurr: sideRatePct(s.blue.surrenderCount, s.blue.total),
    redSurr: sideRatePct(s.red.surrenderCount, s.red.total),
    blueEarly: sideRatePct(s.blue.earlySurrenderCount, s.blue.total),
    redEarly: sideRatePct(s.red.earlySurrenderCount, s.red.total),
  }
})
const DONUT_R = 48
const DONUT_C = 2 * Math.PI * DONUT_R
const sideDonut = computed(() =>
  donutArcs([Number(p.sidesDonutBluePct) || 0, Number(p.sidesDonutRedPct) || 0], DONUT_C)
)
const bestSides = computed(() => [
  {
    side: 'blue' as const,
    label: 'statisticsPage.teamBlue',
    rows: p.sidesBlueBestWinrateRows.slice(0, 5),
  },
  {
    side: 'red' as const,
    label: 'statisticsPage.teamRed',
    rows: p.sidesRedBestWinrateRows.slice(0, 5),
  },
])
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg">
      <div v-if="p.overviewSidesPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div v-else-if="p.overviewSidesData" class="team-wrap">
        <section class="team-card">
          <div class="team-hero">
            <div class="team-hero-side">
              <span class="team-hero-label is-blue">{{ p.t('statisticsPage.teamSideBlue') }}</span>
              <span class="team-hero-val">{{ fmtPct(Number(p.sidesDonutBluePct)) }}</span>
            </div>
            <span class="team-hero-mid">{{ p.t('statisticsPage.teamWinrateSoloDuo') }}</span>
            <div class="team-hero-side is-right">
              <span class="team-hero-label is-red">{{ p.t('statisticsPage.teamSideRed') }}</span>
              <span class="team-hero-val">{{ fmtPct(Number(p.sidesDonutRedPct)) }}</span>
            </div>
          </div>
          <div class="team-split" aria-hidden="true">
            <span
              class="team-split-blue"
              :style="{ width: `${Number(p.sidesDonutBluePct) || 0}%` }"
            />
            <span class="team-split-red" />
          </div>
          <div class="team-facts">
            <div class="team-fact">
              <span class="team-fact-k">{{ p.t('statisticsPage.teamSurrenders') }}</span>
              <span class="team-fact-v">
                {{ p.t('statisticsPage.teamBlueLower') }}
                <b class="is-blue">{{ fmtPct1(sideRates.blueSurr) }}</b> ·
                {{ p.t('statisticsPage.teamRedLower') }}
                <b class="is-red">{{ fmtPct1(sideRates.redSurr) }}</b>
              </span>
            </div>
            <div class="team-fact">
              <span class="team-fact-k">{{ p.t('statisticsPage.teamSurrendersEarly') }}</span>
              <span class="team-fact-v">
                {{ p.t('statisticsPage.teamBlueLower') }}
                <b class="is-blue">{{ fmtPct1(sideRates.blueEarly) }}</b> ·
                {{ p.t('statisticsPage.teamRedLower') }}
                <b class="is-red">{{ fmtPct1(sideRates.redEarly) }}</b>
              </span>
            </div>
            <div class="team-fact">
              <span class="team-fact-k">{{ p.t('statisticsPage.teamPicksBans') }}</span>
              <span class="team-fact-v">{{ p.t('statisticsPage.teamPicksBansSame') }}</span>
            </div>
          </div>
        </section>

        <section class="team-card">
          <div class="team-card-head">
            <h3 class="team-card-title">{{ p.t('statisticsPage.teamBestWrBySide') }}</h3>
            <span class="team-card-hint">{{ p.t('statisticsPage.teamBestWrHint') }}</span>
            <div class="team-seg" role="tablist">
              <button
                v-for="s in bestSides"
                :key="s.side"
                type="button"
                role="tab"
                :aria-selected="mobileSide === s.side"
                :class="{ 'is-on': mobileSide === s.side }"
                @click="mobileSide = s.side"
              >
                {{ p.t(s.label) }}
              </button>
            </div>
          </div>
          <div class="team-bw">
            <div
              v-for="s in bestSides"
              :key="s.side"
              class="team-bw-col"
              :class="{ 'is-off-m': mobileSide !== s.side }"
            >
              <span class="team-bw-side" :class="`is-${s.side}`">{{ p.t(s.label) }}</span>
              <div v-for="r in s.rows" :key="r.championId" class="team-bw-row">
                <img
                  v-if="champIcon(r.championId)"
                  :src="champIcon(r.championId)!"
                  :alt="champ(r.championId)?.name ?? ''"
                  class="team-bw-icon"
                  loading="lazy"
                />
                <span v-else class="team-bw-icon" />
                <span class="team-bw-name">{{ champ(r.championId)?.name ?? r.championId }}</span>
                <span class="team-bw-bar" aria-hidden="true">
                  <span
                    :class="`is-${s.side}`"
                    :style="{ width: `${sideWinrateBarPct(Number(r.winrate))}%` }"
                  />
                </span>
                <span class="team-bw-val">{{ fmtPct(Number(r.winrate)) }}</span>
              </div>
            </div>
          </div>
        </section>

        <details class="team-detail">
          <summary>{{ p.t('statisticsPage.teamSeeDetail') }}</summary>
          <div class="space-y-[10px] pt-4">
            <div
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
                  class="sides-donut-wrap"
                  role="img"
                  :aria-label="`${p.t('statisticsPage.sidesBlue')} ${p.sidesDonutBluePct}% · ${p.t('statisticsPage.sidesRed')} ${p.sidesDonutRedPct}%`"
                >
                  <div class="sides-donut">
                    <svg viewBox="0 0 120 120" class="sides-donut-svg" aria-hidden="true">
                      <circle
                        cx="60"
                        cy="60"
                        :r="DONUT_R"
                        fill="none"
                        stroke="rgba(148,163,184,0.18)"
                        stroke-width="14"
                      />
                      <circle
                        v-for="(seg, i) in sideDonut"
                        :key="i"
                        cx="60"
                        cy="60"
                        :r="DONUT_R"
                        fill="none"
                        :stroke="i === 0 ? '#0397ab' : '#e2665a'"
                        stroke-width="14"
                        :stroke-dasharray="`${seg.arc} ${DONUT_C - seg.arc}`"
                        :stroke-dashoffset="`-${seg.offset}`"
                      />
                    </svg>
                    <span class="sides-donut-center">{{ p.sidesDonutBluePct }}%</span>
                  </div>
                  <ul class="sides-donut-legend">
                    <li>
                      <i class="is-blue-dot" />{{ p.t('statisticsPage.sidesBlue') }}
                      <b>{{ p.sidesDonutBluePct }}%</b>
                    </li>
                    <li>
                      <i class="is-red-dot" />{{ p.t('statisticsPage.sidesRed') }}
                      <b>{{ p.sidesDonutRedPct }}%</b>
                    </li>
                  </ul>
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
                      <span
                        class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent-light"
                      />
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
                      <span
                        class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-accent-light"
                      />
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
        </details>
      </div>
      <div v-else class="statistics-empty-panel p-4">
        {{ p.t('statisticsPage.overviewNoData') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.sides-donut-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}
.sides-donut {
  position: relative;
  width: 112px;
  height: 112px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.sides-donut-svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}
.sides-donut-center {
  position: relative;
  font-size: 18px;
  font-weight: 600;
  color: #0397ab;
}
.sides-donut-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #f0e6d2;
}
.sides-donut-legend li {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sides-donut-legend b {
  margin-left: auto;
  padding-left: 12px;
  font-weight: 600;
}
.sides-donut-legend i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}
.is-blue-dot {
  background: #0397ab;
}
.is-red-dot {
  background: #e2665a;
}
@media (min-width: 640px) {
  .sides-donut-wrap {
    flex-direction: row;
    justify-content: center;
    gap: 20px;
  }
  .sides-donut {
    width: 132px;
    height: 132px;
  }
}
@media (min-width: 1024px) {
  .sides-donut {
    width: 150px;
    height: 150px;
  }
  .sides-donut-center {
    font-size: 20px;
  }
}

.team-wrap {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.team-card {
  background: #0a1428;
  border: 1px solid #463714;
  border-radius: 12px;
  padding: 16px;
}
.team-hero {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.team-hero-side {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.team-hero-side.is-right {
  align-items: flex-end;
}
.team-hero-label {
  font-size: 13px;
  font-weight: 600;
}
.is-blue {
  color: #0397ab;
}
.is-red {
  color: #e2665a;
}
.team-hero-val {
  font-family: 'Barlow Condensed', sans-serif;
  font-weight: 700;
  font-size: 28px;
  white-space: nowrap;
  line-height: 1;
  color: #f0e6d2;
}
.team-hero-mid {
  font-size: 13px;
  color: #a09b8c;
  padding-bottom: 6px;
}
.team-split {
  display: flex;
  gap: 2px;
  height: 12px;
  margin-top: 14px;
}
.team-split > span {
  border-radius: 6px;
  height: 100%;
}
.team-split-blue {
  background: #0397ab;
}
.team-split-red {
  background: #e2665a;
  flex: 1;
}
.team-facts {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid #1e2328;
}
.team-fact {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.team-fact-k {
  font-size: 12px;
  color: #a09b8c;
}
.team-fact-v {
  font-size: 14px;
  color: #f0e6d2;
}
.team-fact-v b {
  font-weight: 600;
}
.team-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 14px;
}
.team-card-title {
  font-size: 16px;
  font-weight: 600;
  color: #f0e6d2;
}
.team-card-hint {
  display: none;
  font-size: 13px;
  color: #a09b8c;
}
.team-seg {
  display: inline-flex;
  padding: 3px;
  border: 1px solid #0a323c;
  border-radius: 8px;
}
.team-seg button {
  height: 30px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 13px;
  color: #a09b8c;
}
.team-seg button.is-on {
  background: #0a323c;
  color: #0397ab;
}
.team-bw {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
}
.team-bw-col.is-off-m {
  display: none;
}
.team-bw-side {
  display: block;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}
.team-bw-row {
  display: grid;
  grid-template-columns: 28px 1fr 56px;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.team-bw-icon {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: #0a323c;
  object-fit: cover;
}
.team-bw-name {
  font-size: 14px;
  color: #f0e6d2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-bw-bar {
  grid-column: 2;
  grid-row: 2;
  height: 6px;
  border-radius: 3px;
  background: #1e2328;
  overflow: hidden;
}
.team-bw-bar > span {
  display: block;
  height: 100%;
  border-radius: 3px;
}
.team-bw-bar > .is-blue {
  background: #0397ab;
}
.team-bw-bar > .is-red {
  background: #e2665a;
}
.team-bw-val {
  grid-column: 3;
  grid-row: 1 / span 2;
  text-align: right;
  font-size: 14px;
  color: #f0e6d2;
  font-variant-numeric: tabular-nums;
}
.team-detail > summary {
  cursor: pointer;
  font-size: 13px;
  color: #c8aa6e;
  padding: 4px 0;
}
@media (min-width: 768px) {
  .team-card {
    padding: 20px 24px;
  }
  .team-hero-val {
    font-size: 36px;
  }
  .team-seg {
    display: none;
  }
  .team-facts {
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
  }
  .team-card-hint {
    display: inline;
  }
  .team-bw {
    grid-template-columns: 1fr 1fr;
    gap: 40px;
  }
  .team-bw-col.is-off-m {
    display: block;
  }
  .team-bw-row {
    grid-template-columns: 28px 1fr 140px 56px;
  }
  .team-bw-bar {
    grid-column: 3;
    grid-row: 1;
  }
  .team-bw-val {
    grid-column: 4;
    grid-row: 1;
  }
}
</style>
