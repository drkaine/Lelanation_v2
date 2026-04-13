<script setup lang="ts">
import { inject } from 'vue'

const p = inject('statisticsPageCtx') as any
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-3">
      <h2 class="text-base font-semibold text-text">
        {{ p.t('statisticsPage.objectivesSectionOverview') }}
      </h2>
      <p class="text-xs text-text/65">
        {{ p.t('statisticsPage.overviewTeamsFirstByTeam') }}
      </p>
      <div v-if="p.overviewTeamsPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div
        v-else-if="p.overviewTeamsData && p.overviewTeamsData.matchCount > 0"
        class="fast-stat-card fast-stat-card-objectives w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
      >
        <div class="mb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="shrink-0 text-base leading-none transition-colors"
            :class="
              p.cardIsFavorite('overview.objectives')
                ? 'text-amber-300 hover:text-amber-200'
                : 'text-text/45 grayscale hover:text-text/75'
            "
            :title="
              p.cardIsFavorite('overview.objectives')
                ? 'Retirer des favoris'
                : 'Ajouter aux favoris'
            "
            @click="
              p.toggleFavoriteCard(
                'overview.objectives',
                p.t('statisticsPage.overviewTeamsObjectives')
              )
            "
          >
            {{ p.cardIsFavorite('overview.objectives') ? '★' : '☆' }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs font-semibold transition-colors"
            :class="
              p.objectivesPanelTab === 'objectives'
                ? 'bg-accent text-background'
                : 'bg-black/20 text-text/80 hover:bg-white/10'
            "
            @click="p.objectivesPanelTab = 'objectives'"
          >
            {{ p.t('statisticsPage.objectivesTabMain') }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs font-semibold transition-colors"
            :class="
              p.objectivesPanelTab === 'drakeTypes'
                ? 'bg-accent text-background'
                : 'bg-black/20 text-text/80 hover:bg-white/10'
            "
            @click="p.objectivesPanelTab = 'drakeTypes'"
          >
            {{ p.t('statisticsPage.objectivesTabDrakeTypes') }}
          </button>
          <button
            type="button"
            class="rounded px-2 py-1 text-xs font-semibold transition-colors"
            :class="
              p.objectivesPanelTab === 'drakeSouls'
                ? 'bg-accent text-background'
                : 'bg-black/20 text-text/80 hover:bg-white/10'
            "
            @click="p.objectivesPanelTab = 'drakeSouls'"
          >
            {{ p.t('statisticsPage.objectivesTabSouls') }}
          </button>
          <span
            class="group/stat-tip relative inline-flex shrink-0 cursor-help text-text/50"
            :aria-label="p.t('statisticsPage.tooltipOverviewObjectives')"
          >
            ⓘ
            <span
              role="tooltip"
              class="fast-stat-tooltip-popover hidden group-hover/stat-tip:block"
            >
              {{ p.t('statisticsPage.tooltipOverviewObjectives') }}
            </span>
          </span>
        </div>
        <div v-if="p.objectivesPanelTab === 'objectives'" class="w-full min-w-0 overflow-x-auto">
          <table class="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr class="border-b border-primary/30 text-text/70">
                <th class="py-1.5 pr-2 font-medium">
                  {{ p.t('statisticsPage.overviewTeamsObjective') }}
                </th>
                <th class="py-1.5 pr-2 text-center font-medium">
                  {{ p.t('statisticsPage.overviewTeamsFirstByWin') }}
                </th>
                <th class="py-1.5 text-center font-medium">
                  {{ p.t('statisticsPage.overviewTeamsFirstByLoss') }}
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
                    p.firstPercentByTeam(
                      p.overviewTeamsData.objectives.firstBlood.firstByWin,
                      p.overviewTeamsData.objectives.firstBlood.firstByLoss,
                      p.overviewTeamsData.matchCount
                    ).win
                  }}
                </td>
                <td class="py-1.5 text-center">
                  {{
                    p.firstPercentByTeam(
                      p.overviewTeamsData.objectives.firstBlood.firstByWin,
                      p.overviewTeamsData.objectives.firstBlood.firstByLoss,
                      p.overviewTeamsData.matchCount
                    ).loss
                  }}
                </td>
              </tr>
              <template v-for="key in p.objectiveKeysWithKills" :key="key">
                <tr>
                  <td class="py-1.5 pr-2">
                    <button
                      type="button"
                      class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                      @click="p.toggleObjective(key)"
                    >
                      <span
                        class="inline-block transition-transform duration-200"
                        :class="p.openObjectiveKeys.has(key) ? 'rotate-180' : ''"
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
                      p.firstPercentByTeam(
                        p.objectiveRow(key).firstByWin,
                        p.objectiveRow(key).firstByLoss,
                        p.overviewTeamsData.matchCount
                      ).win
                    }}
                  </td>
                  <td class="py-1.5 text-center">
                    {{
                      p.firstPercentByTeam(
                        p.objectiveRow(key).firstByWin,
                        p.objectiveRow(key).firstByLoss,
                        p.overviewTeamsData.matchCount
                      ).loss
                    }}
                  </td>
                </tr>
                <template v-if="p.openObjectiveKeys.has(key)">
                  <tr
                    v-for="count in p.objectiveCounts(key)"
                    :key="key + '-' + count"
                    class="bg-surface/30"
                  >
                    <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                    <td class="py-1 pr-2 text-center text-text/80">
                      {{ p.percentForCount(key, count, true) }}
                    </td>
                    <td class="py-1 text-center text-text/80">
                      {{ p.percentForCount(key, count, false) }}
                    </td>
                  </tr>
                </template>
              </template>
            </tbody>
          </table>
        </div>
        <div
          v-else-if="p.objectivesPanelTab === 'drakeTypes'"
          class="w-full min-w-0 overflow-x-auto"
        >
          <table class="w-full min-w-[280px] text-left text-sm">
            <thead>
              <tr class="border-b border-primary/30 text-text/70">
                <th class="py-1.5 pr-2 font-medium">
                  {{ p.t('statisticsPage.overviewTeamsObjective') }}
                </th>
                <th class="py-1.5 pr-2 text-center font-medium">
                  {{ p.t('statisticsPage.overviewTeamsByWin') }}
                </th>
                <th class="py-1.5 text-center font-medium">
                  {{ p.t('statisticsPage.overviewTeamsByLoss') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20 text-text/80">
              <tr v-for="row in p.drakeTypeRows" :key="'drake-type-' + row.key">
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
                  {{ p.teamPercent(row.byWin, p.overviewTeamsData.matchCount) }}
                </td>
                <td class="py-1.5 text-center">
                  {{ p.teamPercent(row.byLoss, p.overviewTeamsData.matchCount) }}
                </td>
              </tr>
              <tr v-if="p.drakeTypeRows.length === 0">
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
                <th class="py-1.5 pr-2 text-center font-medium">
                  {{ p.t('statisticsPage.overviewTeamsByWin') }}
                </th>
                <th class="py-1.5 text-center font-medium">
                  {{ p.t('statisticsPage.overviewTeamsByLoss') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20 text-text/80">
              <tr>
                <td class="py-1.5 pr-2 font-medium text-text/90">
                  {{ p.t('statisticsPage.objectivesSoulGlobal') }}
                </td>
                <td class="py-1.5 pr-2 text-center">
                  {{ p.teamPercent(p.drakeSoulGlobal.byWin, p.overviewTeamsData.matchCount) }}
                </td>
                <td class="py-1.5 text-center">
                  {{ p.teamPercent(p.drakeSoulGlobal.byLoss, p.overviewTeamsData.matchCount) }}
                </td>
              </tr>
              <template v-for="row in p.drakeSoulRows" :key="'drake-soul-' + row.key">
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
                    {{ p.teamPercent(row.byWin, p.overviewTeamsData.matchCount) }}
                  </td>
                  <td class="py-1.5 text-center">
                    {{ p.teamPercent(row.byLoss, p.overviewTeamsData.matchCount) }}
                  </td>
                </tr>
              </template>
              <tr v-if="p.drakeSoulRows.length === 0">
                <td colspan="3" class="py-2 text-center text-text/60">
                  {{ p.t('statisticsPage.noData') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div v-else class="rounded border border-primary/30 bg-surface/50 p-4 text-sm text-text/70">
        {{ p.t('statisticsPage.objectivesSectionOverviewEmpty') }}
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-base font-semibold text-text">
        {{ p.t('statisticsPage.objectivesSectionTeam') }}
      </h2>
      <p class="text-xs text-text/65">
        {{ p.t('statisticsPage.sidesObjectivesIntro') }}
      </p>
      <div v-if="p.overviewSidesPending" class="text-text/70">
        {{ p.t('statisticsPage.loading') }}
      </div>
      <div
        v-else-if="p.overviewSidesData && p.overviewSidesData.matchCount > 0"
        class="fast-stat-card fast-stat-card-objectives w-full max-w-full rounded-lg border border-primary/30 bg-surface/30 p-3"
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
                  {{ p.teamPercent(p.sidesDrakeSoulGlobal.byBlue, p.overviewSidesData.matchCount) }}
                </td>
                <td class="py-1.5 text-center">
                  {{ p.teamPercent(p.sidesDrakeSoulGlobal.byRed, p.overviewSidesData.matchCount) }}
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
      <div v-else class="rounded border border-primary/30 bg-surface/50 p-4 text-sm text-text/70">
        {{ p.t('statisticsPage.objectivesSectionTeamEmpty') }}
      </div>
    </section>
  </div>
</template>
