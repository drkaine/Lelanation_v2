<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg">
      <div v-if="p.overviewSidesPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div v-else-if="p.overviewSidesData" class="space-y-[10px]">
        <div class="flex flex-wrap items-start justify-center gap-x-[5px] gap-y-[10px] pb-[10px]">
          <div
            class="fast-stat-card flex w-full max-w-full flex-col items-center rounded-lg border border-primary/30 bg-surface/30 p-2"
          >
            <h3
              class="fast-stat-title mb-2 flex w-full items-center gap-2 text-sm font-semibold lg:text-left"
            >
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('team.sideWinrateDonut')
                    ? 'text-amber-300 hover:text-amber-200'
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
              class="pie-chart-2 relative inline-flex h-[150px] w-[150px] shrink-0 items-center justify-center"
            >
              <svg class="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="14"
                  stroke-linecap="butt"
                  class="text-surface/50 dark:text-surface/40"
                  :stroke-dasharray="p.sidesDonutCircumference + ' ' + p.sidesDonutCircumference"
                  stroke-dashoffset="0"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="14"
                  stroke-linecap="butt"
                  class="text-sky-500 dark:text-sky-400"
                  :stroke-dasharray="p.sidesDonutBlueDash + ' ' + p.sidesDonutCircumference"
                  stroke-dashoffset="0"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="14"
                  stroke-linecap="butt"
                  class="text-rose-500 dark:text-rose-400"
                  :stroke-dasharray="p.sidesDonutRedDash + ' ' + p.sidesDonutCircumference"
                  :stroke-dashoffset="-p.sidesDonutBlueDash"
                />
              </svg>
              <div class="relative z-10 flex flex-col items-center text-center">
                <span class="block text-xl font-bold text-sky-600 dark:text-sky-300">
                  {{ p.sidesDonutBluePct }}%
                </span>
                <span class="block text-lg font-medium text-rose-600 dark:text-rose-300">
                  {{ p.sidesDonutRedPct }}%
                </span>
              </div>
            </div>
            <div class="mt-2 w-full text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('totalGames')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>
          <div
            class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
          >
            <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('team.blueMatchOutcome')
                    ? 'text-amber-300 hover:text-amber-200'
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
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300" />
                  Early surrender:
                  {{ Number(p.sidesSurrenderBySide.blue.earlySurrenderCount).toLocaleString() }}
                  ({{
                    p.matchOutcomePct(
                      Number(p.sidesSurrenderBySide.blue.earlySurrenderCount),
                      Number(p.sidesSurrenderBySide.blue.total)
                    )
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-100" />
                  Surrender: {{ p.sidesBlueSurrenderOnlyCount.toLocaleString() }} ({{
                    p.matchOutcomePct(
                      p.sidesBlueSurrenderOnlyCount,
                      Number(p.sidesSurrenderBySide.blue.total)
                    )
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span
                    class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-sky-400 dark:bg-sky-500"
                  />
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
            <div v-if="Number(p.sidesSurrenderBySide.blue.total) > 0" class="mt-2 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('blueWinrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
            </div>
          </div>
          <div
            class="fast-stat-card w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-2"
          >
            <h3 class="fast-stat-title mb-2 flex items-center gap-2 text-sm font-semibold">
              <button
                type="button"
                class="shrink-0 text-base leading-none transition-colors"
                :class="
                  p.cardIsFavorite('team.redMatchOutcome')
                    ? 'text-amber-300 hover:text-amber-200'
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
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-300" />
                  Early surrender:
                  {{ Number(p.sidesSurrenderBySide.red.earlySurrenderCount).toLocaleString() }}
                  ({{
                    p.matchOutcomePct(
                      Number(p.sidesSurrenderBySide.red.earlySurrenderCount),
                      Number(p.sidesSurrenderBySide.red.total)
                    )
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-amber-100" />
                  Surrender: {{ p.sidesRedSurrenderOnlyCount.toLocaleString() }} ({{
                    p.matchOutcomePct(
                      p.sidesRedSurrenderOnlyCount,
                      Number(p.sidesSurrenderBySide.red.total)
                    )
                  }}%)
                </div>
                <div class="flex items-center gap-2 text-text/85">
                  <span
                    class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-rose-400 dark:bg-rose-500"
                  />
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
            <div v-if="Number(p.sidesSurrenderBySide.red.total) > 0" class="mt-2 text-center">
              <button
                type="button"
                class="fast-stat-button rounded bg-accent px-2 py-1 text-xs font-medium text-background transition-colors hover:opacity-90"
                @click="p.goToChampionTableWithSort('redWinrate')"
              >
                {{ p.t('statisticsPage.fastStatsSeeMore') }}
              </button>
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
          </template>
        </div>

        <div
          v-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0"
          class="fast-stat-card fast-stat-card-objectives w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
        >
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="shrink-0 text-base leading-none transition-colors"
              :class="
                p.cardIsFavorite('team.objectives')
                  ? 'text-amber-300 hover:text-amber-200'
                  : 'text-text/45 grayscale hover:text-text/75'
              "
              :title="
                p.cardIsFavorite('team.objectives') ? 'Retirer des favoris' : 'Ajouter aux favoris'
              "
              @click="
                p.toggleFavoriteCard(
                  'team.objectives',
                  `${p.t('statisticsPage.tabTeam')} — ${p.t('statisticsPage.sidesObjectivesBySide')}`
                )
              "
            >
              {{ p.cardIsFavorite('team.objectives') ? '★' : '☆' }}
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-semibold transition-colors"
              :class="
                p.objectivesSidesPanelTab === 'objectives'
                  ? 'bg-accent text-background'
                  : 'bg-black/20 text-text/80 hover:bg-white/10'
              "
              @click="p.objectivesSidesPanelTab = 'objectives'"
            >
              {{ p.t('statisticsPage.objectivesTabMain') }}
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-semibold transition-colors"
              :class="
                p.objectivesSidesPanelTab === 'drakeTypes'
                  ? 'bg-accent text-background'
                  : 'bg-black/20 text-text/80 hover:bg-white/10'
              "
              @click="p.objectivesSidesPanelTab = 'drakeTypes'"
            >
              {{ p.t('statisticsPage.objectivesTabDrakeTypes') }}
            </button>
            <button
              type="button"
              class="rounded px-2 py-1 text-xs font-semibold transition-colors"
              :class="
                p.objectivesSidesPanelTab === 'drakeSouls'
                  ? 'bg-accent text-background'
                  : 'bg-black/20 text-text/80 hover:bg-white/10'
              "
              @click="p.objectivesSidesPanelTab = 'drakeSouls'"
            >
              {{ p.t('statisticsPage.objectivesTabSouls') }}
            </button>
            <span
              class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
              :aria-label="p.t('statisticsPage.tooltipSidesObjectives')"
            >
              ⓘ
              <span
                role="tooltip"
                class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
              >
                {{ p.t('statisticsPage.tooltipSidesObjectives') }}
              </span>
            </span>
          </div>
          <div
            v-if="p.objectivesSidesPanelTab === 'objectives'"
            class="w-full min-w-0 overflow-x-auto"
          >
            <table class="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ p.t('statisticsPage.overviewTeamsObjective') }}
                  </th>
                  <th class="py-1.5 pr-2 text-center font-medium text-blue-600 dark:text-blue-400">
                    {{ p.t('statisticsPage.sidesBlue') }}
                  </th>
                  <th class="py-1.5 text-center font-medium text-red-600 dark:text-red-400">
                    {{ p.t('statisticsPage.sidesRed') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr>
                  <td class="py-1.5 pr-2">
                    {{ p.t('statisticsPage.overviewTeamsFirstBlood') }}
                  </td>
                  <td class="py-1.5 pr-2 text-center">
                    {{
                      p.firstPercentBySide(
                        p.overviewSidesData.objectivesBySideTable?.firstBlood?.firstByBlue ?? 0,
                        p.overviewSidesData.objectivesBySideTable?.firstBlood?.firstByRed ?? 0,
                        p.overviewSidesData.matchCount
                      ).blue
                    }}
                  </td>
                  <td class="py-1.5 text-center">
                    {{
                      p.firstPercentBySide(
                        p.overviewSidesData.objectivesBySideTable?.firstBlood?.firstByBlue ?? 0,
                        p.overviewSidesData.objectivesBySideTable?.firstBlood?.firstByRed ?? 0,
                        p.overviewSidesData.matchCount
                      ).red
                    }}
                  </td>
                </tr>
                <template v-for="key in p.sidesObjectiveKeysWithKills" :key="key">
                  <tr>
                    <td class="py-1.5 pr-2">
                      <button
                        type="button"
                        class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                        @click="p.toggleSidesObjective(key)"
                      >
                        <span
                          class="inline-block transition-transform duration-200"
                          :class="p.openSidesObjectiveKeys.has(key) ? 'rotate-180' : ''"
                          aria-hidden
                          >▼</span
                        >
                        <img
                          v-if="p.objectiveIconSrc(key)"
                          :src="p.objectiveIconSrc(key)"
                          :alt="p.t('statisticsPage.overviewTeamsObjective_' + key)"
                          class="h-4 w-4 object-contain"
                          loading="lazy"
                          decoding="async"
                          @error="p.onObjectiveIconError($event, key)"
                        />
                        {{ p.t('statisticsPage.overviewTeamsObjective_' + key) }}
                      </button>
                    </td>
                    <td class="py-1.5 pr-2 text-center">
                      {{
                        p.firstPercentBySide(
                          p.objectiveRowSides(key).firstByBlue,
                          p.objectiveRowSides(key).firstByRed,
                          p.overviewSidesData.matchCount
                        ).blue
                      }}
                    </td>
                    <td class="py-1.5 text-center">
                      {{
                        p.firstPercentBySide(
                          p.objectiveRowSides(key).firstByBlue,
                          p.objectiveRowSides(key).firstByRed,
                          p.overviewSidesData.matchCount
                        ).red
                      }}
                    </td>
                  </tr>
                  <template v-if="p.openSidesObjectiveKeys.has(key)">
                    <tr
                      v-for="count in p.sidesObjectiveCounts(key)"
                      :key="key + '-' + count"
                      class="bg-surface/30"
                    >
                      <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                      <td class="py-1 pr-2 text-center text-text/80">
                        {{ p.percentForCountSides(key, count, true) }}
                      </td>
                      <td class="py-1 text-center text-text/80">
                        {{ p.percentForCountSides(key, count, false) }}
                      </td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>
          </div>
          <div
            v-else-if="p.objectivesSidesPanelTab === 'drakeTypes'"
            class="w-full min-w-0 overflow-x-auto"
          >
            <table class="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ p.t('statisticsPage.overviewTeamsObjective') }}
                  </th>
                  <th class="py-1.5 pr-2 text-center font-medium text-blue-600 dark:text-blue-400">
                    {{ p.t('statisticsPage.sidesBlue') }}
                  </th>
                  <th class="py-1.5 text-center font-medium text-red-600 dark:text-red-400">
                    {{ p.t('statisticsPage.sidesRed') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr v-for="row in p.sidesDrakeTypeRows" :key="'sdt-' + row.key">
                  <td class="py-1.5 pr-2 font-medium text-text/90">
                    <div class="flex items-center gap-2">
                      <img
                        v-if="p.drakeIconSrc(row.key)"
                        :src="p.drakeIconSrc(row.key)"
                        :alt="row.label"
                        class="h-4 w-4 object-contain"
                        loading="lazy"
                        decoding="async"
                        @error="p.onDrakeIconError($event, row.key)"
                      />
                      <span>{{ row.label }}</span>
                    </div>
                  </td>
                  <td class="py-1.5 pr-2 text-center">
                    {{ p.teamPercent(row.byBlue, p.overviewSidesData.matchCount) }}
                  </td>
                  <td class="py-1.5 text-center">
                    {{ p.teamPercent(row.byRed, p.overviewSidesData.matchCount) }}
                  </td>
                </tr>
                <tr v-if="p.sidesDrakeTypeRows.length === 0">
                  <td colspan="3" class="py-2 text-center text-text/60">
                    {{ p.t('statisticsPage.noData') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="w-full min-w-0 overflow-x-auto">
            <table class="w-full min-w-[280px] text-left text-sm">
              <thead>
                <tr class="border-b border-primary/30 text-text/70">
                  <th class="py-1.5 pr-2 font-medium">
                    {{ p.t('statisticsPage.overviewTeamsObjective') }}
                  </th>
                  <th class="py-1.5 pr-2 text-center font-medium text-blue-600 dark:text-blue-400">
                    {{ p.t('statisticsPage.sidesBlue') }}
                  </th>
                  <th class="py-1.5 text-center font-medium text-red-600 dark:text-red-400">
                    {{ p.t('statisticsPage.sidesRed') }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-primary/20 text-text/80">
                <tr>
                  <td class="py-1.5 pr-2 font-medium text-text/90">
                    {{ p.t('statisticsPage.objectivesSoulGlobal') }}
                  </td>
                  <td class="py-1.5 pr-2 text-center">
                    {{
                      p.teamPercent(p.sidesDrakeSoulGlobal.byBlue, p.overviewSidesData.matchCount)
                    }}
                  </td>
                  <td class="py-1.5 text-center">
                    {{
                      p.teamPercent(p.sidesDrakeSoulGlobal.byRed, p.overviewSidesData.matchCount)
                    }}
                  </td>
                </tr>
                <template v-for="row in p.sidesDrakeSoulRows" :key="'sds-' + row.key">
                  <tr>
                    <td class="py-1.5 pr-2 font-medium text-text/90">
                      <div class="flex items-center gap-2">
                        <img
                          v-if="p.drakeIconSrc(row.key)"
                          :src="p.drakeIconSrc(row.key)"
                          :alt="row.label"
                          class="h-4 w-4 object-contain"
                          loading="lazy"
                          decoding="async"
                          @error="p.onDrakeIconError($event, row.key)"
                        />
                        <span>{{ row.label }}</span>
                      </div>
                    </td>
                    <td class="py-1.5 pr-2 text-center">
                      {{ p.teamPercent(row.byBlue, p.overviewSidesData.matchCount) }}
                    </td>
                    <td class="py-1.5 text-center">
                      {{ p.teamPercent(row.byRed, p.overviewSidesData.matchCount) }}
                    </td>
                  </tr>
                </template>
                <tr v-if="p.sidesDrakeSoulRows.length === 0">
                  <td colspan="3" class="py-2 text-center text-text/60">
                    {{ p.t('statisticsPage.noData') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <div v-else class="rounded border border-primary/30 bg-surface/50 p-4 text-text/70">
        {{ p.t('statisticsPage.overviewNoData') }}
      </div>
    </div>
  </div>
</template>
