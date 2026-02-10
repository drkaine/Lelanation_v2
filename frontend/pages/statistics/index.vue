<template>
  <div class="statistics min-h-screen p-4 text-text">
    <div class="mx-auto max-w-6xl">
      <h1 class="mb-6 text-3xl font-bold text-text-accent">
        {{ t('statisticsPage.title') }}
      </h1>
      <p class="mb-6 text-text/80">
        {{ t('statisticsPage.description') }}
      </p>

      <!-- Tabs -->
      <div class="mb-4 flex flex-wrap gap-2 border-b border-primary/30 pb-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          :class="[
            'rounded px-4 py-2 text-sm font-medium transition-colors',
            activeTab === tab.id
              ? 'bg-accent text-background'
              : 'bg-surface/50 text-text/80 hover:bg-primary/20 hover:text-text',
          ]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Tab: Overview (default) -->
      <div v-show="activeTab === 'overview'" class="space-y-6">
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
          <h2 class="mb-4 text-xl font-semibold text-text-accent">
            {{ t('statisticsPage.overviewTitle') }}
          </h2>
          <p class="mb-4 text-text/80">
            {{ t('statisticsPage.overviewDescription') }}
          </p>
          <div v-if="overviewPending" class="text-text/70">
            {{ t('statisticsPage.loading') }}
          </div>
          <div v-else-if="overviewData" class="space-y-6">
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="rounded border border-primary/20 bg-background/50 p-4">
                <div class="text-2xl font-bold text-text-accent">
                  {{ overviewData.totalMatches }}
                </div>
                <div class="text-sm text-text/70">
                  {{ t('statisticsPage.overviewTotalMatches') }}
                </div>
              </div>
              <div class="rounded border border-primary/20 bg-background/50 p-4">
                <div class="text-sm font-medium text-text">
                  {{ overviewData.lastUpdate ? formatGeneratedAt(overviewData.lastUpdate) : '—' }}
                </div>
                <div class="text-sm text-text/70">{{ t('statisticsPage.overviewLastUpdate') }}</div>
              </div>
              <div class="rounded border border-primary/20 bg-background/50 p-4">
                <div class="text-2xl font-bold text-text-accent">
                  {{ overviewData.playerCount }}
                </div>
                <div class="text-sm text-text/70">
                  {{ t('statisticsPage.overviewPlayerCountDistinct') }}
                </div>
              </div>
            </div>
            <div
              v-if="overviewData.matchesByDivision.length"
              class="rounded-lg border border-primary/20 bg-background/50 p-4"
            >
              <h3 class="mb-3 text-sm font-semibold text-text">
                {{ t('statisticsPage.overviewMatchesByDivision') }}
              </h3>
              <div class="flex flex-wrap gap-3">
                <span
                  v-for="d in overviewData.matchesByDivision"
                  :key="d.rankTier"
                  class="rounded px-3 py-1.5 text-sm font-medium"
                  :style="divisionStyle(d.rankTier)"
                >
                  {{ d.rankTier }}: {{ d.matchCount }}
                </span>
              </div>
            </div>
            <div
              v-if="overviewData.matchesByVersion?.length"
              class="rounded-lg border border-primary/20 bg-background/50 p-4"
            >
              <h3 class="mb-3 text-sm font-semibold text-text">
                {{ t('statisticsPage.overviewFilterByVersion') }}
              </h3>
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    overviewVersionFilter === null
                      ? 'bg-accent text-background'
                      : 'bg-surface/80 text-text/90 hover:bg-primary/20 hover:text-text',
                  ]"
                  @click="setOverviewVersionFilter(null)"
                >
                  {{ t('statisticsPage.overviewVersionAll') }}
                </button>
                <button
                  v-for="v in overviewData.matchesByVersion"
                  :key="v.version"
                  type="button"
                  :class="[
                    'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                    overviewVersionFilter === v.version
                      ? 'bg-accent text-background'
                      : 'bg-surface/80 text-text/90 hover:bg-primary/20 hover:text-text',
                  ]"
                  @click="setOverviewVersionFilter(v.version)"
                >
                  {{ v.version }} ({{ v.matchCount }})
                </button>
              </div>
            </div>
            <div class="grid gap-4 lg:grid-cols-2">
              <div
                v-if="overviewData.topWinrateChampions.length"
                class="rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h3 class="mb-3 text-lg font-medium text-text">
                  {{ t('statisticsPage.overviewTopWinrateChampions') }}
                </h3>
                <ul class="space-y-2">
                  <li
                    v-for="row in overviewData.topWinrateChampions"
                    :key="row.championId"
                    class="flex items-center gap-2 text-text/90"
                  >
                    <img
                      v-if="gameVersion && championByKey(row.championId)"
                      :src="
                        getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)
                      "
                      :alt="championName(row.championId) || ''"
                      class="h-6 w-6 rounded-full object-cover"
                      width="24"
                      height="24"
                    />
                    <span>{{ championName(row.championId) || row.championId }}</span>
                    <span class="text-text/60">
                      — {{ row.games }} {{ t('statisticsPage.games') }}, {{ row.winrate }}% WR
                    </span>
                  </li>
                </ul>
              </div>
              <div
                v-if="overviewTeamsData && overviewTeamsData.matchCount > 0"
                class="rounded-lg border border-primary/30 bg-surface/30 p-6"
              >
                <h3 class="mb-3 text-lg font-medium text-text">
                  {{ t('statisticsPage.overviewTeamsObjectives') }}
                </h3>
                <p class="mb-3 text-xs text-text/60">
                  {{ t('statisticsPage.overviewTeamsFirstByTeam') }}
                </p>
                <div class="overflow-x-auto">
                  <table class="w-full min-w-[280px] text-left text-sm">
                    <thead>
                      <tr class="border-b border-primary/30 text-text/70">
                        <th class="py-1.5 pr-2 font-medium">
                          {{ t('statisticsPage.overviewTeamsObjective') }}
                        </th>
                        <th class="py-1.5 pr-2 text-center font-medium">
                          {{ t('statisticsPage.overviewTeamsFirstByWin') }}
                        </th>
                        <th class="py-1.5 text-center font-medium">
                          {{ t('statisticsPage.overviewTeamsFirstByLoss') }}
                        </th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-primary/20 text-text/80">
                      <tr>
                        <td class="py-1.5 pr-2">
                          {{ t('statisticsPage.overviewTeamsFirstBlood') }}
                        </td>
                        <td class="py-1.5 pr-2 text-center">
                          {{
                            firstPercentByTeam(
                              overviewTeamsData.objectives.firstBlood.firstByWin,
                              overviewTeamsData.objectives.firstBlood.firstByLoss,
                              overviewTeamsData.matchCount
                            ).win
                          }}
                        </td>
                        <td class="py-1.5 text-center">
                          {{
                            firstPercentByTeam(
                              overviewTeamsData.objectives.firstBlood.firstByWin,
                              overviewTeamsData.objectives.firstBlood.firstByLoss,
                              overviewTeamsData.matchCount
                            ).loss
                          }}
                        </td>
                      </tr>
                      <template v-for="key in objectiveKeysWithKills" :key="key">
                        <tr>
                          <td class="py-1.5 pr-2">
                            <button
                              type="button"
                              class="flex items-center gap-1 font-medium text-text/90 hover:text-text"
                              @click="toggleObjective(key)"
                            >
                              <span
                                class="inline-block transition-transform duration-200"
                                :class="openObjectiveKeys.has(key) ? 'rotate-180' : ''"
                                aria-hidden
                                >▼</span
                              >
                              {{ t('statisticsPage.overviewTeamsObjective_' + key) }}
                            </button>
                          </td>
                          <td class="py-1.5 pr-2 text-center">
                            {{
                              firstPercentByTeam(
                                objectiveRow(key).firstByWin,
                                objectiveRow(key).firstByLoss,
                                overviewTeamsData.matchCount
                              ).win
                            }}
                          </td>
                          <td class="py-1.5 text-center">
                            {{
                              firstPercentByTeam(
                                objectiveRow(key).firstByWin,
                                objectiveRow(key).firstByLoss,
                                overviewTeamsData.matchCount
                              ).loss
                            }}
                          </td>
                        </tr>
                        <template v-if="openObjectiveKeys.has(key)">
                          <tr
                            v-for="count in objectiveCounts(key)"
                            :key="key + '-' + count"
                            class="bg-surface/30"
                          >
                            <td class="py-1 pl-6 pr-2 text-text/70">{{ count }}</td>
                            <td class="py-1 pr-2 text-center text-text/80">
                              {{ percentForCount(key, count, true) }}
                            </td>
                            <td class="py-1 text-center text-text/80">
                              {{ percentForCount(key, count, false) }}
                            </td>
                          </tr>
                        </template>
                      </template>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
          <div v-else class="text-text/70">{{ t('statisticsPage.overviewNoData') }}</div>
        </div>

        <!-- Overview detail (runes, items, spells) - accordion -->
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
          <div v-if="overviewDetailPending" class="py-4 text-text/70">
            {{ t('statisticsPage.loading') }}
          </div>
          <div v-else-if="overviewDetailData" class="space-y-2">
            <template v-for="(section, key) in overviewDetailSections" :key="key">
              <details class="group rounded border border-primary/20 bg-background/50">
                <summary
                  class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-left font-medium text-text hover:bg-primary/10"
                >
                  <span>{{ section.label }}</span>
                  <span class="text-text/60 transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div class="border-t border-primary/20 px-4 py-3">
                  <div v-if="section.key === 'runes'" class="flex flex-wrap gap-2">
                    <div
                      v-for="r in overviewDetailData.runes"
                      :key="r.runeId"
                      class="flex items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                    >
                      <img
                        v-if="gameVersion && getRuneById(r.runeId)"
                        :src="getRuneImageUrl(gameVersion, getRuneById(r.runeId)!.icon)"
                        :alt="getRuneById(r.runeId)?.name ?? ''"
                        class="h-6 w-6 object-contain"
                        width="24"
                        height="24"
                      />
                      <span class="min-w-[80px] text-sm text-text/90">{{
                        getRuneById(r.runeId)?.name ?? r.runeId
                      }}</span>
                      <div class="flex items-center gap-2">
                        <div class="h-2 w-12 overflow-hidden rounded bg-surface" title="Pick %">
                          <div
                            class="h-full bg-accent"
                            :style="{
                              width:
                                Math.min(100, (r.pickrate / overviewDetailMaxRunePick) * 100) + '%',
                            }"
                          />
                        </div>
                        <span class="text-xs text-text/70">{{ r.winrate }}%</span>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="section.key === 'runeSets'" class="space-y-2">
                    <div
                      v-for="(set, idx) in overviewDetailData.runeSets.slice(0, 15)"
                      :key="idx"
                      class="flex flex-wrap items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-2"
                    >
                      <div class="flex gap-0.5">
                        <template v-for="runeId in runeIdsFromSet(set.runes)" :key="runeId">
                          <img
                            v-if="gameVersion && getRuneById(runeId)"
                            :src="getRuneImageUrl(gameVersion, getRuneById(runeId)!.icon)"
                            :alt="getRuneById(runeId)?.name ?? ''"
                            class="h-6 w-6 object-contain"
                            width="24"
                            height="24"
                          />
                        </template>
                      </div>
                      <span class="text-xs text-text/70"
                        >{{ set.pickrate }}% pick — {{ set.winrate }}% WR</span
                      >
                    </div>
                  </div>
                  <div v-else-if="section.key === 'items'" class="flex flex-wrap gap-2">
                    <div
                      v-for="it in overviewDetailData.items.slice(0, 40)"
                      :key="it.itemId"
                      class="flex items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                    >
                      <img
                        v-if="gameVersion && itemImageName(it.itemId)"
                        :src="getItemImageUrl(gameVersion, itemImageName(it.itemId)!)"
                        :alt="itemName(it.itemId) ?? ''"
                        class="h-6 w-6 object-contain"
                        width="24"
                        height="24"
                      />
                      <span class="min-w-[100px] truncate text-sm text-text/90">{{
                        itemName(it.itemId) ?? it.itemId
                      }}</span>
                      <div class="flex items-center gap-2">
                        <div class="h-2 w-12 overflow-hidden rounded bg-surface">
                          <div
                            class="h-full bg-accent"
                            :style="{
                              width:
                                Math.min(100, (it.pickrate / overviewDetailMaxItemPick) * 100) +
                                '%',
                            }"
                          />
                        </div>
                        <span class="text-xs text-text/70">{{ it.winrate }}%</span>
                      </div>
                    </div>
                  </div>
                  <div v-else-if="section.key === 'itemSets'" class="space-y-2">
                    <div
                      v-for="(set, idx) in overviewDetailData.itemSets.slice(0, 15)"
                      :key="idx"
                      class="flex flex-wrap items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-2"
                    >
                      <div class="flex gap-0.5">
                        <template v-for="itemId in set.items" :key="itemId">
                          <img
                            v-if="gameVersion && itemImageName(itemId)"
                            :src="getItemImageUrl(gameVersion, itemImageName(itemId)!)"
                            :alt="itemName(itemId) ?? ''"
                            class="h-6 w-6 object-contain"
                            width="24"
                            height="24"
                          />
                        </template>
                      </div>
                      <span class="text-xs text-text/70"
                        >{{ set.pickrate }}% pick — {{ set.winrate }}% WR</span
                      >
                    </div>
                  </div>
                  <div v-else-if="section.key === 'itemsByOrder'" class="space-y-4">
                    <div
                      v-for="(slotIdx, slotKey) in [0, 1, 2, 3, 4, 5]"
                      :key="slotKey"
                      class="rounded border border-primary/20 bg-surface/30 p-2"
                    >
                      <div class="mb-1 text-xs font-medium text-text/70">
                        Slot {{ slotIdx + 1 }}
                      </div>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="row in sortedItemsBySlot(slotIdx).slice(0, 8)"
                          :key="row.itemId"
                          class="flex items-center gap-1 rounded px-1.5 py-1 text-sm"
                        >
                          <img
                            v-if="gameVersion && itemImageName(row.itemId)"
                            :src="getItemImageUrl(gameVersion, itemImageName(row.itemId)!)"
                            :alt="itemName(row.itemId) ?? ''"
                            class="h-5 w-5 object-contain"
                            width="20"
                            height="20"
                          />
                          <span class="text-text/80">{{ row.winrate }}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Summoner spells: spellId from Participants.summonerSpells (API); name/image from public/data/game/{version}/{lang}/summoner.json via store (key = id) -->
                  <div v-else-if="section.key === 'summonerSpells'" class="flex flex-wrap gap-2">
                    <div
                      v-for="s in overviewDetailData.summonerSpells"
                      :key="s.spellId"
                      class="flex items-center gap-2 rounded border border-primary/20 bg-surface/50 px-2 py-1.5"
                    >
                      <img
                        v-if="gameVersion && spellImageName(s.spellId)"
                        :src="getSpellImageUrl(gameVersion, spellImageName(s.spellId)!)"
                        :alt="spellName(s.spellId) ?? ''"
                        class="h-6 w-6 object-contain"
                        width="24"
                        height="24"
                      />
                      <span class="min-w-[80px] text-sm text-text/90">{{
                        spellName(s.spellId) ?? s.spellId
                      }}</span>
                      <div class="flex items-center gap-2">
                        <div class="h-2 w-12 overflow-hidden rounded bg-surface">
                          <div
                            class="h-full bg-accent"
                            :style="{
                              width:
                                Math.min(
                                  100,
                                  (overviewDetailMaxSpellPick
                                    ? s.pickrate / overviewDetailMaxSpellPick
                                    : 0) * 100
                                ) + '%',
                            }"
                          />
                        </div>
                        <span class="text-xs text-text/70">{{ s.winrate }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </template>
          </div>
          <div v-else-if="!overviewDetailPending" class="py-4 text-text/70">
            {{ t('statisticsPage.overviewDetailNoData') }}
          </div>
        </div>

        <!-- Bans & Objectives (from matches.teams) -->
        <div class="rounded-lg border border-primary/30 bg-surface/30 p-6">
          <h3 class="mb-4 text-lg font-semibold text-text">
            {{ t('statisticsPage.overviewTeamsTitle') }}
          </h3>
          <div v-if="overviewTeamsPending" class="py-4 text-text/70">
            {{ t('statisticsPage.loading') }}
          </div>
          <div v-else-if="overviewTeamsData && overviewTeamsData.matchCount > 0" class="space-y-4">
            <p class="text-sm text-text/70">
              {{
                t('statisticsPage.overviewTeamsMatchCount', { count: overviewTeamsData.matchCount })
              }}
            </p>
            <details class="group rounded border border-primary/20 bg-background/50">
              <summary
                class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-left font-medium text-text hover:bg-primary/10"
              >
                <span>{{ t('statisticsPage.overviewTeamsBans') }}</span>
                <span class="text-text/60 transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div class="border-t border-primary/20 px-4 py-3">
                <div class="grid gap-4 sm:grid-cols-2">
                  <div>
                    <h4 class="mb-2 text-sm font-medium text-green-600 dark:text-green-400">
                      {{ t('statisticsPage.overviewTeamsBansByWin') }}
                    </h4>
                    <div class="flex flex-wrap gap-2">
                      <div
                        v-for="b in overviewTeamsData.bans.byWin.slice(0, 20)"
                        :key="'win-' + b.championId"
                        class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                        :title="championName(b.championId) ?? String(b.championId)"
                      >
                        <img
                          v-if="gameVersion && championByKey(b.championId)"
                          :src="
                            getChampionImageUrl(
                              gameVersion,
                              championByKey(b.championId)!.image.full
                            )
                          "
                          :alt="championName(b.championId) ?? ''"
                          class="h-6 w-6 rounded-full object-cover"
                          width="24"
                          height="24"
                        />
                        <span class="text-xs text-text/80"
                          >{{ b.count }} ({{ b.banRatePercent }})</span
                        >
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 class="mb-2 text-sm font-medium text-red-600 dark:text-red-400">
                      {{ t('statisticsPage.overviewTeamsBansByLoss') }}
                    </h4>
                    <div class="flex flex-wrap gap-2">
                      <div
                        v-for="b in overviewTeamsData.bans.byLoss.slice(0, 20)"
                        :key="'loss-' + b.championId"
                        class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                        :title="championName(b.championId) ?? String(b.championId)"
                      >
                        <img
                          v-if="gameVersion && championByKey(b.championId)"
                          :src="
                            getChampionImageUrl(
                              gameVersion,
                              championByKey(b.championId)!.image.full
                            )
                          "
                          :alt="championName(b.championId) ?? ''"
                          class="h-6 w-6 rounded-full object-cover"
                          width="24"
                          height="24"
                        />
                        <span class="text-xs text-text/80"
                          >{{ b.count }} ({{ b.banRatePercent }})</span
                        >
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 class="mb-2 text-sm font-medium text-text">
                      {{ t('statisticsPage.overviewTeamsBansTop20Total') }}
                    </h4>
                    <div class="flex flex-wrap gap-2">
                      <div
                        v-for="b in overviewTeamsData.bans.top20Total"
                        :key="'total-' + b.championId"
                        class="flex items-center gap-1.5 rounded border border-primary/20 bg-surface/50 px-2 py-1"
                        :title="championName(b.championId) ?? String(b.championId)"
                      >
                        <img
                          v-if="gameVersion && championByKey(b.championId)"
                          :src="
                            getChampionImageUrl(
                              gameVersion,
                              championByKey(b.championId)!.image.full
                            )
                          "
                          :alt="championName(b.championId) ?? ''"
                          class="h-6 w-6 rounded-full object-cover"
                          width="24"
                          height="24"
                        />
                        <span class="text-xs text-text/80"
                          >{{ b.count }} ({{ b.banRatePercent }})</span
                        >
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>
          <div v-else-if="!overviewTeamsPending" class="py-4 text-text/70">
            {{ t('statisticsPage.overviewTeamsNoData') }}
          </div>
        </div>
      </div>

      <!-- Tab: Champions -->
      <div v-show="activeTab === 'champions'" class="space-y-4">
        <div class="flex flex-wrap items-end gap-4">
          <div>
            <label for="champion-search" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.searchChampion')
            }}</label>
            <input
              id="champion-search"
              v-model.trim="championSearchQuery"
              type="text"
              :placeholder="t('statisticsPage.searchChampionPlaceholder')"
              class="min-w-[200px] rounded border border-primary/50 bg-background px-3 py-2 text-text placeholder:text-text/50"
            />
          </div>
          <div>
            <label for="filter-rank" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRank')
            }}</label>
            <select
              id="filter-rank"
              v-model="filterRank"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRanks') }}</option>
              <option v-for="r in rankTiers" :key="r" :value="r">{{ r }}</option>
            </select>
          </div>
          <div>
            <label for="filter-role" class="mb-1 block text-sm font-medium text-text">{{
              t('statisticsPage.filterRole')
            }}</label>
            <select
              id="filter-role"
              v-model="filterRole"
              class="rounded border border-primary/50 bg-background px-3 py-2 text-text"
            >
              <option value="">{{ t('statisticsPage.allRoles') }}</option>
              <option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</option>
            </select>
          </div>
        </div>
        <div v-if="championsPending" class="text-text/70">{{ t('statisticsPage.loading') }}</div>
        <div
          v-else-if="championsError"
          class="rounded border border-error bg-surface p-3 text-error"
        >
          {{ championsError }}
        </div>
        <div
          v-else-if="championsData?.message && !championsData?.champions?.length"
          class="text-text/70"
        >
          {{ championsData.message }}
        </div>
        <div v-else class="overflow-x-auto rounded-lg border border-primary/30 bg-surface/30">
          <table class="w-full min-w-[400px] text-left text-sm">
            <thead class="border-b border-primary/30 bg-surface/50">
              <tr>
                <th class="px-4 py-3 font-semibold text-text">
                  {{ t('statisticsPage.champion') }}
                </th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.games') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.wins') }}</th>
                <th class="px-4 py-3 font-semibold text-text">{{ t('statisticsPage.winrate') }}</th>
                <th class="px-4 py-3 font-semibold text-text">
                  {{ t('statisticsPage.pickrate') }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-primary/20">
              <tr
                v-for="row in filteredChampions"
                :key="row.championId"
                class="hover:bg-surface/50"
              >
                <td class="px-4 py-2 font-medium text-text">
                  <div class="flex items-center gap-2">
                    <img
                      v-if="gameVersion && championByKey(row.championId)"
                      :src="
                        getChampionImageUrl(gameVersion, championByKey(row.championId)!.image.full)
                      "
                      :alt="championName(row.championId) || ''"
                      class="h-8 w-8 rounded-full object-cover"
                      width="32"
                      height="32"
                    />
                    <span>{{ championName(row.championId) || row.championId }}</span>
                  </div>
                </td>
                <td class="px-4 py-2 text-text/90">{{ row.games }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.wins }}</td>
                <td class="px-4 py-2 text-text/90">{{ row.winrate }}%</td>
                <td class="px-4 py-2 text-text/90">{{ row.pickrate }}%</td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="
              (championsData?.totalMatches != null || championsData?.totalGames != null) &&
              filteredChampions.length
            "
            class="border-t border-primary/20 px-4 py-2 text-xs text-text/70"
          >
            {{ t('statisticsPage.totalGames') }}:
            {{ championsData.totalMatches ?? championsData.totalGames }}
            <span v-if="championSearchQuery">
              ({{ t('statisticsPage.showing') }} {{ filteredChampions.length }})</span
            >
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { apiUrl } from '~/utils/apiUrl'
import { useChampionsStore } from '~/stores/ChampionsStore'
import { useItemsStore } from '~/stores/ItemsStore'
import { useRunesStore } from '~/stores/RunesStore'
import { useSummonerSpellsStore } from '~/stores/SummonerSpellsStore'
import { useVersionStore } from '~/stores/VersionStore'
import { useGameVersion } from '~/composables/useGameVersion'
import {
  getChampionImageUrl,
  getItemImageUrl,
  getRuneImageUrl,
  getSpellImageUrl,
} from '~/utils/imageUrl'

definePageMeta({
  layout: 'default',
})

const { t, locale } = useI18n()

useHead({
  title: () => t('statisticsPage.metaTitle'),
  meta: [{ name: 'description', content: () => t('statisticsPage.metaDescription') }],
})
useSeoMeta({
  ogTitle: () => t('statisticsPage.metaTitle'),
  ogDescription: () => t('statisticsPage.metaDescription'),
  ogType: 'website',
})

const championsStore = useChampionsStore()
const itemsStore = useItemsStore()
const runesStore = useRunesStore()
const summonerSpellsStore = useSummonerSpellsStore()
const versionStore = useVersionStore()
const { version: gameVersion } = useGameVersion()

const getRiotLanguage = (loc: string): string => (loc === 'en' ? 'en_US' : 'fr_FR')
const riotLocale = computed(() => getRiotLanguage(locale.value))

const activeTab = ref<'overview' | 'champions'>('overview')
const tabs = computed(() => [
  { id: 'overview' as const, label: t('statisticsPage.tabOverview') },
  { id: 'champions' as const, label: t('statisticsPage.tabChampions') },
])

const championSearchQuery = ref('')
const filteredChampions = computed(() => {
  const list = championsData.value?.champions ?? []
  const q = championSearchQuery.value.toLowerCase()
  if (!q) return list
  return list.filter(row => {
    const name = championName(row.championId)?.toLowerCase() ?? ''
    return name.includes(q) || String(row.championId).includes(q)
  })
})

function formatGeneratedAt(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    const d = new Date(value)
    return d.toLocaleString(locale.value)
  } catch {
    return value
  }
}

/** Official LoL rank tier colors (background + text for contrast). */
const DIVISION_COLORS: Record<string, { bg: string; text: string }> = {
  IRON: { bg: '#5e5e5e', text: '#fff' },
  BRONZE: { bg: '#cd7f32', text: '#fff' },
  SILVER: { bg: '#c0c0c0', text: '#1f2937' },
  GOLD: { bg: '#ffd700', text: '#1f2937' },
  PLATINUM: { bg: '#00d4aa', text: '#0f172a' },
  EMERALD: { bg: '#10b981', text: '#fff' },
  DIAMOND: { bg: '#00bfff', text: '#0f172a' },
  MASTER: { bg: '#9d4edd', text: '#fff' },
  GRANDMASTER: { bg: '#c41e3a', text: '#fff' },
  CHALLENGER: { bg: '#fbbf24', text: '#1f2937' },
  UNRANKED: { bg: '#6b7280', text: '#fff' },
}
function divisionStyle(rankTier: string): { backgroundColor: string; color: string } {
  const c = DIVISION_COLORS[rankTier] ?? { bg: '#4b5563', text: '#fff' }
  return { backgroundColor: c.bg, color: c.text }
}

// Overview (vue d'ensemble)
const overviewData = ref<{
  totalMatches: number
  lastUpdate: string | null
  topWinrateChampions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  matchesByDivision: Array<{ rankTier: string; matchCount: number }>
  matchesByVersion?: Array<{ version: string; matchCount: number }>
  playerCount: number
} | null>(null)
const overviewPending = ref(true)
/** Selected version filter for overview (null = all versions). */
const overviewVersionFilter = ref<string | null>(null)
/** Overview detail (runes, items, spells) from GET /api/stats/overview-detail */
const overviewDetailData = ref<{
  runes: Array<{ runeId: number; games: number; wins: number; pickrate: number; winrate: number }>
  runeSets: Array<{
    runes: unknown
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  items: Array<{ itemId: number; games: number; wins: number; pickrate: number; winrate: number }>
  itemSets: Array<{
    items: number[]
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
  itemsByOrder: Record<
    string,
    Array<{ itemId: number; games: number; wins: number; winrate: number }>
  >
  summonerSpells: Array<{
    spellId: number
    games: number
    wins: number
    pickrate: number
    winrate: number
  }>
} | null>(null)
const overviewDetailPending = ref(false)
const overviewDetailSections = computed(() => [
  { key: 'runes', label: t('statisticsPage.overviewDetailRunes') },
  { key: 'runeSets', label: t('statisticsPage.overviewDetailRuneSets') },
  { key: 'items', label: t('statisticsPage.overviewDetailItems') },
  { key: 'itemSets', label: t('statisticsPage.overviewDetailItemSets') },
  { key: 'itemsByOrder', label: t('statisticsPage.overviewDetailItemsByOrder') },
  { key: 'summonerSpells', label: t('statisticsPage.overviewDetailSummonerSpells') },
])
const overviewDetailMaxRunePick = computed(() => {
  const list = overviewDetailData.value?.runes
  if (!list?.length) return 1
  return Math.max(...list.map(r => r.pickrate), 1)
})
const overviewDetailMaxItemPick = computed(() => {
  const list = overviewDetailData.value?.items
  if (!list?.length) return 1
  return Math.max(...list.map(i => i.pickrate), 1)
})
const overviewDetailMaxSpellPick = computed(() => {
  const list = overviewDetailData.value?.summonerSpells
  if (!list?.length) return 1
  return Math.max(...list.map(s => s.pickrate), 1)
})
async function loadOverview() {
  overviewPending.value = true
  try {
    const url =
      overviewVersionFilter.value != null && overviewVersionFilter.value !== ''
        ? apiUrl('/api/stats/overview?version=' + encodeURIComponent(overviewVersionFilter.value))
        : apiUrl('/api/stats/overview')
    overviewData.value = await $fetch(url)
  } catch {
    overviewData.value = null
  } finally {
    overviewPending.value = false
  }
  loadOverviewDetail()
  loadOverviewTeams()
}
async function loadOverviewDetail() {
  overviewDetailPending.value = true
  try {
    const version =
      overviewVersionFilter.value != null && overviewVersionFilter.value !== ''
        ? overviewVersionFilter.value
        : undefined
    const q = version ? '?version=' + encodeURIComponent(version) : ''
    overviewDetailData.value = await $fetch(apiUrl('/api/stats/overview-detail' + q))
  } catch {
    overviewDetailData.value = null
  } finally {
    overviewDetailPending.value = false
  }
}
/** Overview teams: bans and objectives (first + distribution for %). */
const overviewTeamsData = ref<{
  matchCount: number
  bans: {
    byWin: Array<{ championId: number; count: number; banRatePercent: string }>
    byLoss: Array<{ championId: number; count: number; banRatePercent: string }>
    top20Total: Array<{ championId: number; count: number; banRatePercent: string }>
  }
  objectives: {
    firstBlood: { firstByWin: number; firstByLoss: number }
    baron: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    dragon: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    tower: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    inhibitor: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    riftHerald: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
    horde: {
      firstByWin: number
      firstByLoss: number
      killsByWin: number
      killsByLoss: number
      distributionByWin: Record<string, number>
      distributionByLoss: Record<string, number>
    }
  }
} | null>(null)
const overviewTeamsPending = ref(false)
async function loadOverviewTeams() {
  overviewTeamsPending.value = true
  try {
    const version =
      overviewVersionFilter.value != null && overviewVersionFilter.value !== ''
        ? overviewVersionFilter.value
        : undefined
    const q = version ? '?version=' + encodeURIComponent(version) : ''
    overviewTeamsData.value = await $fetch(apiUrl('/api/stats/overview-teams' + q))
  } catch {
    overviewTeamsData.value = null
  } finally {
    overviewTeamsPending.value = false
  }
}
/** % of matches where winning team got first, and % where losing team got first. */
function firstPercentByTeam(
  firstByWin: number,
  firstByLoss: number,
  matchCount: number
): { win: string; loss: string } {
  if (!matchCount) return { win: '—', loss: '—' }
  const winPct = Math.round((firstByWin / matchCount) * 1000) / 10
  const lossPct = Math.round((firstByLoss / matchCount) * 1000) / 10
  return { win: winPct + '%', loss: lossPct + '%' }
}
/** Distribution as % of matches, sorted by count (number then percent). */
function objectiveDistributionPercentages(
  key: string,
  byWin: boolean
): Array<{ count: number; percent: number }> {
  const data = overviewTeamsData.value
  if (!data?.matchCount) return []
  const obj = data.objectives[key as keyof typeof data.objectives]
  if (!obj || !('distributionByWin' in obj)) return []
  const dist = byWin
    ? (obj as { distributionByWin: Record<string, number> }).distributionByWin
    : (obj as { distributionByLoss: Record<string, number> }).distributionByLoss
  const total = data.matchCount
  return Object.entries(dist)
    .map(([k, n]) => ({
      count: parseInt(k, 10) || 0,
      percent: Math.round((Number(n) / total) * 1000) / 10,
    }))
    .filter(({ percent }) => percent > 0)
    .sort((a, b) => a.count - b.count)
}
/** All counts (0, 1, 2, …) for an objective, from both teams, sorted. */
function objectiveCounts(key: string): number[] {
  const win = objectiveDistributionPercentages(key, true)
  const loss = objectiveDistributionPercentages(key, false)
  const set = new Set<number>([...win.map(r => r.count), ...loss.map(r => r.count)])
  return [...set].sort((a, b) => a - b)
}
/** Percent for a given count and team (for dropdown content). */
function percentForCount(key: string, count: number, byWin: boolean): string {
  const rows = objectiveDistributionPercentages(key, byWin)
  const row = rows.find(r => r.count === count)
  return row ? row.percent + '%' : '—'
}
const objectiveKeysWithKills = ['baron', 'dragon', 'tower', 'inhibitor', 'horde'] as const
const openObjectiveKeys = ref<Set<string>>(new Set())
function toggleObjective(key: string) {
  const next = new Set(openObjectiveKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  openObjectiveKeys.value = next
}
function objectiveRow(key: string): {
  firstByWin: number
  firstByLoss: number
  killsByWin: number
  killsByLoss: number
} {
  const o = overviewTeamsData.value?.objectives as
    | Record<
        string,
        { firstByWin?: number; firstByLoss?: number; killsByWin?: number; killsByLoss?: number }
      >
    | undefined
  if (!o?.[key]) return { firstByWin: 0, firstByLoss: 0, killsByWin: 0, killsByLoss: 0 }
  const obj = o[key]
  return {
    firstByWin: obj.firstByWin ?? 0,
    firstByLoss: obj.firstByLoss ?? 0,
    killsByWin: obj.killsByWin ?? 0,
    killsByLoss: obj.killsByLoss ?? 0,
  }
}
function setOverviewVersionFilter(version: string | null) {
  overviewVersionFilter.value = version
  loadOverview()
}

const filterRank = ref('')
const filterRole = ref('')
const rankTiers = [
  'IRON',
  'BRONZE',
  'SILVER',
  'GOLD',
  'PLATINUM',
  'EMERALD',
  'DIAMOND',
  'MASTER',
  'GRANDMASTER',
  'CHALLENGER',
]
const roles = [
  { value: 'TOP', label: 'Top' },
  { value: 'JUNGLE', label: 'Jungle' },
  { value: 'MIDDLE', label: 'Mid' },
  { value: 'BOTTOM', label: 'ADC' },
  { value: 'UTILITY', label: 'Support' },
]

// Champions
const championsData = ref<{
  totalGames: number
  totalMatches?: number
  champions: Array<{
    championId: number
    games: number
    wins: number
    winrate: number
    pickrate: number
  }>
  message?: string
} | null>(null)
const championsPending = ref(true)
const championsError = ref<string | null>(null)
const queryString = computed(() => {
  const params = new URLSearchParams()
  if (filterRank.value) params.set('rankTier', filterRank.value)
  if (filterRole.value) params.set('role', filterRole.value)
  return params.toString() ? `?${params.toString()}` : ''
})
async function loadChampions() {
  championsPending.value = true
  championsError.value = null
  try {
    championsData.value = await $fetch(apiUrl(`/api/stats/champions${queryString.value}`))
  } catch (e) {
    championsError.value = e instanceof Error ? e.message : String(e)
  } finally {
    championsPending.value = false
  }
}
watch([filterRank, filterRole], loadChampions)

/** Resolve champion by numeric id (API uses Riot champion key). */
function championByKey(championId: number): (typeof championsStore.champions)[0] | null {
  const champ = championsStore.champions.find(c => c.key === String(championId))
  return champ ?? null
}

function championName(championId: number): string | null {
  return championByKey(championId)?.name ?? null
}

function itemName(itemId: number): string | null {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return item?.name ?? null
}

function itemImageName(itemId: number): string | null {
  const item = itemsStore.items.find(i => i.id === String(itemId))
  return item?.image?.full ?? null
}

/** Find rune by perk id across all paths/slots. */
function getRuneById(runeId: number): { id: number; name: string; icon: string } | null {
  for (const path of runesStore.runePaths) {
    for (const slot of path.slots) {
      const rune = slot.runes.find(r => r.id === runeId)
      if (rune) return rune
    }
  }
  return null
}

/** Extract perk ids from participant runes JSON (styles[].selections[].perk). */
function runeIdsFromSet(runesUnknown: unknown): number[] {
  if (runesUnknown == null || typeof runesUnknown !== 'object') return []
  const perks = runesUnknown as { styles?: Array<{ selections?: Array<{ perk?: number }> }> }
  const styles = perks?.styles
  if (!Array.isArray(styles)) return []
  const ids: number[] = []
  for (const style of styles) {
    const selections = style?.selections
    if (!Array.isArray(selections)) continue
    for (const sel of selections) {
      if (typeof sel?.perk === 'number') ids.push(sel.perk)
    }
  }
  return ids
}

/** Resolve spell name from game data (public/data/game/{version}/{lang}/summoner.json) by id from Participants.summonerSpells. */
function spellName(spellId: number): string | null {
  const spell = summonerSpellsStore.getSpellById(String(spellId))
  return spell?.name ?? null
}

/** Resolve spell image filename from game data summoner.json by id (key). */
function spellImageName(spellId: number): string | null {
  const spell = summonerSpellsStore.getSpellById(String(spellId))
  return spell?.image?.full ?? null
}

function sortedItemsBySlot(
  slotIdx: number
): Array<{ itemId: number; games: number; wins: number; winrate: number }> {
  const list = overviewDetailData.value?.itemsByOrder[String(slotIdx)] ?? []
  return [...list].sort((a, b) => b.games - a.games)
}

watch(activeTab, tab => {
  if (tab === 'overview') loadOverview()
})

onMounted(async () => {
  if (!versionStore.currentVersion) await versionStore.loadCurrentVersion()
  await Promise.all([
    championsStore.loadChampions(riotLocale.value),
    itemsStore.loadItems(riotLocale.value),
    runesStore.loadRunes(riotLocale.value),
    summonerSpellsStore.loadSummonerSpells(riotLocale.value),
  ])
  await loadOverview()
  await loadChampions()
})
</script>
